import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, faqItemsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.get("/faq", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(faqItemsTable)
      .where(eq(faqItemsTable.isActive, true))
      .orderBy(asc(faqItemsTable.sortOrder), asc(faqItemsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list FAQ items");
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/faq/all", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(faqItemsTable)
      .orderBy(asc(faqItemsTable.sortOrder), asc(faqItemsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list all FAQ items");
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/faq", requireAdminToken, async (req, res): Promise<void> => {
  const { question, answer, sortOrder } = req.body as { question?: string; answer?: string; sortOrder?: number };
  if (!question || !answer) {
    res.status(400).json({ error: "question и answer обязательны" });
    return;
  }
  try {
    const [item] = await db.insert(faqItemsTable).values({
      question: question.trim(),
      answer: answer.trim(),
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.json({ success: true, item });
  } catch (err) {
    logger.error({ err }, "Failed to create FAQ item");
    res.status(500).json({ error: "DB error" });
  }
});

router.patch("/faq/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { question, answer, sortOrder, isActive } = req.body as {
    question?: string; answer?: string; sortOrder?: number; isActive?: boolean;
  };
  try {
    const updates: Partial<typeof faqItemsTable.$inferInsert> = {};
    if (question !== undefined) updates.question = question.trim();
    if (answer !== undefined) updates.answer = answer.trim();
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    const [item] = await db.update(faqItemsTable).set(updates).where(eq(faqItemsTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, item });
  } catch (err) {
    logger.error({ err }, "Failed to update FAQ item");
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/faq/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(faqItemsTable).where(eq(faqItemsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete FAQ item");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
