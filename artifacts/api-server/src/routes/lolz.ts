import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import path from "path";
import fs from "fs";
import { db, botSettingsTable, accountsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { eq } from "drizzle-orm";

const router = Router();
const LOLZ_API = "https://api.lzt.market";
const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function getLolzApiKey(): Promise<string | null> {
  const [settings] = await db.select().from(botSettingsTable).limit(1);
  return settings?.lolzApiKey ?? null;
}

function lolzHeaders(apiKey: string): Record<string, string> {
  const token = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  return {
    Authorization: token,
    Accept: "application/json",
    "User-Agent": "VoidAccountBot/1.0",
  };
}

export interface LolzAccountData {
  phone: string | null;
  password: string | null;
  sessionString: string | null;
  email: string | null;
  emailPassword: string | null;
  extraFields: Record<string, string>;
  rawData: string | null;
}

export async function fetchLolzAccountData(itemId: number, apiKey: string): Promise<LolzAccountData> {
  const empty: LolzAccountData = {
    phone: null, password: null, sessionString: null,
    email: null, emailPassword: null, extraFields: {}, rawData: null,
  };

  try {
    const res = await fetch(`${LOLZ_API}/${itemId}/data`, {
      headers: lolzHeaders(apiKey),
    });
    if (!res.ok) return empty;

    const json = (await res.json()) as Record<string, unknown>;
    const itemData = (json["item"] as Record<string, unknown> | undefined) ?? json;

    const skipKeys = new Set([
      "item_id", "item", "status", "login", "password",
      "email", "email_password", "emailPassword",
      "telegram_session", "session_string", "twofa_password",
    ]);

    const phone =
      (itemData["login"] as string | undefined) ??
      (json["login"] as string | undefined) ??
      null;

    const password =
      (itemData["password"] as string | undefined) ??
      (itemData["twofa_password"] as string | undefined) ??
      (json["password"] as string | undefined) ??
      null;

    const sessionString =
      (itemData["telegram_session"] as string | undefined) ??
      (itemData["session_string"] as string | undefined) ??
      (json["telegram_session"] as string | undefined) ??
      (json["session_string"] as string | undefined) ??
      null;

    const email =
      (itemData["email"] as string | undefined) ??
      (json["email"] as string | undefined) ??
      null;

    const emailPassword =
      (itemData["email_password"] as string | undefined) ??
      (itemData["emailPassword"] as string | undefined) ??
      (json["email_password"] as string | undefined) ??
      null;

    const extraFields: Record<string, string> = {};
    const allData = { ...json, ...itemData };
    for (const [k, v] of Object.entries(allData)) {
      if (skipKeys.has(k)) continue;
      if (v && typeof v === "string" && v.length > 0 && v.length < 500) {
        extraFields[k] = v;
      }
    }

    return {
      phone, password, sessionString,
      email, emailPassword, extraFields,
      rawData: JSON.stringify(json),
    };
  } catch {
    return empty;
  }
}

export interface LolzConfirmCodeResult {
  success: boolean;
  code: string | null;
  error: string | null;
  rawResponse: string | null;
}

function extractCode(json: Record<string, unknown>): string | null {
  const candidates = [json["code"], json["confirmCode"], json["confirm_code"], json["verification_code"], json["verificationCode"], json["sms_code"], json["smsCode"], json["otp"], json["auth_code"], json["authCode"]];
  for (const c of candidates) {
    if (typeof c === "string" && /^\d{4,6}$/.test(c)) return c;
  }
  const text = JSON.stringify(json);
  const match = text.match(/"(\d{4,6})"/);
  if (match) return match[1];
  return null;
}

export async function fetchLolzConfirmCode(itemId: number, apiKey: string): Promise<LolzConfirmCodeResult> {
  const codeEndpoints = [
    `${LOLZ_API}/${itemId}/confirm-code`,
    `${LOLZ_API}/${itemId}/telegram-confirm-code`,
    `${LOLZ_API}/${itemId}/phone-confirmation-code`,
  ];

  for (const endpoint of codeEndpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: lolzHeaders(apiKey),
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(text); } catch { }
      if (!res.ok) continue;
      const code = extractCode(json);
      if (code) {
        return { success: true, code, error: null, rawResponse: text };
      }
    } catch {
      continue;
    }
  }

  try {
    const dataRes = await fetch(`${LOLZ_API}/${itemId}/data`, {
      headers: lolzHeaders(apiKey),
    });
    if (dataRes.ok) {
      const text = await dataRes.text();
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(text); } catch { }
      const code = extractCode(json);
      if (code) {
        return { success: true, code, error: null, rawResponse: text };
      }
    }
  } catch {
  }

  return { success: false, code: null, error: "No confirm code found", rawResponse: null };
}

export async function resetLolzSessions(itemId: number, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${LOLZ_API}/${itemId}/reset-sessions`, {
      method: "POST",
      headers: lolzHeaders(apiKey),
    });
    if (res.ok) return { success: true };
    const text = await res.text();
    return { success: false, error: `${res.status}: ${text.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, error: String(err?.message ?? err) };
  }
}

