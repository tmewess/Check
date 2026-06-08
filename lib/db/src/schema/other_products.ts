import { pgTable, text, serial, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const otherProductsTable = pgTable("other_products", {
  id: serial("id").primaryKey(),
  socialNetwork: text("social_network").notNull(),
  login: text("login"),
  password: text("password"),
  email: text("email"),
  emailPassword: text("email_password"),
  description: text("description"),
  deliveryDescription: text("delivery_description"),
  price: doublePrecision("price").notNull().default(0),
  isFree: text("is_free").notNull().default("false"),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  soldAt: timestamp("sold_at", { withTimezone: true }),
});

export type OtherProduct = typeof otherProductsTable.$inferSelect;
