import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security: restrict CORS to known origins only
const ALLOWED_ORIGINS = [
  process.env["SHOP_URL"]?.replace(/\/$/, ""),
  process.env["ADMIN_URL"]?.replace(/\/$/, ""),
  // Render domains
  /https:\/\/.*\.onrender\.com$/,
  // Telegram WebApp
  "https://web.telegram.org",
  // Local dev
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Telegram bot)
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    if (allowed) return callback(null, true);
    callback(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Rate limiting — simple in-memory (no extra deps needed)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute per IP

app.use((req: Request, res: Response, next: NextFunction) => {
  // Only rate-limit API routes
  if (!req.path.startsWith("/api")) return next();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }
  next();
});

// Stricter rate limit for sensitive endpoints
const sensitiveRateMap = new Map<string, { count: number; resetAt: number }>();
const SENSITIVE_LIMIT = 10; // 10 per minute for auth/purchase

app.use((req: Request, res: Response, next: NextFunction) => {
  const sensitive = ["/api/auth/login", "/api/balance/purchase", "/api/promo/apply"];
  if (!sensitive.some(p => req.path.startsWith(p))) return next();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = sensitiveRateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    sensitiveRateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  entry.count++;
  if (entry.count > SENSITIVE_LIMIT) {
    res.status(429).json({ error: "Too many attempts. Please wait." });
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

if (!process.env["REPLIT_DEV_DOMAIN"]) {
  const distBase = path.join(__dirname, "..", "..");

  const tgShopDist = path.join(distBase, "tg-shop", "dist", "public");
  const adminPanelDist = path.join(distBase, "admin-panel", "dist", "public");

  if (fs.existsSync(tgShopDist)) {
    app.use("/tg-shop", express.static(tgShopDist));
    app.get("/tg-shop/*path", (_req, res) => {
      res.sendFile(path.join(tgShopDist, "index.html"));
    });
    logger.info({ tgShopDist }, "Serving tg-shop static files");
  } else {
    logger.warn({ tgShopDist }, "tg-shop dist not found — run build first");
  }

  if (fs.existsSync(adminPanelDist)) {
    app.use("/admin-panel", express.static(adminPanelDist));
    app.get("/admin-panel/*path", (_req, res) => {
      res.sendFile(path.join(adminPanelDist, "index.html"));
    });
    logger.info({ adminPanelDist }, "Serving admin-panel static files");
  } else {
    logger.warn({ adminPanelDist }, "admin-panel dist not found — run build first");
  }
}

export default app;
