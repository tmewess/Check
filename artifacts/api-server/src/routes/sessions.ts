import { Router } from "express";
import { requireAdminToken } from "../middleware/auth";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { db, botSettingsTable, telegramSessionsTable, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { extractTdataSession } from "../lib/tdata";
import { logger } from "../lib/logger";
import { getNextProxy, buildProxyConfig } from "../lib/proxy-manager";

const router = Router();

async function getApiCredentials() {
  const [settings] = await db.select().from(botSettingsTable).limit(1);
  const apiId = settings?.tgApiId ? parseInt(settings.tgApiId, 10) : null;
  const apiHash = settings?.tgApiHash ?? null;
  return { apiId, apiHash };
}

const pendingAuths = new Map<string, { client: TelegramClient; phoneCodeHash: string }>();

const tdataDir = path.join(process.cwd(), "uploads", "tdata");
if (!fs.existsSync(tdataDir)) {
  fs.mkdirSync(tdataDir, { recursive: true });
}

const tdataStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tdataDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const tdataUpload = multer({
  storage: tdataStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files allowed"));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

function parseSessionString(sessionString: string | null) {
  if (!sessionString) return { dcId: null, authKey: null };
  try {
    const s = sessionString[0] === "1" ? sessionString.slice(1) : sessionString;
    const buf = Buffer.from(s, "base64");
    const dcId = buf[0]?.toString() ?? null;
    const ipLen = buf.readInt16BE(1);
    let keyOffset = 0;
    if (ipLen > 100) {
      keyOffset = 1 + 2 + 2;
    } else {
      keyOffset = 3 + ipLen + 2;
    }
    const authKey = buf.slice(keyOffset).toString("base64");
    return { dcId, authKey };
  } catch {
    return { dcId: null, authKey: null };
  }
}

router.get("/sessions", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(telegramSessionsTable).orderBy(telegramSessionsTable.createdAt);
    const result = rows.map(r => ({
      ...r,
      hasSession: !!r.sessionString,
    }));
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/sessions/:id/request", requireAdminToken, async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone) {
    res.status(400).json({ error: "Phone required" });
    return;
  }
  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) {
    res.status(503).json({ error: "API ID/Hash not configured. Set them in Settings." });
    return;
  }
  try {
    const proxy = await getNextProxy();
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 3,
      ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
    });
    await client.connect();
    const result = await client.sendCode({ apiId, apiHash }, phone);
    pendingAuths.set(phone, { client, phoneCodeHash: result.phoneCodeHash });

    await db
      .insert(telegramSessionsTable)
      .values({ phone, status: "pending", phoneCodeHash: result.phoneCodeHash })
      .onConflictDoUpdate({ target: telegramSessionsTable.phone, set: { phoneCodeHash: result.phoneCodeHash, status: "pending" } });

    const isCodeViaApp = result.isCodeViaApp;
    const message = isCodeViaApp
      ? "Код отправлен в ваше приложение Telegram (проверьте уведомления на устройстве, где уже авторизован этот аккаунт)"
      : "Код отправлен по SMS на номер " + phone;

    res.json({ success: true, message, isCodeViaApp });
  } catch (err: any) {
    logger.error({ err }, "sendCode failed");
    res.status(500).json({ error: err?.message ?? "Failed to send code" });
  }
});

router.post("/sessions/:id/confirm", requireAdminToken, async (req, res): Promise<void> => {
  const { phone, code, password } = req.body as { phone?: string; code?: string; password?: string };
  if (!phone || !code) {
    res.status(400).json({ error: "Phone and code required" });
    return;
  }
  const pending = pendingAuths.get(phone);
  if (!pending) {
    res.status(400).json({ error: "No pending auth for this phone. Request code first." });
    return;
  }
  const { client, phoneCodeHash } = pending;
  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) {
    res.status(503).json({ error: "API credentials not configured" });
    return;
  }
  try {
    let me: any;

    try {
      const result = await client.invoke(new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      })) as any;
      me = result.user ?? result;
    } catch (signInErr: any) {
      if (signInErr?.errorMessage === "SESSION_PASSWORD_NEEDED") {
        if (!password) {
          res.json({ success: false, needsPassword: true });
          return;
        }
        await client.signInWithPassword({ apiId, apiHash }, {
          password: async () => password,
          onError: async (err: any) => { throw err; },
        });
        me = await client.getMe() as any;
      } else {
        throw signInErr;
      }
    }

    const sessionString = (client.session as StringSession).save();
    await client.disconnect();
    pendingAuths.delete(phone);

    await db
      .update(telegramSessionsTable)
      .set({
        sessionString,
        status: "active",
        phone: me?.phone ? `+${me.phone}` : phone,
        userId: me?.id?.toString() ?? null,
        firstName: me?.firstName ?? null,
        phoneCodeHash: null,
      })
      .where(eq(telegramSessionsTable.phone, phone));

    res.json({ success: true, message: "Сессия авторизована успешно" });
  } catch (err: any) {
    logger.error({ err }, "signIn failed");
    await client.disconnect().catch(() => {});
    pendingAuths.delete(phone);
    res.status(400).json({ error: err?.errorMessage ?? err?.message ?? "Auth failed" });
  }
});

