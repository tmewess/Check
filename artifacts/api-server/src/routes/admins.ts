import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import crypto from "crypto";

const router = Router();

// Hash password using scrypt (built-in Node.js, no extra deps)
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else {
        try {
          resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derived));
        } catch {
          resolve(false);
        }
      }
    });
  });
}

export { verifyPassword };

router.get("/admins", requireAdminToken, async (_req, res): Promise<void> => {
  const rows = await db.select().from(adminsTable).orderBy(adminsTable.addedAt);
  // Never return loginPassword
  res.json(rows.map(r => ({ ...r, loginPassword: r.loginPassword ? "••••••••" : null })));
});

router.post("/admins", requireAdminToken, async (req, res): Promise<void> => {
  const { telegramUserId, username, loginUsername, loginPassword } = req.body as {
    telegramUserId?: string;
    username?: string;
    loginUsername?: string;
    loginPassword?: string;
  };
  if (!telegramUserId?.trim()) {
    res.status(400).json({ error: "telegramUserId обязателен" });
    return;
  }
  const [existing] = await db.select().from(adminsTable).where(eq(adminsTable.telegramUserId, telegramUserId.trim()));
  if (existing) {
    res.status(409).json({ error: "Этот пользователь уже администратор" });
    return;
  }

  // Hash password before storing
  const hashedPassword = loginPassword?.trim()
    ? await hashPassword(loginPassword.trim())
    : null;

  const [row] = await db.insert(adminsTable).values({
    telegramUserId: telegramUserId.trim(),
    username: username?.trim() || null,
    loginUsername: loginUsername?.trim() || null,
    loginPassword: hashedPassword,
  }).returning();

  res.json({ ...row, loginPassword: row.loginPassword ? "••••••••" : null });
});

router.delete("/admins/:telegramUserId", requireAdminToken, async (req, res): Promise<void> => {
  const { telegramUserId } = req.params;
  await db.delete(adminsTable).where(eq(adminsTable.telegramUserId, telegramUserId));
  res.json({ success: true });
});

export default router;
