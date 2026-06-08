import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  telegramUserId: text("telegram_user_id").primaryKey(),
  username: text("username"),
  loginUsername: text("login_username"),
  loginPassword: text("login_password"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Admin = typeof adminsTable.$inferSelect;