router.post("/sessions/tdata", requireAdminToken, tdataUpload.single("file"), async (req, res): Promise<void> => {
  const filePath = req.file?.path ?? null;
  if (!filePath) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const phone = (req.body.phone as string) || null;
  const country = (req.body.country as string) || null;
  const password = (req.body.password as string) || null;

  const sessionData = extractTdataSession(filePath);
  if (!sessionData.success) {
    res.status(400).json({ error: sessionData.error ?? "Failed to extract session" });
    return;
  }

  const [session] = await db
    .insert(telegramSessionsTable)
    .values({
      dcId: sessionData.dcId,
      authKey: sessionData.authKey,
      phone,
      country,
      password,
      filePath,
      status: "active",
    })
    .returning();

  res.json({ success: true, message: "tdata загружена успешно", session });
});

router.post("/sessions/upload-tdata", requireAdminToken, tdataUpload.single("file"), async (req, res): Promise<void> => {
  const filePath = req.file?.path ?? null;
  if (!filePath) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const sessionData = extractTdataSession(filePath);
  if (!sessionData.success) {
    res.status(400).json({ error: sessionData.error ?? "Failed to extract session" });
    return;
  }
  const [session] = await db
    .insert(telegramSessionsTable)
    .values({ dcId: sessionData.dcId, authKey: sessionData.authKey, filePath })
    .returning();
  res.json({ success: true, session });
});

router.get("/sessions/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/sessions/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  res.json({ success: true });
});

// PUBLIC — used by tg-shop to validate account before purchase
router.post("/sessions/:id/check", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  if (!session.sessionString) {
    const { dcId, authKey } = parseSessionString(null);
    res.json({
      success: true,
      phone: session.phone,
      userId: session.userId,
      firstName: session.firstName,
      dcId: session.dcId ?? dcId,
      authKey: session.authKey ?? authKey,
      country: session.country,
      hasPassword: !!session.password,
      password: session.password,
      hasPremium: false,
      spamBlock: "Неизвестно",
    });
    return;
  }

  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) {
    res.status(503).json({ error: "API ID/Hash not configured in Settings" });
    return;
  }

  let client: TelegramClient | null = null;
  try {
    const proxy = await getNextProxy();
    client = new TelegramClient(new StringSession(session.sessionString), apiId, apiHash, {
      connectionRetries: 2,
      ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
    });
    await client.connect();
    const me = await client.getMe() as any;
    const sessionStr = (client.session as StringSession).save();
    const { dcId, authKey } = parseSessionString(sessionStr);

    let spamBlock = "Отсутствует";
    try {
      const spamMessages = await client.getMessages("@SpamBot", { limit: 1 });
      const spamText = (spamMessages[0] as any)?.message ?? "";
      if (/limited|ограничен|spam/i.test(spamText)) spamBlock = "Есть ограничения";
    } catch {}

    await client.disconnect();
    await db.update(telegramSessionsTable).set({
      phone: me?.phone ? `+${me.phone}` : session.phone,
      userId: me?.id?.toString() ?? session.userId,
      firstName: me?.firstName ?? session.firstName,
      status: "active",
      sessionString: sessionStr,
    }).where(eq(telegramSessionsTable.id, id));

    res.json({
      success: true,
      phone: me?.phone ? `+${me.phone}` : session.phone,
      userId: me?.id?.toString(),
      firstName: me?.firstName,
      dcId: dcId ?? session.dcId,
      authKey: authKey ?? session.authKey,
      country: session.country,
      hasPremium: me?.premium ?? false,
      hasPassword: !!session.password,
      password: session.password,
      spamBlock,
      sessionString: sessionStr,
    });
  } catch (err: any) {
    await client?.disconnect().catch(() => {});
    logger.error({ err }, "check session failed");
    res.status(400).json({ success: false, error: err?.errorMessage ?? err?.message ?? "Check failed" });
  }
});

router.post("/sessions/:id/create-account", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { price, description, isFree, spamBlock, country } = req.body as {
    price?: number;
    description?: string;
    isFree?: string;
    spamBlock?: string;
    country?: string;
  };

  const { dcId, authKey } = parseSessionString(session.sessionString);

  const [account] = await db.insert(accountsTable).values({
    phone: session.phone ?? "",
    country: country ?? session.country ?? "",
    dcId: dcId ?? session.dcId ?? "",
    userId: session.userId,
    authKey: authKey ?? session.authKey,
    description: description ?? "",
    price: isFree === "true" ? 0 : (price ?? 0),
    isFree: isFree ?? "false",
    hasPassword: !!session.password,
    password: session.password,
    spamBlock: spamBlock ?? "Неизвестно",
    status: "available",
    sessionId: id,
  }).returning();

  res.json({ success: true, message: "Аккаунт добавлен на продажу", accountId: account.id });
});

