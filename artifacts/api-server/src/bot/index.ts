import { Bot, InlineKeyboard, InputFile } from "grammy";
import fs from "fs";
import { eq, desc } from "drizzle-orm";
import { db, accountsTable, ordersTable, botSettingsTable, userBalancesTable, newsTable, telegramSessionsTable, adminsTable, usersTable } from "@workspace/db";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { logger } from "../lib/logger";
import { fetchLolzConfirmCode, downloadLolzFile, resetLolzSessions } from "../routes/lolz";
import { getNextProxy, buildProxyConfig } from "../lib/proxy-manager";

let bot: Bot | null = null;

async function isSubscribed(userId: number, channelUsername: string): Promise<boolean> {
  if (!bot) return true;
  try {
    const member = await bot.api.getChatMember(channelUsername.startsWith("@") ? channelUsername : `@${channelUsername}`, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return true;
  }
}

async function requireSubscription(ctx: any, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) { await next(); return; }
  if (await isAdmin(ctx.from.id)) { await next(); return; }

  const settings = await getBotSettings();

  if (settings.maintenanceMode) {
    try {
      await ctx.reply(settings.maintenanceMessage || "🔧 Технические работы. Скоро вернёмся!");
    } catch {}
    return;
  }

  if (settings.requireSubscription && settings.subscriptionChannel) {
    const ok = await isSubscribed(ctx.from.id, settings.subscriptionChannel);
    if (!ok) {
      const channelLink = settings.subscriptionChannel.startsWith("http")
        ? settings.subscriptionChannel
        : `https://t.me/${settings.subscriptionChannel.replace("@", "")}`;
      const kb = new InlineKeyboard().url("📢 Подписаться на канал", channelLink);
      try {
        await ctx.reply(
          "⚠️ *Для использования бота необходима подписка на наш канал.*\n\nПодпишитесь и нажмите /start снова.",
          { parse_mode: "Markdown", reply_markup: kb }
        );
      } catch {}
      return;
    }
  }

  await next();
}

function getShopUrl(): string {
  if (process.env["SHOP_URL"]) return process.env["SHOP_URL"];
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) return `https://${domain}/tg-shop/`;
  logger.warn("SHOP_URL not set and no Replit domain found — bot buttons will use placeholder URL");
  return "https://example.com/tg-shop/";
}

function getAdminUrl(): string {
  if (process.env["ADMIN_URL"]) return process.env["ADMIN_URL"];
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) return `https://${domain}/admin-panel/`;
  logger.warn("ADMIN_URL not set and no Replit domain found — admin button will use placeholder URL");
  return "https://example.com/admin-panel/";
}

async function isAdmin(userId?: number): Promise<boolean> {
  if (!userId) return false;
  const adminId = process.env["ADMIN_TELEGRAM_ID"];
  if (String(userId) === adminId) return true;
  try {
    const [row] = await db.select().from(adminsTable).where(eq(adminsTable.telegramUserId, String(userId)));
    if (row) return true;
  } catch {}
  return false;
}

async function getBotSettings() {
  let [settings] = await db.select().from(botSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(botSettingsTable).values({}).returning();
  }
  return settings;
}

async function addToBalance(telegramUserId: string, amount: number) {
  const [existing] = await db.select().from(userBalancesTable).where(eq(userBalancesTable.telegramUserId, telegramUserId));
  if (existing) {
    await db
      .update(userBalancesTable)
      .set({ balance: existing.balance + amount, updatedAt: new Date() })
      .where(eq(userBalancesTable.telegramUserId, telegramUserId));
  } else {
    await db.insert(userBalancesTable).values({ telegramUserId, balance: amount }).returning();
  }
}

async function notifyAdmin(text: string) {
  const adminId = process.env["ADMIN_TELEGRAM_ID"];
  if (!bot || !adminId) return;
  try {
    await bot.api.sendMessage(adminId, text, { parse_mode: "Markdown" });
  } catch (err) {
    logger.warn({ err }, "Failed to notify admin");
  }
}

async function buildMainKeyboard(settings: Awaited<ReturnType<typeof getBotSettings>>, userId?: number) {
  const shopUrl = getShopUrl();

  // Build rows array
  const rows: any[] = [
    [InlineKeyboard.webApp("Открыть магазин", shopUrl)],
  ];

  if (await isAdmin(userId)) {
    const adminUrl = getAdminUrl();
    rows.push([InlineKeyboard.webApp("Админ панель", adminUrl)]);
  }

  // Notifications toggle
  if (userId) {
    let enabled = false;
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramUserId, String(userId)));
      enabled = user?.notificationsEnabled ?? false;
    } catch {}
    rows.push([InlineKeyboard.text(
      enabled ? "✅ Уведомления включены" : "❌ Уведомления выключены",
      `toggle_notifications_${userId}`
    )]);
  }

  if (settings.supportUsername) {
    rows.push([InlineKeyboard.url("Поддержка", `https://t.me/${settings.supportUsername}`)]);
  }

  return InlineKeyboard.from(rows);
}

