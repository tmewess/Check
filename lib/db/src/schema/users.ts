import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  telegramUserId: text("telegram_user_id").notNull().primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
});

export type User = typeof usersTable.$inferSelect;
