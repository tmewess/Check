import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";

const router = Router();

router.get("/admins", requireAdminToken, async (_req, res): Promise<void> => {
  const rows = await db.select().from(adminsTable).orderBy(adminsTable.addedAt);
  res.json(rows);
});

router.post("/admins", requireAdminToken, async (req, res): Promise<void> => {
  const { telegramUserId, username, loginUsername, loginPassword } = req.body as {
    telegramUserId?: string;
    username?: string;
    loginUsername?: string;
    loginPassword?: string;
  };
  if (!telegramUserId || !telegramUserId.trim()) {
    res.status(400).json({ error: "telegramUserId обязателен" });
    return;
  }
  const [existing] = await db.select().from(adminsTable).where(eq(adminsTable.telegramUserId, telegramUserId.trim()));
  if (existing) {
    res.status(409).json({ error: "Этот пользователь уже администратор" });
    return;
  }
  const [row] = await db.insert(adminsTable).values({
    telegramUserId: telegramUserId.trim(),
    username: username?.trim() || null,
    loginUsername: loginUsername?.trim() || null,
    loginPassword: loginPassword?.trim() || null,
  }).returning();
  res.json(row);
});

router.delete("/admins/:telegramUserId", requireAdminToken, async (req, res): Promise<void> => {
  const { telegramUserId } = req.params;
  await db.delete(adminsTable).where(eq(adminsTable.telegramUserId, telegramUserId));
  res.json({ success: true });
});

export default router;