export async function startBot() {
  const token = process.env["BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, bot will not start");
    return;
  }

  bot = new Bot(token);

  bot.command("start", requireSubscription, async (ctx) => {
    if (ctx.from) {
      try {
        await db.insert(usersTable).values({
          telegramUserId: String(ctx.from.id),
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name ?? null,
          lastName: ctx.from.last_name ?? null,
          lastSeenAt: new Date(),
        }).onConflictDoUpdate({
          target: usersTable.telegramUserId,
          set: {
            username: ctx.from.username ?? null,
            firstName: ctx.from.first_name ?? null,
            lastName: ctx.from.last_name ?? null,
            lastSeenAt: new Date(),
          },
        });
      } catch (err) {
        logger.warn({ err }, "Failed to upsert user on /start");
      }
    }

    const settings = await getBotSettings();
    const userId = ctx.from?.id;
    const keyboard = await buildMainKeyboard(settings, userId);

    try {
      await ctx.replyWithSticker("CAACAgQAAxkBAAFLp-hqJBeFIbbMZ4jdPZz61RfovlEJqAACXRkAAljwgVGu26mijdyWvDsE");
    } catch {}

    const welcomeText =
      `Добро пожаловать в <b>Void Account!</b> <tg-emoji emoji-id='5893185207355315979'>🔥</tg-emoji>\n\n` +
      `Качественные аккаунты популярных сервисов с мгновенной выдачей. Наш сервис - это сочетание надёжности, доступных цен и круглосуточной поддержки.\n\n` +
      `<tg-emoji emoji-id='5258024802010026053'>🛒</tg-emoji> <b>Наши преимущества:</b>\n\n` +
      `<blockquote>` +
      `<tg-emoji emoji-id='5339113303522161846'>⚪</tg-emoji> <b>Автовыдача 24/7</b>\n` +
      `<tg-emoji emoji-id='5339113303522161846'>⚪</tg-emoji> <b>Большой выбор аккаунтов Telegram и других популярных сервисов.</b>\n` +
      `<tg-emoji emoji-id='5339113303522161846'>⚪</tg-emoji> <b>Поддерживаем переводы через Crypto Bot и Telegram Stars.</b>\n` +
      `<tg-emoji emoji-id='5339113303522161846'>⚪</tg-emoji> <b>Оперативно ответим на все ваши вопросы.</b>` +
      `</blockquote>\n\n` +
      `<tg-emoji emoji-id='5902449142575141204'>🔗</tg-emoji> <b>Полезные ссылки:</b>\n` +
      `<tg-emoji emoji-id='5893255507380014983'>💼</tg-emoji> Наш канал: @VoidAccs\n` +
      `<tg-emoji emoji-id='5895444149699612825'>📊</tg-emoji> Отзывы: @VoidRepp\n\n` +
      `<b>Выберите нужный пункт в меню ниже, чтобы начать работу</b> <tg-emoji emoji-id='5231102735817918643'>👇</tg-emoji>`;

    await ctx.reply(welcomeText, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("topup", requireSubscription, async (ctx) => {
    const args = ctx.message?.text?.split(" ") ?? [];
    const amount = args[1] ? parseInt(args[1], 10) : 50;
    if (isNaN(amount) || amount < 50) {
      await ctx.reply("Минимальное пополнение — 50 Stars. Используйте: /topup 100");
      return;
    }
    const userId = String(ctx.from?.id ?? "unknown");
    const payload = JSON.stringify({ type: "balance_topup", telegramUserId: userId, amount });
    try {
      await ctx.replyWithInvoice(
        "Stars Пополнение баланса",
        `Пополнение баланса на ${amount} Stars`,
        payload,
        "XTR",
        [{ label: "Баланс", amount }],
        { provider_token: "" }
      );
    } catch (err) {
      logger.error({ err }, "Failed to send topup invoice");
      await ctx.reply("Ошибка: Не удалось создать чек. Попробуйте позже.");
    }
  });

  bot.command("news", requireSubscription, async (ctx) => {
    try {
      const items = await db.select().from(newsTable).where(eq(newsTable.isActive, true)).orderBy(desc(newsTable.createdAt)).limit(5);
      if (items.length === 0) {
        await ctx.reply("Новостей пока нет. Заходите позже!");
        return;
      }
      let text = "*Новости VoidAccount*\n\n";
      for (const item of items) {
        text += `*\u2022 ${item.title}*\n${item.content}\n\n`;
      }
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error({ err }, "News command failed");
      await ctx.reply("Ошибка загрузки новостей.");
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    try {
      const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload) as { type?: string; accountId?: number };
      if (payload.type === "balance_topup") {
        await ctx.answerPreCheckoutQuery(true);
        return;
      }
      const accountId = payload.accountId;
      if (!accountId) {
        await ctx.answerPreCheckoutQuery(false, "Некорректный платёж.");
        return;
      }
      const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
      if (!account || account.status === "sold") {
        if (account?.status === "reserved") {
          await db.update(accountsTable).set({ status: "available" }).where(eq(accountsTable.id, accountId));
        }
        await ctx.answerPreCheckoutQuery(false, "Аккаунт уже продан. Выбери другой.");
        return;
      }
      await ctx.answerPreCheckoutQuery(true);
    } catch (err) {
      logger.error({ err }, "pre_checkout_query error");
      await ctx.answerPreCheckoutQuery(false, "Внутренняя ошибка. Попробуй позже.");
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const telegramUserId = String(ctx.from.id);
    const telegramUsername = ctx.from.username ?? null;
    const telegramName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");

    let payload: { type?: string; accountId?: number; amount?: number } = {};
    try {
      payload = JSON.parse(payment.invoice_payload);
    } catch {
      await ctx.reply("(!) Оплата получена, но не удалось определить заказ.");
      return;
    }

    if (payload.type === "balance_topup" && payload.amount) {
      await addToBalance(telegramUserId, payload.amount);
      await ctx.reply(`Готово! *Баланс пополнен!*\n\n+${payload.amount} Stars зачислены на ваш счёт.`, { parse_mode: "Markdown" });
      return;
    }

    const accountId = payload.accountId;
    if (!accountId) {
      await ctx.reply("(!) Оплата получена. Обратитесь в поддержку.");
      return;
    }

    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
    if (!account) {
      await ctx.reply("(!) Оплата получена, но аккаунт не найден.");
      return;
    }

    const [order] = await db.insert(ordersTable).values({
      telegramUserId,
      telegramUsername,
      accountId: account.id,
      status: "paid",
      paymentMethod: "stars",
      amount: account.price,
      paymentId: payment.telegram_payment_charge_id,
    }).returning();

    if (!order) {
      await ctx.reply("(!) Оплата получена, но не удалось создать заказ. Обратитесь в поддержку.");
      return;
    }

    await db.update(accountsTable).set({ status: "sold", soldAt: new Date() }).where(eq(accountsTable.id, accountId));
    await db.update(ordersTable).set({ status: "delivered", deliveredAt: new Date() }).where(eq(ordersTable.id, order.id));

    await notifyAdmin(
      `*Новый заказ #${order.id}!*\n\n` +
      `Покупатель: ${telegramName}${telegramUsername ? ` (@${telegramUsername})` : ""}\n` +
      `ID: \`${telegramUserId}\`\n` +
      `Аккаунт: ${account.phone ?? `#${account.id}`}\n` +
      `Сумма: ${account.price} Stars\n` +
      `Метод: Telegram Stars`
    );

    await ctx.reply(`Готово! *Оплата подтверждена!*\nStars получены. Заказ #${order.id}\n\nВыдаю аккаунт...`, { parse_mode: "Markdown" });
    await deliverAccount(ctx, account, order.id);
  });

  bot.command("refund", async (ctx) => {
    if (!await isAdmin(ctx.from?.id)) return;
    const args = ctx.message?.text?.split(" ") ?? [];
    const orderId = args[1] ? parseInt(args[1], 10) : null;
    if (!orderId || isNaN(orderId)) {
      await ctx.reply("Использование: /refund <order_id>");
      return;
    }
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) {
      await ctx.reply(`Ошибка: Заказ #${orderId} не найден.`);
      return;
    }
    if (!order.paymentId) {
      await ctx.reply(`Ошибка: У заказа #${orderId} нет payment_id для возврата.`);
      return;
    }
    if (order.status === "refunded") {
      await ctx.reply(`(!) Заказ #${orderId} уже возвращён.`);
      return;
    }
    try {
      await ctx.api.refundStarPayment(parseInt(order.telegramUserId, 10), order.paymentId);
      await db.update(ordersTable).set({ status: "refunded" }).where(eq(ordersTable.id, orderId));
      if (order.accountId) {
        await db.update(accountsTable).set({ status: "available", soldAt: null }).where(eq(accountsTable.id, order.accountId));
      }
      await ctx.reply(`Готово! Возврат Stars для заказа #${orderId} выполнен.`);
      try {
        await ctx.api.sendMessage(parseInt(order.telegramUserId, 10), `*Возврат Stars*\n\nПо заказу #${orderId} выполнен возврат ${order.amount} Stars.`, { parse_mode: "Markdown" });
      } catch {}
    } catch (err) {
      logger.error({ err }, "Refund failed");
      await ctx.reply(`Ошибка: Не удалось выполнить возврат: ${String(err)}`);
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("toggle_notifications_")) {
      const userId = ctx.from.id;
      try {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramUserId, String(userId)));
        if (!user) {
          await ctx.answerCallbackQuery({ text: "Пользователь не найден", show_alert: true });
          return;
        }
        const newValue = !user.notificationsEnabled;
        await db.update(usersTable)
          .set({ notificationsEnabled: newValue })
          .where(eq(usersTable.telegramUserId, String(userId)));

        await ctx.answerCallbackQuery({
          text: newValue ? "✅ Уведомления включены!" : "❌ Уведомления выключены",
          show_alert: false,
        });

        // Refresh keyboard to update button state
        const settings = await getBotSettings();
        const keyboard = await buildMainKeyboard(settings, userId);
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        } catch {}
      } catch (err) {
        logger.error({ err }, "toggle_notifications failed");
        await ctx.answerCallbackQuery({ text: "Ошибка", show_alert: true });
      }
      return;
    }

    if (data.startsWith("getcode_")) {
      const parts = data.split("_");
      const accountId = parseInt(parts[1] ?? "", 10);
      const buyerChatId = parseInt(parts[2] ?? "", 10);

      if (isNaN(accountId) || isNaN(buyerChatId)) {
        await ctx.answerCallbackQuery({ text: "Некорректные данные", show_alert: true });
        return;
      }

      if (ctx.from.id !== buyerChatId) {
        await ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery({ text: "⏳ Запрашиваю код из сессии..." });

      let client: TelegramClient | null = null;
      try {
        const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
        if (!account?.sessionId) {
          await ctx.api.sendMessage(buyerChatId, "❌ У этого аккаунта нет привязанной сессии.");
          return;
        }

        const [session] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.id, account.sessionId));
        if (!session?.sessionString) {
          await ctx.api.sendMessage(buyerChatId, "❌ Сессия не найдена.");
          return;
        }

        const [settings] = await db.select().from(botSettingsTable).limit(1);
        const apiId = settings?.tgApiId ? parseInt(settings.tgApiId, 10) : null;
        const apiHash = settings?.tgApiHash ?? null;

        if (!apiId || !apiHash) {
          await ctx.api.sendMessage(buyerChatId, "❌ API ID/Hash не настроены в панели. Обратитесь к поддержке.");
          return;
        }

        const proxy = await getNextProxy();
        client = new TelegramClient(new StringSession(session.sessionString), apiId, apiHash, {
          connectionRetries: 2,
          ...(proxy ? { proxy: buildProxyConfig(proxy) } : {}),
        });
        await client.connect();

        const messages = await client.getMessages(777000, { limit: 10 }) as any[];

        let code: string | null = null;
        for (const msg of messages) {
          const text: string = msg?.message ?? "";
          const match = text.match(/\b(\d{5,6})\b/);
          if (match) {
            code = match[1];
            break;
          }
        }

        if (code) {
          await ctx.api.sendMessage(buyerChatId, `🔑 *Код подтверждения:* \`${code}\`\n\nВведи его при входе в Telegram.`, { parse_mode: "Markdown" });
        } else {
          await ctx.api.sendMessage(buyerChatId, "❌ Код не найден в последних сообщениях. Попробуй войти в аккаунт — Telegram пришлёт код, затем нажми кнопку снова.");
        }
      } catch (err) {
        logger.error({ err }, "get-code callback failed");
        await ctx.api.sendMessage(buyerChatId, "❌ Ошибка при получении кода. Попробуй позже или обратись в поддержку.");
      } finally {
        await client?.disconnect().catch(() => {});
      }
      return;
    }
  });

  bot.catch((err) => {
    logger.error({ err: err.error, update: err.ctx.update }, "Bot error");
  });

  try {
    await bot.start({
      onStart: (info) => {
        logger.info({ username: info.username }, "Bot started");
      },
    });
  } catch (err: any) {
    if (err?.error_code === 401) {
      logger.warn("Bot token is invalid (401 Unauthorized). The server will continue running without the bot.");
    } else {
      logger.error({ err }, "Bot startup failed");
    }
  }

  logger.info("Telegram bot initialized");
}

