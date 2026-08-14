"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCloudHost = isCloudHost;
exports.useHeadlessChrome = useHeadlessChrome;
exports.resolveChromeExecutable = resolveChromeExecutable;
exports.puppeteerLaunchArgs = puppeteerLaunchArgs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function isCloudHost() {
    return (process.env.RENDER === "true" ||
        Boolean(process.env.RENDER_SERVICE_ID) ||
        Boolean(process.env.RAILWAY_ENVIRONMENT));
}
/** Local CAPTCHA window stays headed. Render/Linux has no display. */
function useHeadlessChrome() {
    if (process.env.PUPPETEER_HEADLESS === "false")
        return false;
    if (process.env.PUPPETEER_HEADLESS === "true")
        return true;
    return isCloudHost();
}
function findChromeFile(root, depth = 0) {
    if (!root || depth > 8 || !fs_1.default.existsSync(root))
        return undefined;
    let entries = [];
    try {
        entries = fs_1.default.readdirSync(root, { withFileTypes: true });
    }
    catch (_a) {
        return undefined;
    }
    for (const ent of entries) {
        const full = path_1.default.join(root, ent.name);
        if (ent.isFile() && /^(chrome|chrome\.exe|chromium|chromium-browser)$/i.test(ent.name)) {
            return full;
        }
        if (ent.isDirectory()) {
            const nested = findChromeFile(full, depth + 1);
            if (nested)
                return nested;
        }
    }
    return undefined;
}
function cachedChromeRoots() {
    const cwd = process.cwd();
    return [
        process.env.PUPPETEER_CACHE_DIR,
        path_1.default.join(cwd, ".cache", "puppeteer"),
        path_1.default.join(cwd, "node_modules", ".cache", "puppeteer"),
        path_1.default.join(process.env.HOME || "", ".cache", "puppeteer"),
        "/opt/render/project/src/.cache/puppeteer",
        "/opt/render/.cache/puppeteer",
    ].filter((p) => Boolean(p));
}
function resolveChromeExecutable() {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs_1.default.existsSync(envPath))
        return envPath;
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
        if (fs_1.default.existsSync(p))
            return p;
    }
    for (const root of cachedChromeRoots()) {
        const found = findChromeFile(root);
        if (found)
            return found;
    }
    try {
        const bundled = require("puppeteer").executablePath();
        if (bundled && fs_1.default.existsSync(bundled))
            return bundled;
    }
    catch (_a) {
        /* not installed yet */
    }
    return undefined;
}
function puppeteerLaunchArgs(extra = []) {
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
