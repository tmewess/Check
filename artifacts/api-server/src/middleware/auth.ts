import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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

function getSecret(): string {
  return process.env["SESSION_SECRET"] ?? "fallback-secret";
}

function verifyJWT(req: Request): boolean {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, getSecret()) as any;
    return decoded?.role === "admin";
  } catch {
    return false;
  }
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (verifyJWT(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

export function isAdmin(req: Request): boolean {
  return verifyJWT(req);
}