export async function downloadLolzFile(itemId: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${LOLZ_API}/${itemId}/download`, {
      headers: lolzHeaders(apiKey),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = path.join(uploadsDir, `tdata_${itemId}_${Date.now()}.zip`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
}

router.get("/lolz/accounts", requireAdminToken, async (req, res): Promise<void> => {
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }

  const category = "telegram";
  const params = new URLSearchParams();
  params.set("category", category);
  params.set("page", "1");

  const queryParams = req.query as Record<string, string>;
  if (queryParams.pmin) params.set("pmin", queryParams.pmin);
  if (queryParams.pmax) params.set("pmax", queryParams.pmax);
  if (queryParams.count) params.set("count", queryParams.count);
  if (queryParams.country) params.set("country", queryParams.country);
  if (queryParams.item_origin) params.set("item_origin", queryParams.item_origin);
  if (queryParams.has_password) params.set("has_password", queryParams.has_password);
  if (queryParams.has_premium) params.set("has_premium", queryParams.has_premium);
  if (queryParams.spam) params.set("spam", queryParams.spam);
  if (queryParams.api_code) params.set("api_code", queryParams.api_code);
  if (queryParams.account_id_min) params.set("account_id_min", queryParams.account_id_min);
  if (queryParams.account_id_max) params.set("account_id_max", queryParams.account_id_max);

  try {
    const resLolz = await fetch(`${LOLZ_API}/?${params.toString()}`, {
      headers: lolzHeaders(apiKey),
    });
    const text = await resLolz.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { }
    if (!resLolz.ok) {
      res.status(resLolz.status).json({ error: "Lolz API error", details: json });
      return;
    }
    const items = (json["items"] as any[]) ?? [];
    const mapped = items.map((item: any) => ({
      itemId: item.item_id ?? item.id ?? 0,
      price: item.price ?? 0,
      title: item.title ?? item.account_link ?? "Account",
      phone: item.login ?? item.phone ?? null,
      country: item.country ?? null,
      hasPremium: !!(item.premium ?? false),
      hasPassword: !!(item.has_password ?? false),
      spamBlock: item.spam ?? null,
      dcId: item.dc_id ?? item.dc ?? null,
      userId: item.user_id ?? item.telegram_id ?? null,
      idDigitCount: item.id_digit_count ?? null,
      registrationDate: item.registration_date ?? null,
      canGetCode: Boolean(item.api_code),
      origin: item.item_origin ?? item.origin ?? null,
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

router.post("/lolz/import/:itemId", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  try {
    const data = await fetchLolzAccountData(itemId, apiKey);
    const [account] = await db.insert(accountsTable).values({
      phone: (body.phone as string) ?? data.phone ?? null,
      country: (body.country as string) ?? "",
      phonePrefix: (body.phonePrefix as string) ?? null,
      dcId: (body.dcId as string) ?? null,
      userId: (body.userId as string) ?? null,
      authKey: data.sessionString ?? (body.authKey as string) ?? null,
      description: (body.description as string) ?? "",
      price: (body.isFree as string) === "true" ? 0 : (body.price as number) ?? 0,
      isFree: (body.isFree as string) ?? "false",
      hasPremium: (body.hasPremium as boolean) ?? false,
      hasPassword: (body.hasPassword as boolean) ?? false,
      password: (body.password as string) ?? data.password ?? null,
      spamBlock: (body.spamBlock as string) ?? null,
      registrationDate: (body.registrationDate as string) ?? null,
      origin: (body.origin as string) ?? null,
      lastActivity: (body.lastActivity as string) ?? null,
      status: "available",
    }).returning();
    res.json({ success: true, message: `Account #${account.id} imported`, accountId: account.id });
  } catch (err: any) {
    logger.error({ err }, "Lolz import failed");
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

router.get("/lolz/check-item/:itemId", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }
  try {
    const resLolz = await fetch(`${LOLZ_API}/${itemId}`, {
      headers: lolzHeaders(apiKey),
    });
    const text = await resLolz.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { }
    res.status(resLolz.status).json({ ok: resLolz.ok, status: resLolz.status, data: json });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

router.get("/lolz/item/:itemId/data", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }
  const data = await fetchLolzAccountData(itemId, apiKey);
  res.json(data);
});

router.get("/lolz/item/:itemId/confirm-code", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }
  const result = await fetchLolzConfirmCode(itemId, apiKey);
  res.json(result);
});

router.post("/lolz/item/:itemId/reset-sessions", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(itemId)) {
    res.status(400).json({ error: "Invalid itemId" });
    return;
  }
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }
  const result = await resetLolzSessions(itemId, apiKey);
  res.json(result);
});

router.get("/lolz/item/:itemId/download", requireAdminToken, async (req, res): Promise<void> => {
  const itemId = req.params.itemId;
  const apiKey = await getLolzApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "Lolz API key not configured" });
    return;
  }
  const filePath = await downloadLolzFile(itemId, apiKey);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found or download failed" });
    return;
  }
  res.download(filePath);
});

export default router;