async function deliverAccount(ctx: any, account: any, orderId: number) {
  const settings = await getBotSettings();

  if (account.lolzItemId) {
    const apiKey = settings.lolzApiKey;
    if (apiKey) {
      try {
        const lolzId = Number(account.lolzItemId);
        const codeRes = await fetchLolzConfirmCode(lolzId, apiKey);
        const resetRes = await resetLolzSessions(lolzId, apiKey);
        const filePath = await downloadLolzFile(account.lolzItemId, apiKey);

        let text = `Готово! *Заказ #${orderId} выполнен!*\n\n`;
        text += `*Данные аккаунта Telegram:*\n\n`;
        if (account.phone) text += `Номер: \`${account.phone}\`\n`;
        if (account.dcId) text += `DC ID: \`${account.dcId}\`\n`;
        if (account.userId) text += `User ID: \`${account.userId}\`\n`;
        if (account.authKey) text += `Auth Key: \`${account.authKey.slice(0, 16)}...\`\n`;
        if (account.country) text += `Страна: ${account.country}\n`;
        if (account.hasPassword && account.password) text += `Пароль 2FA: \`${account.password}\`\n`;

        if (codeRes.success && codeRes.code) {
          text += `\n*Код подтверждения:* \`${codeRes.code}\`\n`;
        }
        if (resetRes.success) {
          text += `Сессии сброшены.\n`;
        }
        text += `\n❓ Нужна помощь? /start`;

        const keyboard = new InlineKeyboard();
        if (account.sessionId) {
          const buyerChatId = ctx.from?.id ?? ctx.chat?.id ?? 0;
          keyboard.callbackData("🔑 Получить код", `getcode_${account.id}_${buyerChatId}`).row();
        }
        if (settings.supportUsername) {
          keyboard.url("Помощь", `https://t.me/${settings.supportUsername}`).row();
        }
        await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });

        if (filePath && fs.existsSync(filePath)) {
          const file = new InputFile(filePath, `tdata_${account.phone ?? account.id}.zip`);
          await ctx.replyWithDocument(file, {
            caption: `tdata — аккаунт ${account.phone ?? "#" + account.id}`,
          });
        }
        return;
      } catch (err) {
        logger.warn({ err }, "Auto-delivery failed, falling back to manual data");
      }
    }
  }

  if (account.filePath && fs.existsSync(account.filePath)) {
    const buyerChatId = ctx.from?.id ?? ctx.chat?.id ?? 0;
    const keyboard = new InlineKeyboard();
    if (account.sessionId) {
      keyboard.callbackData("🔑 Получить код", `getcode_${account.id}_${buyerChatId}`).row();
    }
    if (settings.supportUsername) {
      keyboard.url("Помощь", `https://t.me/${settings.supportUsername}`).row();
    }
    const file = new InputFile(account.filePath, account.fileName ?? "tdata.zip");
    await ctx.reply(
      `Готово! *Заказ #${orderId} выполнен!*\n\n` +
      `Аккаунт: \`${account.phone ?? "#" + account.id}\`\n` +
      `Файл \`tdata.zip\` во вложении ниже.\n` +
      `Распакуй и положи папку \`tdata\` в директорию Telegram Desktop.\n\n` +
      `❓ Нужна помощь? /start`,
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
    await ctx.replyWithDocument(file, {
      caption: `tdata — аккаунт ${account.phone ?? "#" + account.id}`,
    });
    return;
  }

  let text = `Готово! *Заказ #${orderId} выполнен!*\n\n*Данные аккаунта Telegram:*\n\n`;

  if (account.phone) text += `Номер: \`${account.phone}\`\n`;
  if (account.dcId) text += `DC ID: \`${account.dcId}\`\n`;
  if (account.userId) text += `User ID: \`${account.userId}\`\n`;
  if (account.authKey) text += `Auth Key: \`${account.authKey.slice(0, 16)}...\`\n`;
  if (account.country) text += `Страна: ${account.country}\n`;
  if (account.hasPassword && account.password) text += `Пароль 2FA: \`${account.password}\`\n`;

  text += `\n❓ Нужна помощь? /start`;

  const buyerChatId = ctx.from?.id ?? ctx.chat?.id ?? 0;
  const keyboard = new InlineKeyboard();
  if (account.sessionId) {
    keyboard.callbackData("🔑 Получить код", `getcode_${account.id}_${buyerChatId}`).row();
  }
  if (settings.supportUsername) {
    keyboard.url("Помощь", `https://t.me/${settings.supportUsername}`).row();
  }

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
}

export function getBot() {
  return bot;
}
