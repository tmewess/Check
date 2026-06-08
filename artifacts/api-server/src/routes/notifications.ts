import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getBot } from "../bot/index";
import { logger } from "../lib/logger";

const router = Router();

// Get users with notifications enabled
router.get("/notifications/subscribers", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.notificationsEnabled, true));
    res.json(users);
  } catch (err) {
    logger.error({ err }, "Failed to get notification subscribers");
    res.status(500).json({ error: "DB error" });
  }
});

// Send notification to all subscribers
router.post("/notifications/send", requireAdminToken, async (req, res): Promise<void> => {
  const { text, shopUrl } = req.body as { text?: string; shopUrl?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text обязателен" });
    return;
  }

  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: "Бот не запущен" });
    return;
  }

  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.notificationsEnabled, true));

    if (users.length === 0) {
      res.json({ success: true, sent: 0, failed: 0 });
      return;
    }

    const url = shopUrl || process.env["SHOP_URL"] || "https://example.com/tg-shop/";

    const { InlineKeyboard } = await import("grammy");
    const keyboard = new InlineKeyboard().webApp("🛍 Открыть каталог", url);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await bot.api.sendMessage(parseInt(user.telegramUserId, 10), text, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
        sent++;
        // Avoid hitting rate limits
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        logger.warn({ err, userId: user.telegramUserId }, "Failed to send notification to user");
        failed++;
      }
    }

    res.json({ success: true, sent, failed, total: users.length });
  } catch (err) {
    logger.error({ err }, "Failed to send notifications");
    res.status(500).json({ error: "Ошибка при отправке" });
  }
});

// Toggle notifications for a user (called from bot)
router.post("/notifications/toggle/:telegramUserId", requireAdminToken, async (req, res): Promise<void> => {
  const { telegramUserId } = req.params;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramUserId, telegramUserId));
    if (!user) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    const newValue = !user.notificationsEnabled;
    await db.update(usersTable)
      .set({ notificationsEnabled: newValue })
      .where(eq(usersTable.telegramUserId, telegramUserId));
    res.json({ success: true, notificationsEnabled: newValue });
  } catch (err) {
    logger.error({ err }, "Failed to toggle notifications");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
