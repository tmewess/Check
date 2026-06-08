import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "bot_settings" (
        "id" serial PRIMARY KEY,
        "bot_token" text NOT NULL DEFAULT '',
        "welcome_message" text NOT NULL DEFAULT 'Добро пожаловать! Здесь вы можете купить аккаунты Telegram.',
        "support_username" text,
        "payment_yookassa_enabled" boolean NOT NULL DEFAULT false,
        "yookassa_shop_id" text,
        "yookassa_secret_key" text,
        "payment_stars_enabled" boolean NOT NULL DEFAULT false,
        "payment_crypto_enabled" boolean NOT NULL DEFAULT false,
        "crypto_bot_token" text,
        "lolz_api_key" text,
        "tg_api_id" text,
        "tg_api_hash" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" serial PRIMARY KEY,
        "phone" text,
        "country" text NOT NULL DEFAULT '',
        "phone_prefix" text,
        "dc_id" text,
        "user_id" text,
        "auth_key" text,
        "description" text,
        "status" text NOT NULL DEFAULT 'available',
        "price" double precision NOT NULL DEFAULT 0,
        "is_free" text NOT NULL DEFAULT 'false',
        "has_premium" boolean NOT NULL DEFAULT false,
        "has_password" boolean NOT NULL DEFAULT false,
        "password" text,
        "spam_block" text,
        "registration_date" text,
        "origin" text,
        "file_path" text,
        "file_name" text,
        "lolz_item_id" text,
        "last_activity" text,
        "session_id" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "sold_at" timestamptz
      );
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" serial PRIMARY KEY,
        "telegram_user_id" text NOT NULL,
        "telegram_username" text,
        "account_id" integer,
        "status" text NOT NULL DEFAULT 'pending',
        "payment_method" text,
        "amount" integer NOT NULL DEFAULT 0,
        "payment_id" text,
        "delivered_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "user_balances" (
        "id" serial PRIMARY KEY,
        "telegram_user_id" text NOT NULL UNIQUE,
        "balance" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "telegram_sessions" (
        "id" serial PRIMARY KEY,
        "phone" text UNIQUE,
        "session_string" text,
        "dc_id" text,
        "auth_key" text,
        "country" text,
        "user_id" text,
        "first_name" text,
        "status" text NOT NULL DEFAULT 'pending',
        "phone_code_hash" text,
        "password" text,
        "file_path" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "news" (
        "id" serial PRIMARY KEY,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" serial PRIMARY KEY,
        "telegram_user_id" text NOT NULL UNIQUE,
        "username" text,
        "login_username" text,
        "login_password" text,
        "added_at" timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "phone_prefix" text;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "description" text;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "is_free" text NOT NULL DEFAULT 'false';
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "has_premium" boolean NOT NULL DEFAULT false;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "spam_block" text;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "registration_date" text;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "origin" text;
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "last_activity" text;
      ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
      CREATE TABLE IF NOT EXISTS "users" (
        "telegram_user_id" text NOT NULL PRIMARY KEY,
        "username" text,
        "first_name" text,
        "last_name" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "other_products" (
        "id" serial PRIMARY KEY,
        "social_network" text NOT NULL,
        "login" text,
        "password" text,
        "email" text,
        "email_password" text,
        "description" text,
        "delivery_description" text,
        "price" double precision NOT NULL DEFAULT 0,
        "is_free" text NOT NULL DEFAULT 'false',
        "status" text NOT NULL DEFAULT 'available',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "sold_at" timestamptz
      );
      CREATE TABLE IF NOT EXISTS "proxies" (
        "id" serial PRIMARY KEY,
        "ip" text NOT NULL,
        "port" text NOT NULL,
        "username" text,
        "password" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "promo_codes" (
        "id" serial PRIMARY KEY,
        "code" text NOT NULL UNIQUE,
        "discount_type" text NOT NULL DEFAULT 'fixed',
        "discount_value" double precision NOT NULL DEFAULT 0,
        "usage_limit" integer,
        "used_count" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "faq_items" (
        "id" serial PRIMARY KEY,
        "question" text NOT NULL,
        "answer" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'available';
      ALTER TABLE "bot_settings" ADD COLUMN IF NOT EXISTS "require_subscription" boolean NOT NULL DEFAULT false;
      ALTER TABLE "bot_settings" ADD COLUMN IF NOT EXISTS "subscription_channel" text;
      ALTER TABLE "bot_settings" ADD COLUMN IF NOT EXISTS "maintenance_mode" boolean NOT NULL DEFAULT false;
      ALTER TABLE "bot_settings" ADD COLUMN IF NOT EXISTS "maintenance_message" text NOT NULL DEFAULT '🔧 Технические работы. Скоро вернёмся!';
    `);

    // Run ALTER TABLE migrations separately so each one is independent
    const alterMigrations = [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_enabled" boolean NOT NULL DEFAULT false`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "other_product_id" integer`,
      `ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "session_id" integer`,
      `ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "first_name" text`,
      `ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "password" text`,
      `ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "file_path" text`,
    ];

    for (const sql of alterMigrations) {
      try {
        await client.query(sql);
      } catch (err: any) {
        // Log but continue — column may already exist or table may differ
        logger.warn({ err: err?.message }, `Migration step skipped: ${sql.slice(0, 60)}`);
      }
    }
    logger.info("Database migrations completed.");
  } catch (err) {
    logger.error({ err }, "Migration failed");
  } finally {
    client.release();
  }
}

runMigrations().then(() => {
  if (!process.env["ADMIN_API_TOKEN"]) {
    logger.error("⚠️  ADMIN_API_TOKEN not set! All admin API routes are BLOCKED. Set this env variable immediately.");
  } else {
    logger.info("Admin API token configured ✅");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });

  startBot().catch((err) => {
    logger.error({ err }, "Bot startup error");
  });
});