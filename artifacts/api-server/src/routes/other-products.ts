import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { db, otherProductsTable, ordersTable, userBalancesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/other-products", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(otherProductsTable).orderBy(otherProductsTable.createdAt);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list other products");
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/other-products/available", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(otherProductsTable)
      .where(eq(otherProductsTable.status, "available"))
      .orderBy(otherProductsTable.createdAt);
    const safe = rows.map(({ login, password, email, emailPassword, deliveryDescription, ...rest }) => rest);
    res.json(safe);
  } catch (err) {
    logger.error({ err }, "Failed to list available other products");
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/other-products/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [row] = await db.select().from(otherProductsTable).where(eq(otherProductsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const { login, password, email, emailPassword, deliveryDescription, ...safe } = row;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/other-products", requireAdminToken, async (req, res): Promise<void> => {
  const { socialNetwork, login, password, email, emailPassword, description, deliveryDescription, price, isFree } = req.body as {
    socialNetwork?: string; login?: string; password?: string; email?: string;
    emailPassword?: string; description?: string; deliveryDescription?: string;
    price?: number; isFree?: string;
  };

  if (!socialNetwork) { res.status(400).json({ error: "Соцсеть обязательна" }); return; }
  if (!description && !login) { res.status(400).json({ error: "Укажите описание или логин" }); return; }

  try {
    const [product] = await db.insert(otherProductsTable).values({
      socialNetwork,
      login: login || null,
      password: password || null,
      email: email || null,
      emailPassword: emailPassword || null,
      description: description || null,
      deliveryDescription: deliveryDescription || null,
      price: price ?? 0,
      isFree: isFree ?? "false",
      status: "available",
    }).returning();
    res.json({ success: true, product });
  } catch (err) {
    logger.error({ err }, "Failed to create other product");
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/other-products/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(otherProductsTable).where(eq(otherProductsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete other product");
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/other-products/:id/purchase", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { telegramUserId, telegramUsername } = req.body as { telegramUserId?: string; telegramUsername?: string; };
  if (!telegramUserId) { res.status(400).json({ error: "telegramUserId required" }); return; }

  try {
    const [product] = await db.select().from(otherProductsTable).where(eq(otherProductsTable.id, id));
    if (!product || product.status !== "available") { res.status(404).json({ error: "Товар недоступен" }); return; }

    const isFree = product.isFree === "true" || product.price === 0;

    if (!isFree) {
      const [balance] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, telegramUserId));
      const currentBalance = balance?.balance ?? 0;
      if (currentBalance < product.price) {
        res.status(400).json({ error: "Insufficient balance", required: product.price, current: currentBalance });
        return;
      }
      await db
        .update(userBalancesTable)
        .set({ balance: currentBalance - product.price, updatedAt: new Date() })
        .where(eq(userBalancesTable.telegramUserId, telegramUserId));
    }

    await db.update(otherProductsTable).set({ status: "sold", soldAt: new Date() }).where(eq(otherProductsTable.id, id));

    const [order] = await db.insert(ordersTable).values({
      telegramUserId,
      telegramUsername: telegramUsername ?? null,
      otherProductId: id,
      status: "delivered",
      paymentMethod: isFree ? "free" : "balance",
      amount: isFree ? 0 : product.price,
    }).returning();

    res.json({ success: true, orderId: order.id, product });
  } catch (err) {
    logger.error({ err }, "Failed to purchase other product");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