router.post("/sessions/:id/kick-others", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!session?.sessionString) {
    res.status(400).json({ success: false, error: "Нет сессии с авторизацией для выполнения операции" });
    return;
  }

  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) {
    res.status(503).json({ error: "API ID/Hash не настроены в Настройках" });
    return;
  }

  let client: TelegramClient | null = null;
  try {
    const proxy = await getNextProxy();
    client = new TelegramClient(new StringSession(session.sessionString), apiId, apiHash, {
      connectionRetries: 2,
      ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
    });
    await client.connect();

    const result = await client.invoke(new Api.account.GetAuthorizations()) as any;
    const authorizations: any[] = result.authorizations ?? [];

    const now = Math.floor(Date.now() / 1000);
    const kicked: string[] = [];
    const skippedRecent: string[] = [];
    const failed: string[] = [];

    for (const auth of authorizations) {
      if (auth.current) continue;
      const device = auth.deviceModel || auth.appName || "Неизвестное устройство";
      const ageHours = (now - (auth.dateCreated ?? 0)) / 3600;
      try {
        await client.invoke(new Api.account.ResetAuthorization({ hash: auth.hash }));
        kicked.push(device);
      } catch (kickErr: any) {
        if (ageHours < 24) {
          skippedRecent.push(`${device} (менее 24 ч — не удалось выгнать)`);
        } else {
          failed.push(device);
        }
        logger.warn({ kickErr, device }, "Failed to kick session");
      }
    }

    await client.disconnect();

    const total = authorizations.filter((a: any) => !a.current).length;
    let message = `Выгнано: ${kicked.length} из ${total}.`;
    if (skippedRecent.length > 0) message += ` Менее 24ч (не кикнуть): ${skippedRecent.length}.`;
    if (failed.length > 0) message += ` Ошибок: ${failed.length}.`;

    res.json({ success: true, kicked, skippedRecent, failed, total, message });
  } catch (err: any) {
    await client?.disconnect().catch(() => {});
    logger.error({ err }, "kick-others failed");
    res.status(500).json({ success: false, error: err?.errorMessage ?? err?.message ?? "Ошибка при кике сессий" });
  }
});

router.post("/sessions/:id/get-code", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!session?.sessionString) {
    res.status(404).json({ error: "Session not found or has no session string" });
    return;
  }

  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) {
    res.status(503).json({ error: "API ID/Hash not configured" });
    return;
  }

  let client: TelegramClient | null = null;
  try {
    const proxy = await getNextProxy();
    client = new TelegramClient(new StringSession(session.sessionString), apiId, apiHash, {
      connectionRetries: 2,
      ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
    });
    await client.connect();

    const messages = await client.getMessages(777000, { limit: 10 }) as any[];
    await client.disconnect();

    let code: string | null = null;
    for (const msg of messages) {
      const text: string = msg?.message ?? "";
      const match = text.match(/\b(\d{5,6})\b/);
      if (match) {
        code = match[1];
        break;
      }
    }

    if (code) {
      res.json({ success: true, code });
    } else {
      res.json({ success: false, error: "Код не найден в последних сообщениях" });
    }
  } catch (err: any) {
    await client?.disconnect().catch(() => {});
    logger.error({ err }, "get-code failed");
    res.status(500).json({ success: false, error: err?.errorMessage ?? err?.message ?? "Failed to get code" });
  }
});

// Alias for admin panel "Получить код" button
router.post("/sessions/:id/request-code", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, id));
  if (!session?.sessionString) {
    res.status(404).json({ error: "Сессия не найдена" });
    return;
  }

  const { apiId, apiHash } = await getApiCredentials();
  if (!apiId || !apiHash) { res.status(503).json({ error: "API ID/Hash не настроен" }); return; }

  let client: TelegramClient | null = null;
  try {
    const proxy = await getNextProxy();
    client = new TelegramClient(new StringSession(session.sessionString), apiId, apiHash, {
      connectionRetries: 2,
      ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
    });
    await client.connect();

    const messages = await client.getMessages(777000, { limit: 10 }) as any[];
    await client.disconnect();

    let code: string | null = null;
    for (const msg of messages) {
      const text: string = msg?.message ?? "";
      const match = text.match(/\b(\d{5,6})\b/);
      if (match) { code = match[1]; break; }
    }

    if (code) {
      res.json({ success: true, code });
    } else {
      res.json({ success: true, code: null, message: "Код не найден в последних сообщениях" });
    }
  } catch (err: any) {
    await client?.disconnect().catch(() => {});
    logger.error({ err }, "request-code failed");
    res.status(500).json({ success: false, error: err?.errorMessage ?? err?.message ?? "Ошибка" });
  }
});

export default router;
