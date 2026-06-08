import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const proxiesTable = pgTable("proxies", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  port: text("port").notNull(),
  username: text("username"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Proxy = typeof proxiesTable.$inferSelect;
