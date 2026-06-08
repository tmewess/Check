import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Strips sensitive fields from account objects — only safe public data
const SAFE_ACCOUNT_FIELDS = new Set([
  "id", "country", "dcId", "userId", "price", "isFree",
  "hasPremium", "hasPassword", "spamBlock", "description",
  "status", "createdAt", "lolzItemId", "sessionId",
  "registrationDate", "origin", "lastActivity", "phonePrefix",
]);

export function stripSensitive(account: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(account)) {
    if (SAFE_ACCOUNT_FIELDS.has(k)) safe[k] = v;
  }
  return safe;
}

function getJwtSecret(): string | null {
  return process.env["SESSION_SECRET"] ?? null;
}

function verifyToken(req: Request): boolean {
  const authHeader = req.headers.authorization ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const headerToken = req.headers["x-admin-token"] as string | undefined;
  const token = bearerToken || headerToken || "";

  if (!token) return false;

  // Try JWT verification
  const secret = getJwtSecret();
  if (secret) {
    try {
      const decoded = jwt.verify(token, secret) as any;
      if (decoded?.role === "admin") return true;
    } catch {}
  }

  return false;
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (verifyToken(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized — admin access required" });
}

export function isAdmin(req: Request): boolean {
  return verifyToken(req);
}
