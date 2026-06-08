import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, promoCodesTable, userBalancesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.get("/promo", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
    res.json(codes);
  } catch (err) {
    logger.error({ err }, "Failed to list promo codes");
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/promo", requireAdminToken, async (req, res): Promise<void> => {
  const { code, discountType, discountValue, usageLimit, expiresAt } = req.body as {
    code?: string; discountType?: string; discountValue?: number;
    usageLimit?: number; expiresAt?: string;
  };
  if (!code || !discountValue) {
    res.status(400).json({ error: "code и discountValue обязательны" });
    return;
  }
  try {
    const [promo] = await db.insert(promoCodesTable).values({
      code: code.trim().toUpperCase(),
      discountType: discountType ?? "fixed",
      discountValue,
      usageLimit: usageLimit ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.json({ success: true, promo });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Промокод с таким кодом уже существует" });
    } else {
      logger.error({ err }, "Failed to create promo code");
      res.status(500).json({ error: "DB error" });
    }
  }
});

router.post("/promo/apply", async (req, res): Promise<void> => {
  const { code, telegramUserId } = req.body as { code?: string; telegramUserId?: string };
  if (!code || !telegramUserId) {
    res.status(400).json({ error: "code и telegramUserId обязательны" });
    return;
  }
  try {
    const [promo] = await db.select().from(promoCodesTable).where(
      eq(promoCodesTable.code, code.trim().toUpperCase())
    );
    if (!promo) {
      res.status(404).json({ error: "Промокод не найден" });
      return;
    }
    if (!promo.isActive) {
      res.status(400).json({ error: "Промокод неактивен" });
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "Срок действия промокода истёк" });
      return;
    }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      res.status(400).json({ error: "Промокод исчерпан" });
      return;
    }

    if (promo.discountType === "fixed") {
      const bonus = promo.discountValue;
      const [existing] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, telegramUserId));
      if (existing) {
        await db.update(userBalancesTable)
          .set({ balance: existing.balance + bonus, updatedAt: new Date() })
          .where(eq(userBalancesTable.telegramUserId, telegramUserId));
      } else {
        await db.insert(userBalancesTable).values({ telegramUserId, balance: bonus });
      }
      await db.update(promoCodesTable)
        .set({ usedCount: promo.usedCount + 1 })
        .where(eq(promoCodesTable.id, promo.id));
      res.json({ success: true, message: `Начислено ${bonus} Stars на баланс!`, bonus, discountType: "fixed" });
    } else if (promo.discountType === "percent") {
      await db.update(promoCodesTable)
        .set({ usedCount: promo.usedCount + 1 })
        .where(eq(promoCodesTable.id, promo.id));
      res.json({ success: true, message: `Скидка ${promo.discountValue}% применена!`, discount: promo.discountValue, discountType: "percent" });
    } else {
      res.status(400).json({ error: "Неизвестный тип промокода" });
    }
  } catch (err) {
    logger.error({ err }, "Failed to apply promo code");
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/promo/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete promo code");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
