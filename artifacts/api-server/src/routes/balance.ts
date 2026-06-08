import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userBalancesTable, accountsTable, ordersTable, botSettingsTable, telegramSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const BOT_TOKEN = process.env["BOT_TOKEN"];

async function createTelegramInvoiceLink(params: {
  title: string;
  description: string;
  payload: string;
  currency: string;
  amount: number;
}) {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN not configured");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`;
  const body = {
    title: params.title,
    description: params.description,
    payload: params.payload,
    provider_token: "",
    currency: params.currency,
    prices: [{ label: "Stars", amount: params.amount }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok: boolean; result?: string; description?: string };
  if (!data.ok) throw new Error(data.description ?? "Failed to create invoice link");
  return data.result!;
}

async function createCryptoBotInvoice(token: string, params: {
  amount: string;
  currency_type: string;
  fiat?: string;
  payload: string;
}) {
  const res = await fetch("https://pay.crypt.bot/api/createInvoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": token,
    },
    body: JSON.stringify({
      currency_type: params.currency_type,
      fiat: params.fiat,
      amount: params.amount,
      payload: params.payload,
      allow_comments: false,
      allow_anonymous: false,
    }),
  });
  const data = await res.json() as { ok: boolean; result?: { invoice_id: number; bot_invoice_url: string; mini_app_invoice_url?: string }; error?: { name: string; code: number } };
  if (!data.ok) throw new Error(data.error?.name ?? "Failed to create Crypto Bot invoice");
  return data.result!;
}

router.get("/balance/:userId", async (req, res): Promise<void> => {
  const userId = req.params.userId;
  const [row] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, userId));
  res.json({ balance: row?.balance ?? 0 });
});

router.post("/balance/topup", async (req, res): Promise<void> => {
  const { telegramUserId, amount } = req.body as { telegramUserId?: string; amount?: number };
  if (!telegramUserId || !amount || amount < 1) {
    res.status(400).json({ error: "Minimum topup is 1 Star" });
    return;
  }
  res.json({
    success: true,
    telegramUserId,
    amount,
    payload: JSON.stringify({ type: "balance_topup", telegramUserId, amount }),
  });
});

router.post("/balance/topup-invoice", async (req, res): Promise<void> => {
  const { telegramUserId, amount } = req.body as { telegramUserId?: string; amount?: number };
  if (!telegramUserId || !amount || amount < 1) {
    res.status(400).json({ error: "Minimum topup is 1 Star" });
    return;
  }
  try {
    const payload = JSON.stringify({ type: "balance_topup", telegramUserId, amount });
    const invoiceUrl = await createTelegramInvoiceLink({
      title: "Пополнение баланса",
      description: `Пополнение баланса на ${amount} Stars`,
      payload,
      currency: "XTR",
      amount,
    });
    res.json({ success: true, invoiceUrl, payload });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create invoice";
    res.status(503).json({ error: message });
  }
});

router.post("/balance/crypto-topup", async (req, res): Promise<void> => {
  const { telegramUserId, amount } = req.body as { telegramUserId?: string; amount?: number };
  if (!telegramUserId || !amount || amount < 1) {
    res.status(400).json({ error: "Сумма обязательна (минимум 1)" });
    return;
  }
  try {
    const [settings] = await db.select().from(botSettingsTable).limit(1);
    const cryptoToken = settings?.cryptoBotToken;
    if (!cryptoToken) {
      res.status(503).json({ error: "Crypto Bot не настроен. Укажите токен в Настройках панели." });
      return;
    }
    const payload = JSON.stringify({ type: "crypto_topup", telegramUserId, stars: amount });
    const invoice = await createCryptoBotInvoice(cryptoToken, {
      currency_type: "fiat",
      fiat: "RUB",
      amount: (amount * 0.5).toFixed(2),
      payload,
    });
    res.json({ success: true, invoiceUrl: invoice.mini_app_invoice_url ?? invoice.bot_invoice_url, invoiceId: invoice.invoice_id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create Crypto Bot invoice";
    logger.error({ err: e }, "crypto-topup failed");
    res.status(503).json({ error: message });
  }
});

router.post("/balance/crypto-webhook", async (req, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(botSettingsTable).limit(1);
    const cryptoToken = settings?.cryptoBotToken;

    const secret = req.headers["crypto-pay-api-token"] as string | undefined;
    if (!secret || secret !== cryptoToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as { update_type?: string; payload?: { invoice?: { status?: string; payload?: string } } };
    if (body.update_type !== "invoice_paid") {
      res.json({ ok: true });
      return;
    }

    const invoice = body.payload?.invoice;
    if (!invoice || invoice.status !== "paid" || !invoice.payload) {
      res.json({ ok: true });
      return;
    }

    let data: { type?: string; telegramUserId?: string; stars?: number } = {};
    try { data = JSON.parse(invoice.payload); } catch { res.json({ ok: true }); return; }

    if (data.type !== "crypto_topup" || !data.telegramUserId || !data.stars) {
      res.json({ ok: true });
      return;
    }

    const { telegramUserId, stars } = data;
    const [existing] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, telegramUserId));
    if (existing) {
      await db.update(userBalancesTable)
        .set({ balance: existing.balance + stars, updatedAt: new Date() })
        .where(eq(userBalancesTable.telegramUserId, telegramUserId));
    } else {
      await db.insert(userBalancesTable).values({ telegramUserId, balance: stars });
    }

    logger.info({ telegramUserId, stars }, "Crypto Bot payment credited");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "crypto-webhook error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/balance/purchase", async (req, res): Promise<void> => {
  const { telegramUserId, telegramUsername, accountId } = req.body as {
    telegramUserId?: string;
    telegramUsername?: string;
    accountId?: number;
  };
  if (!telegramUserId || !accountId) {
    res.status(400).json({ error: "telegramUserId and accountId required" });
    return;
  }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account || account.status !== "available") {
    res.status(400).json({ error: "Account not available" });
    return;
  }

  const isFree = account.isFree === "true" || account.price === 0;

  if (!isFree) {
    const [balance] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, telegramUserId));
    const currentBalance = balance?.balance ?? 0;
    if (currentBalance < account.price) {
      res.status(400).json({ error: "Insufficient balance", required: account.price, current: currentBalance });
      return;
    }

    const newBalance = currentBalance - account.price;
    await db
      .update(userBalancesTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(userBalancesTable.telegramUserId, telegramUserId));
  }

  const [order] = await db.insert(ordersTable).values({
    telegramUserId,
    telegramUsername: telegramUsername ?? null,
    accountId: account.id,
    status: "paid",
    paymentMethod: isFree ? "free" : "balance",
    amount: isFree ? 0 : account.price,
  }).returning();

  await db.update(accountsTable).set({ status: "sold", soldAt: new Date() }).where(eq(accountsTable.id, accountId));
  await db.update(ordersTable).set({ status: "delivered", deliveredAt: new Date() }).where(eq(ordersTable.id, order.id));

  // Fetch session data if account has one
  let sessionData: { phone: string | null; password: string | null; firstName: string | null } | null = null;
  if (account.sessionId) {
    const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, account.sessionId));
    if (session) {
      sessionData = { phone: session.phone ?? null, password: session.password ?? null, firstName: session.firstName ?? null };
    }
  }

  res.json({ success: true, orderId: order.id, account: { ...account, sessionData } });
});

export default router;
