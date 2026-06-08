import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ExtractedSession {
  dcId: string;
  authKey: string;
  phone?: string;
  userId?: string;
  success: boolean;
  error?: string;
}

export function extractTdataSession(zipPath: string): ExtractedSession {
  try {
    const tempDir = path.join(process.cwd(), "uploads", "tdata", "tmp-" + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { timeout: 30000 });
    } catch {
      try {
        execSync(`python3 -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${tempDir}')"`, { timeout: 30000 });
      } catch {
        return { success: false, error: "Cannot extract zip", dcId: "", authKey: "" };
      }
    }

    const tdataPath = findTdataDir(tempDir);
    if (!tdataPath) {
      return { success: false, error: "tdata directory not found in zip", dcId: "", authKey: "" };
    }

    const keyFile = path.join(tdataPath, "key_datas");
    if (!fs.existsSync(keyFile)) {
      return { success: false, error: "key_datas not found", dcId: "", authKey: "" };
    }

    const dcId = extractDcId(tdataPath) ?? "2";
    const authKey = extractAuthKey(tdataPath) ?? "";

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    return { success: true, dcId, authKey };
  } catch (err: any) {
    return { success: false, error: String(err?.message ?? err), dcId: "", authKey: "" };
  }
}

function findTdataDir(dir: string): string | null {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item.toLowerCase() === "tdata") return fullPath;
      const deeper = findTdataDir(fullPath);
      if (deeper) return deeper;
    }
  }
  return null;
}

function extractDcId(tdataDir: string): string | null {
  try {
    const settingsPath = path.join(tdataDir, "settings");
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath);
      const str = data.toString("utf-8", 0, Math.min(data.length, 1024));
      const match = str.match(/dc(\d+)/i);
      if (match) return match[1];
    }
    const files = fs.readdirSync(tdataDir);
    for (const f of files) {
      if (f.startsWith("data") && f.includes("_")) {
        const parts = f.split("_");
        if (parts.length >= 2) {
          return parts[1].replace(/[^0-9]/g, "") || "2";
        }
      }
    }
    return "2";
  } catch {
    return "2";
  }
}

function extractAuthKey(tdataDir: string): string | null {
  try {
    const files = fs.readdirSync(tdataDir);
    const dataFiles = files.filter(f => f.startsWith("data") && f.includes("_"));
    if (dataFiles.length === 0) return null;
    const dataPath = path.join(tdataDir, dataFiles[0]);
    const data = fs.readFileSync(dataPath);
    const authKeyBuffer = data.subarray(24, 256);
    if (authKeyBuffer.length >= 32) {
      return authKeyBuffer.toString("hex");
    }
    return null;
  } catch {
    return null;
  }
}
