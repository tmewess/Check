import { requireAdminToken } from "../middleware/auth";
import { Router } from "express";
import { db, proxiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/proxies", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const proxies = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);
    res.json(proxies);
  } catch (err) {
    logger.error({ err }, "Failed to list proxies");
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/proxies", requireAdminToken, async (req, res): Promise<void> => {
  const { ip, port, username, password } = req.body as {
    ip?: string;
    port?: string;
    username?: string;
    password?: string;
  };

  if (!ip || !port) {
    res.status(400).json({ error: "IP и порт обязательны" });
    return;
  }

  try {
    const [proxy] = await db
      .insert(proxiesTable)
      .values({ ip, port, username: username || null, password: password || null })
      .returning();
    res.json({ success: true, proxy });
  } catch (err) {
    logger.error({ err }, "Failed to create proxy");
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/proxies/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(proxiesTable).where(eq(proxiesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete proxy");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
