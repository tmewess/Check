import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, accountsTable, ordersTable, botSettingsTable } from "@workspace/db";

const router = Router();

router.get("/settings", requireAdminToken, async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(botSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(botSettingsTable).values({}).returning();
  }
  res.json(settings);
});

router.get("/stats/dashboard", requireAdminToken, requireAdminToken, async (_req, res): Promise<void> => {
  const [totalAccountsRow] = await db.select({ value: count() }).from(accountsTable);
  const [availableRow] = await db.select({ value: count() }).from(accountsTable).where(eq(accountsTable.status, "available"));
  const [soldRow] = await db.select({ value: count() }).from(accountsTable).where(eq(accountsTable.status, "sold"));
  const [totalOrdersRow] = await db.select({ value: count() }).from(ordersTable);
  const [pendingRow] = await db.select({ value: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));

  const deliveredOrders = await db.select({ amount: ordersTable.amount }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
  const totalRevenue = deliveredOrders.reduce((s, r) => s + (r.amount ?? 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = await db.select({ amount: ordersTable.amount, deliveredAt: ordersTable.deliveredAt }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
  const todayRevenue = todayOrders.filter((r) => r.deliveredAt && r.deliveredAt >= today).reduce((s, r) => s + (r.amount ?? 0), 0);

  const stats = {
    totalAccounts: totalAccountsRow.value,
    availableAccounts: availableRow.value,
    soldAccounts: soldRow.value,
    totalOrders: totalOrdersRow.value,
    pendingOrders: pendingRow.value,
    totalRevenue,
    todayRevenue,
  };

  res.json(stats);
});

router.get("/stats/recent-orders", requireAdminToken, requireAdminToken, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: ordersTable.id,
      telegramUserId: ordersTable.telegramUserId,
      telegramUsername: ordersTable.telegramUsername,
      accountId: ordersTable.accountId,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      amount: ordersTable.amount,
      paymentId: ordersTable.paymentId,
      deliveredAt: ordersTable.deliveredAt,
      createdAt: ordersTable.createdAt,
      accountPhone: accountsTable.phone,
      accountFileName: accountsTable.fileName,
    })
    .from(ordersTable)
    .leftJoin(accountsTable, eq(ordersTable.accountId, accountsTable.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  res.json(rows);
});

router.get("/bot/settings", requireAdminToken, async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(botSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(botSettingsTable).values({}).returning();
  }
  res.json(settings);
});

router.patch("/bot/settings", requireAdminToken, async (req, res): Promise<void> => {
  const body = req.body as Partial<Record<string, unknown>>;
  let [settings] = await db.select().from(botSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(botSettingsTable).values({}).returning();
  }
  const [updated] = await db
    .update(botSettingsTable)
    .set({ ...body, createdAt: settings.createdAt })
    .where(eq(botSettingsTable.id, settings.id))
    .returning();
  res.json(updated);
});

export default router;
