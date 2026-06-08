import { db, proxiesTable } from "@workspace/db";

let proxyIndex = 0;

export async function getNextProxy() {
  const proxies = await db.select().from(proxiesTable).orderBy(proxiesTable.id);
  if (proxies.length === 0) return undefined;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  return proxy;
}

export function buildProxyConfig(proxy: { ip: string; port: string; username?: string | null; password?: string | null }) {
  return {
    socksType: 5 as const,
    ip: proxy.ip,
    port: parseInt(proxy.port, 10),
    ...(proxy.username ? { username: proxy.username } : {}),
    ...(proxy.password ? { password: proxy.password } : {}),
  };
}
