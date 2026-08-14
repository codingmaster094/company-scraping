import fs from "fs";
import path from "path";

export function isCloudHost(): boolean {
  return (
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RAILWAY_ENVIRONMENT)
  );
}

/** Local CAPTCHA window stays headed. Render/Linux has no display. */
export function useHeadlessChrome(): boolean {
  if (process.env.PUPPETEER_HEADLESS === "false") return false;
  if (process.env.PUPPETEER_HEADLESS === "true") return true;
  return isCloudHost();
}

function findChromeFile(root: string, depth = 0): string | undefined {
  if (!root || depth > 8 || !fs.existsSync(root)) return undefined;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isFile() && /^(chrome|chrome\.exe|chromium|chromium-browser)$/i.test(ent.name)) {
      return full;
    }
    if (ent.isDirectory()) {
      const nested = findChromeFile(full, depth + 1);
      if (nested) return nested;
    }
  }
  return undefined;
}

function cachedChromeRoots(): string[] {
  const cwd = process.cwd();
  return [
    process.env.PUPPETEER_CACHE_DIR,
    path.join(cwd, ".cache", "puppeteer"),
    path.join(cwd, "node_modules", ".cache", "puppeteer"),
    path.join(process.env.HOME || "", ".cache", "puppeteer"),
    "/opt/render/project/src/.cache/puppeteer",
    "/opt/render/.cache/puppeteer",
  ].filter((p): p is string => Boolean(p));
}

export function resolveChromeExecutable(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/lib/chromium/chromium",
    "/usr/bin/microsoft-edge",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  for (const root of cachedChromeRoots()) {
    const found = findChromeFile(root);
    if (found) return found;
  }

  try {
    const bundled = require("puppeteer").executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    /* not installed yet */
  }
  return undefined;
}

export function puppeteerLaunchArgs(extra: string[] = []): string[] {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
    "--lang=en-US,en",
    "--no-first-run",
    "--no-default-browser-check",
    ...extra,
  ];
}
