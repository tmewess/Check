import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, newsTable } from "@workspace/db";
import { getBot } from "../bot/index";
import { logger } from "../lib/logger";
import { requireAdminToken } from "../middleware/auth";

const router = Router();

router.get("/news", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(newsTable)
    .where(eq(newsTable.isActive, true))
    .orderBy(desc(newsTable.createdAt));
  res.json(rows);
});

router.get("/news/all", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(newsTable)
    .orderBy(desc(newsTable.createdAt));
  res.json(rows);
});

router.get("/news/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(newsTable).where(eq(newsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "News not found" });
    return;
  }
  res.json(row);
});

async function sendNewsToBot(title: string, content: string): Promise<boolean> {
  const bot = getBot();
  const adminId = process.env["ADMIN_TELEGRAM_ID"];
  if (!bot || !adminId) return false;
  const text = `📰 *${title}*\n\n${content}`;
  try {
    await bot.api.sendMessage(adminId, text, { parse_mode: "Markdown" });
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to send news to bot");
    return false;
  }
}

router.post("/news", requireAdminToken, async (req, res): Promise<void> => {
  const { title, content, isActive, sendToBot } = req.body as {
    title?: string;
    content?: string;
    isActive?: boolean;
    sendToBot?: boolean;
  };
  if (!title || !content) {
    res.status(400).json({ error: "Title and content required" });
    return;
  }
  const [row] = await db
    .insert(newsTable)
    .values({ title, content, isActive: isActive ?? true })
    .returning();

  let botSent = false;
  if (sendToBot) {
    botSent = await sendNewsToBot(title, content);
  }

  res.status(201).json({ ...row, botSent });
});

router.patch("/news/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { title, content, isActive, sendToBot } = req.body as {
    title?: string;
    content?: string;
    isActive?: boolean;
    sendToBot?: boolean;
  };
  const [row] = await db
    .update(newsTable)
    .set({
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(eq(newsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "News not found" });
    return;
  }

  let botSent = false;
  if (sendToBot && row.title && row.content) {
    botSent = await sendNewsToBot(row.title, row.content);
  }

  res.json({ ...row, botSent });
});

router.delete("/news/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.delete(newsTable).where(eq(newsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "News not found" });
    return;
  }
  res.json({ success: true });
});

router.delete("/news", requireAdminToken, async (_req, res): Promise<void> => {
  await db.delete(newsTable);
  res.json({ success: true, message: "All news cleared" });
});

export default router;
