import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, userBalancesTable, ordersTable, usersTable } from "@workspace/db";

const router = Router();

router.get("/users", requireAdminToken, async (_req, res): Promise<void> => {
  const [users, balances, orders] = await Promise.all([
    db.select().from(usersTable).orderBy(desc(usersTable.lastSeenAt)),
    db.select().from(userBalancesTable),
    db.select({ telegramUserId: ordersTable.telegramUserId }).from(ordersTable),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.telegramUserId, b.balance]));
  const orderMap = new Map<string, number>();
  for (const o of orders) {
    orderMap.set(o.telegramUserId, (orderMap.get(o.telegramUserId) ?? 0) + 1);
  }

  const result = users.map((u) => ({
    telegramUserId: u.telegramUserId,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    balance: balanceMap.get(u.telegramUserId) ?? 0,
    orderCount: orderMap.get(u.telegramUserId) ?? 0,
    lastSeenAt: u.lastSeenAt,
    createdAt: u.createdAt,
  }));

  res.json(result);
});

router.post("/users/:id/balance", requireAdminToken, async (req, res): Promise<void> => {
  const telegramUserId = req.params.id;
  const { amount } = req.body as { amount?: number };

  if (amount === undefined || amount === 0) {
    res.status(400).json({ error: "Amount required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(userBalancesTable)
    .where(eq(userBalancesTable.telegramUserId, telegramUserId));

  if (existing) {
    const newBalance = existing.balance + amount;
    if (newBalance < 0) {
      res.status(400).json({ error: "Balance cannot be negative", current: existing.balance });
      return;
    }
    await db
      .update(userBalancesTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(userBalancesTable.telegramUserId, telegramUserId));
    res.json({ success: true, balance: newBalance, telegramUserId });
  } else {
    if (amount < 0) {
      res.status(400).json({ error: "User has no balance to remove from" });
      return;
    }
    const [row] = await db
      .insert(userBalancesTable)
      .values({ telegramUserId, balance: amount })
      .returning();
    res.json({ success: true, balance: row.balance, telegramUserId });
  }
});

export default router;
