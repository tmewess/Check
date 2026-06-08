import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, ordersTable, accountsTable, otherProductsTable } from "@workspace/db";

const router = Router();

router.get("/orders", requireAdminToken, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: ordersTable.id,
      telegramUserId: ordersTable.telegramUserId,
      telegramUsername: ordersTable.telegramUsername,
      accountId: ordersTable.accountId,
      otherProductId: ordersTable.otherProductId,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      amount: ordersTable.amount,
      paymentId: ordersTable.paymentId,
      deliveredAt: ordersTable.deliveredAt,
      createdAt: ordersTable.createdAt,
      accountPhone: accountsTable.phone,
      accountCountry: accountsTable.country,
      accountDcId: accountsTable.dcId,
      accountUserId: accountsTable.userId,
      accountAuthKey: accountsTable.authKey,
      accountFilePath: accountsTable.filePath,
      accountLolzItemId: accountsTable.lolzItemId,
      accountSessionId: accountsTable.sessionId,
      accountHasPremium: accountsTable.hasPremium,
      accountDescription: accountsTable.description,
      accountPassword: accountsTable.password,
      accountHasPassword: accountsTable.hasPassword,
      otherProductSocialNetwork: otherProductsTable.socialNetwork,
      otherProductDescription: otherProductsTable.description,
      otherProductContent: otherProductsTable.deliveryDescription,
      otherProductPrice: otherProductsTable.price,
      otherProductLogin: otherProductsTable.login,
      otherProductPassword: otherProductsTable.password,
      otherProductEmail: otherProductsTable.email,
      otherProductEmailPassword: otherProductsTable.emailPassword,
    })
    .from(ordersTable)
    .leftJoin(accountsTable, eq(ordersTable.accountId, accountsTable.id))
    .leftJoin(otherProductsTable, eq(ordersTable.otherProductId, otherProductsTable.id))
    .orderBy(desc(ordersTable.createdAt));

  res.json(rows);
});

router.patch("/orders/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status } = req.body as { status?: string };
  const allowed = ["pending", "paid", "delivered", "cancelled", "refunded"];
  if (!status || !allowed.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "delivered") updates["deliveredAt"] = sql`now()`;

  const [updated] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(updated);
});

router.delete("/orders", requireAdminToken, async (_req, res): Promise<void> => {
  await db.delete(ordersTable);
  res.json({ success: true, message: "All orders deleted" });
});

export default router;

// PUBLIC — user's own orders only (filtered by telegramUserId from request body)
router.post("/orders/my", async (req, res): Promise<void> => {
  const { telegramUserId } = req.body as { telegramUserId?: string };
  if (!telegramUserId) {
    res.status(400).json({ error: "telegramUserId required" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: ordersTable.id,
        telegramUserId: ordersTable.telegramUserId,
        accountId: ordersTable.accountId,
        otherProductId: ordersTable.otherProductId,
        status: ordersTable.status,
        amount: ordersTable.amount,
        deliveredAt: ordersTable.deliveredAt,
        createdAt: ordersTable.createdAt,
        accountPhone: accountsTable.phone,
        accountCountry: accountsTable.country,
        accountDcId: accountsTable.dcId,
        accountUserId: accountsTable.userId,
        accountAuthKey: accountsTable.authKey,
        accountHasPremium: accountsTable.hasPremium,
        accountDescription: accountsTable.description,
        accountPassword: accountsTable.password,
        accountHasPassword: accountsTable.hasPassword,
        accountSessionId: accountsTable.sessionId,
        otherProductSocialNetwork: otherProductsTable.socialNetwork,
        otherProductDescription: otherProductsTable.description,
        otherProductContent: otherProductsTable.deliveryDescription,
        otherProductLogin: otherProductsTable.login,
        otherProductPassword: otherProductsTable.password,
        otherProductEmail: otherProductsTable.email,
        otherProductEmailPassword: otherProductsTable.emailPassword,
      })
      .from(ordersTable)
      .where(eq(ordersTable.telegramUserId, telegramUserId))
      .leftJoin(accountsTable, eq(ordersTable.accountId, accountsTable.id))
      .leftJoin(otherProductsTable, eq(ordersTable.otherProductId, otherProductsTable.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});
