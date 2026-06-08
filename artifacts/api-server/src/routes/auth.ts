import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";

const router = Router();

function getSecret() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET env variable is not set! This is a security risk.");
  }
  return secret;
}

function validateTelegramWebAppData(initData: string, botToken: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) return null;

    const result: Record<string, string> = {};
    params.forEach((v, k) => {
      result[k] = v;
    });
    result["hash"] = hash;
    return result;
  } catch {
    return null;
  }
}

// NEVER hardcode credentials — use env vars
// Set ADMIN_USERNAME and ADMIN_PASSWORD in your environment variables
const HARDCODED_ADMIN_USER = process.env["ADMIN_USERNAME"] ?? null;
const HARDCODED_ADMIN_PASS = process.env["ADMIN_PASSWORD"] ?? null;

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Укажите логин и пароль" });
    return;
  }

  // Check env-based admin credentials (timing-safe to prevent brute force)
  if (HARDCODED_ADMIN_USER && HARDCODED_ADMIN_PASS &&
      username === HARDCODED_ADMIN_USER) {
    try {
      const passMatch = crypto.timingSafeEqual(
        Buffer.from(password.padEnd(HARDCODED_ADMIN_PASS.length).slice(0, HARDCODED_ADMIN_PASS.length)),
        Buffer.from(HARDCODED_ADMIN_PASS)
      ) && password === HARDCODED_ADMIN_PASS;
      if (passMatch) {
        const token = jwt.sign({ username: HARDCODED_ADMIN_USER, role: "admin" }, getSecret(), { expiresIn: "30d" });
        res.json({ token, username: HARDCODED_ADMIN_USER });
        return;
      }
    } catch {}
  }

  // Check DB admins with loginUsername/loginPassword
  try {
    const rows = await db.select().from(adminsTable);
    const match = rows.find(
      (a) => a.loginUsername && a.loginPassword &&
             a.loginUsername === username &&
             crypto.timingSafeEqual(
               Buffer.from(a.loginPassword),
               Buffer.from(password.padEnd(a.loginPassword.length).slice(0, a.loginPassword.length))
             )
    );
    if (match && match.loginPassword === password) {
      const displayName = match.username ?? match.loginUsername ?? "admin";
      const token = jwt.sign({ username: displayName, role: "admin", telegramId: match.telegramUserId }, getSecret(), { expiresIn: "30d" });
      res.json({ token, username: displayName });
      return;
    }
  } catch {}

  res.status(401).json({ error: "Неверный логин или пароль" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }
  try {
    const decoded = jwt.verify(token, getSecret()) as { username: string; role: string; telegramId?: string };
    res.json({ username: decoded.username, role: decoded.role, telegramId: decoded.telegramId });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/auth/telegram-webapp", async (req, res): Promise<void> => {
  const { initData } = req.body as { initData?: string };

  if (!initData) {
    res.status(400).json({ error: "initData required" });
    return;
  }

  const botToken = process.env["BOT_TOKEN"];
  if (!botToken) {
    res.status(503).json({ error: "Bot token not configured" });
    return;
  }

  const data = validateTelegramWebAppData(initData, botToken);
  if (!data) {
    res.status(401).json({ error: "Invalid Telegram WebApp data" });
    return;
  }

  let telegramUserId: string | null = null;
  let telegramUsername: string | null = null;
  try {
    const user = JSON.parse(data["user"] ?? "{}") as { id?: number; username?: string };
    telegramUserId = user.id ? String(user.id) : null;
    telegramUsername = user.username ?? null;
  } catch {
    res.status(401).json({ error: "Cannot parse user from initData" });
    return;
  }

  if (!telegramUserId) {
    res.status(401).json({ error: "No user ID in initData" });
    return;
  }

  const hardcodedAdminId = process.env["ADMIN_TELEGRAM_ID"] ?? null;
  const isHardcodedAdmin = !!hardcodedAdminId && telegramUserId === hardcodedAdminId;

  let isDbAdmin = false;
  try {
    const [dbAdmin] = await db.select().from(adminsTable).where(
      eq(adminsTable.telegramUserId, telegramUserId)
    );
    isDbAdmin = !!dbAdmin;
  } catch {}

  if (!isHardcodedAdmin && !isDbAdmin) {
    res.status(403).json({ error: "Not authorized as admin" });
    return;
  }

  const adminUsername = telegramUsername ?? process.env["ADMIN_USERNAME"] ?? "admin";
  const token = jwt.sign({ username: adminUsername, role: "admin", telegramId: telegramUserId }, getSecret(), { expiresIn: "30d" });
  res.json({ token, username: adminUsername });
});

export default router;
