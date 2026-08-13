"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGoogleSearchUrl = isGoogleSearchUrl;
exports.buildCleanSearchUrl = buildCleanSearchUrl;
exports.scrapeWebsite = scrapeWebsite;
exports.enrichCompanyResult = enrichCompanyResult;
exports.enrichGoogleSearchResults = enrichGoogleSearchResults;
exports.scrapeGoogleSearchPlaces = scrapeGoogleSearchPlaces;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const analyzer_1 = require("./analyzer");
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
/** Persistent Chrome profile + cookie file so CAPTCHA is solved only once. */
const CHROME_PROFILE_DIR = path_1.default.join(__dirname, "../../.chrome-profile");
const COOKIE_FILE = path_1.default.join(__dirname, "../../.google-cookies.json");
/** Keep one browser alive across scrapes so Google session stays valid. */
let sharedBrowser = null;
let sharedPage = null;
let usingRemoteBrowser = false;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function clearStaleChromeLocks(profileDir) {
    for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile"]) {
        const lockPath = path_1.default.join(profileDir, name);
        try {
            if (fs_1.default.existsSync(lockPath))
                fs_1.default.unlinkSync(lockPath);
        }
        catch (_a) {
            /* ignore */
        }
    }
}
function saveGoogleCookies(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cookies = yield page.cookies("https://www.google.com", "https://google.com");
            fs_1.default.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), "utf8");
            console.log(`Saved ${cookies.length} Google cookies for next runs (CAPTCHA once).`);
        }
        catch (e) {
            console.warn(`Could not save cookies: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
        }
    });
}
function loadGoogleCookies(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!fs_1.default.existsSync(COOKIE_FILE))
                return false;
            const raw = fs_1.default.readFileSync(COOKIE_FILE, "utf8");
            const cookies = JSON.parse(raw);
            if (!Array.isArray(cookies) || cookies.length === 0)
                return false;
            yield page.setCookie(...cookies);
            console.log(`Loaded ${cookies.length} saved Google cookies (skip CAPTCHA if still valid).`);
            return true;
        }
        catch (e) {
            console.warn(`Could not load cookies: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
            return false;
        }
    });
}
function assertPageAlive(page) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!page || ((_a = page.isClosed) === null || _a === void 0 ? void 0 : _a.call(page))) {
            throw new Error("Chrome window was closed. Keep the browser open while scraping (especially during CAPTCHA).");
        }
        try {
            page.url();
        }
        catch (_b) {
            throw new Error("Chrome disconnected. Keep the browser open while scraping, then try again.");
        }
    });
}
function isGoogleCaptchaPage(page) {
    return __awaiter(this, void 0, void 0, function* () {
        yield assertPageAlive(page);
        try {
            const url = (page.url() || "").toLowerCase();
            if (url.includes("/sorry/") || url.includes("google.com/sorry"))
                return true;
            return yield page.evaluate(() => {
                var _a;
                const text = (((_a = document.body) === null || _a === void 0 ? void 0 : _a.innerText) || "").toLowerCase();
                return (text.includes("unusual traffic") ||
                    text.includes("not a robot") ||
                    text.includes("type the characters below") ||
                    text.includes("to continue, please type the characters") ||
                    !!document.querySelector("form#captcha-form, img#captcha, #recaptcha, #captcha"));
            });
        }
        catch (err) {
            const msg = String((err === null || err === void 0 ? void 0 : err.message) || err);
            if (/target closed|session closed|protocol error/i.test(msg)) {
                sharedBrowser = null;
                sharedPage = null;
                throw new Error("Chrome window was closed during CAPTCHA wait. Keep it open, solve CAPTCHA once, then retry.");
            }
            return false;
        }
    });
}
function pageHasSearchResults(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield page.evaluate(() => {
                return !!(document.querySelector("#search") ||
                    document.querySelector("div[jscontroller='xkcUKe']") ||
                    document.querySelector("div.VkpGBb") ||
                    document.querySelector("div[role='article']") ||
                    document.querySelector("div.g") ||
                    document.querySelector("[data-result-index]") ||
                    document.querySelector(".rllt__details") ||
                    document.querySelector(".Nv2PK"));
            });
        }
        catch (_a) {
            return false;
        }
    });
}
/**
 * ONE CAPTCHA only: wait until user solves it, then scraping starts.
 * Does not reload the page (reload would trigger CAPTCHA again).
 */
function waitForCaptchaClear(page_1) {
    return __awaiter(this, arguments, void 0, function* (page, timeoutMs = 300000) {
        const started = Date.now();
        let warned = false;
        let sawCaptcha = false;
        console.warn("\n========================================\n" +
            "STEP 1: GOOGLE CAPTCHA (do this FIRST)\n" +
            "1) Look at the Chrome window that opened\n" +
            "2) If CAPTCHA is shown: type characters and Submit\n" +
            "3) Do NOT close Chrome\n" +
            "4) After CAPTCHA clears, scraping starts automatically\n" +
            "========================================\n");
        while (Date.now() - started < timeoutMs) {
            yield assertPageAlive(page);
            try {
                yield page.bringToFront();
            }
            catch (_a) { /* ignore */ }
            const blocked = yield isGoogleCaptchaPage(page);
            if (blocked) {
                sawCaptcha = true;
                if (!warned) {
                    console.warn("[CAPTCHA] CAPTCHA is on screen — solve it in Chrome now...");
                    warned = true;
                }
                yield sleep(2000);
                continue;
            }
            if (yield pageHasSearchResults(page)) {
                if (sawCaptcha)
                    console.log("[CAPTCHA] Solved — starting company scraping now...");
                else
                    console.log("[CAPTCHA] Clear — starting scrape...");
                yield saveGoogleCookies(page);
                return;
            }
            if (!warned) {
                console.warn("[CAPTCHA] Waiting on Google... If you see CAPTCHA, solve it now.");
                warned = true;
            }
            yield sleep(1500);
        }
        throw new Error("Timed out waiting for CAPTCHA. Solve CAPTCHA in the open Chrome window, then run again.");
    });
}
/** Always open VISIBLE Chrome so CAPTCHA can be solved (never headless). */
function launchCaptchaBrowser() {
    return __awaiter(this, void 0, void 0, function* () {
        if (sharedBrowser && sharedPage) {
            try {
                yield assertPageAlive(sharedPage);
                console.log("[CAPTCHA] Reusing open Chrome session.");
                try {
                    yield sharedPage.bringToFront();
                }
                catch (_a) { /* ignore */ }
                return { browser: sharedBrowser, page: sharedPage };
            }
            catch (_b) {
                sharedBrowser = null;
                sharedPage = null;
            }
        }
        let execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
        if (!execPath) {
            for (const p of [
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            ]) {
                if (fs_1.default.existsSync(p)) {
                    execPath = p;
                    console.log(`Found browser: ${p}`);
                    break;
                }
            }
        }
        if (!fs_1.default.existsSync(CHROME_PROFILE_DIR))
            fs_1.default.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
        clearStaleChromeLocks(CHROME_PROFILE_DIR);
        console.log(`[CAPTCHA] Opening VISIBLE Chrome profile: ${CHROME_PROFILE_DIR}`);
        let browser;
        try {
            browser = yield puppeteer_extra_1.default.launch({
                headless: false,
                executablePath: execPath,
                userDataDir: CHROME_PROFILE_DIR,
                defaultViewport: null,
                ignoreDefaultArgs: ["--enable-automation"],
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1280,900",
                    "--window-position=80,40",
                    "--start-maximized",
                    "--lang=en-US,en",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            });
        }
        catch (launchErr) {
            console.warn(`Profile launch failed (${(launchErr === null || launchErr === void 0 ? void 0 : launchErr.message) || launchErr}). Retrying...`);
            browser = yield puppeteer_extra_1.default.launch({
                headless: false,
                executablePath: execPath,
                defaultViewport: null,
                ignoreDefaultArgs: ["--enable-automation"],
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1280,900",
                    "--start-maximized",
                    "--lang=en-US,en",
                ],
            });
        }
        const page = yield browser.newPage();
        usingRemoteBrowser = false;
        sharedBrowser = browser;
        sharedPage = page;
        browser.on("disconnected", () => { sharedBrowser = null; sharedPage = null; });
        try {
            yield page.bringToFront();
        }
        catch (_c) { /* ignore */ }
        return { browser, page };
    });
}
// Keep old name as alias for any other callers
function launchPersistentBrowser() {
    return __awaiter(this, void 0, void 0, function* () {
        return launchCaptchaBrowser();
    });
}
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;
function isGoogleSearchUrl(url) {
    try {
        const u = url.trim().toLowerCase();
        return (u.includes("google.com/search") ||
            u.includes("google.co.in/search") ||
            u.includes("google.com/maps") ||
            u.includes("udm=1") ||
            u.includes("tbm=lcl"));
    }
    catch (_a) {
        return false;
    }
}
function buildCleanSearchUrl(originalUrl) {
    let query = "it company";
    let startOffset = 0;
    try {
        const u = new URL(originalUrl.startsWith("http") ? originalUrl : `https://${originalUrl}`);
        // Extract query
        const q = u.searchParams.get("q");
        if (q && q.trim()) {
            query = q.trim();
        }
        else if (u.pathname.includes("/maps/search/")) {
            const parts = u.pathname.split("/maps/search/");
            if (parts[1]) {
                query = decodeURIComponent(parts[1].split("/")[0]).replace(/\+/g, " ");
            }
        }
        // Extract start offset (pagination)
        const start = u.searchParams.get("start");
        if (start) {
            const parsed = parseInt(start, 10);
            if (!isNaN(parsed) && parsed >= 0) {
                startOffset = parsed;
            }
        }
    }
    catch (_a) { }
    const pageNumber = Math.floor(startOffset / 20) + 1;
    // Softer URL reduces repeat CAPTCHAs (no udm=1 / forced gl=in)
    const cleanUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=lcl&num=20&hl=en` +
        (startOffset > 0 ? `&start=${startOffset}` : "");
    return { cleanUrl, query, startOffset, pageNumber };
}
function normalizeUrl(url) {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
        u = "https://" + u;
    }
    return u;
}
function getDomain(url) {
    try {
        return new URL(url).hostname;
    }
    catch (_a) {
        return "";
    }
}
function cleanText(value) {
    if (!value)
        return "";
    return value.replace(/\s+/g, " ").trim();
}
const MAX_PAGES_PER_COMPANY = Math.max(3, Number(process.env.MAX_PAGES_PER_COMPANY) || 15);
const SERVICE_PAGE_KEYWORDS = [
    "service",
    "solution",
    "what-we-do",
    "what_we_do",
    "capabilit",
    "expertise",
    "technolog",
    "tech-stack",
    "techstack",
    "offer",
    "our-work",
    "portfolio",
    "about",
    "industr",
    "product",
    "platform",
    "digital",
    "marketing",
    "design",
    "develop",
    "consult",
    "wordpress",
    "shopify",
    "woocommerce",
    "magento",
    "webflow",
    "wix",
    "laravel",
    "react",
    "ecommerce",
    "e-commerce",
    "case-stud",
    "projects",
];
const SERVICE_URL_FALLBACKS = [
    "/services",
    "/our-services",
    "/service",
    "/solutions",
    "/what-we-do",
    "/about",
    "/about-us",
    "/aboutus",
    "/capabilities",
    "/expertise",
    "/technology",
    "/technologies",
    "/tech-stack",
    "/portfolio",
    "/work",
    "/products",
    "/industries",
    "/top-website-design-development",
    "/whitelabel-reseller-program",
];
const JUNK_HOST_RE = /(localsearch\.com|yellowpages\.com|yelp\.com|bbb\.org|facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|bing\.com|duckduckgo\.com|google\.)/i;
function isJunkListingUrl(url) {
    if (!url || typeof url !== "string")
        return true;
    try {
        const host = new URL(normalizeUrl(url)).hostname.toLowerCase();
        return JUNK_HOST_RE.test(host);
    }
    catch (_a) {
        return true;
    }
}
function isChallengeOrBlockedHtml(html) {
    if (!html || html.length < 200)
        return true;
    const lower = html.toLowerCase();
    return (lower.includes("just a moment") ||
        lower.includes("cf-browser-verification") ||
        lower.includes("cf-challenge") ||
        lower.includes("checking your browser") ||
        lower.includes("attention required") ||
        lower.includes("access denied") ||
        lower.includes("enable javascript and cookies") ||
        (lower.includes("cloudflare") && lower.includes("ray id")));
}
function isServicePageUrl(rawUrl, baseOrigin) {
    if (!rawUrl)
        return false;
    const u = rawUrl.trim();
    if (/^(javascript:|mailto:|tel:|#)/i.test(u))
        return false;
    let absolute = u;
    if (!/^https?:\/\//i.test(absolute)) {
        absolute = u.startsWith("/") ? `${baseOrigin}${u}` : `${baseOrigin}/${u}`;
    }
    try {
        const parsed = new URL(absolute);
        if (parsed.hostname !== new URL(baseOrigin).hostname)
            return false;
        const path = parsed.pathname.toLowerCase();
        // Ignore assets and page-like fragments
        if (/\.(png|jpe?g|gif|svg|css|js|webp|ico|pdf|zip|woff2?)$/.test(path))
            return false;
        if (/\/(blog|news|tag|category|author)\b/i.test(path) && !/service|develop|wordpress|shopify/i.test(path))
            return false;
        return SERVICE_PAGE_KEYWORDS.some((keyword) => path.includes(keyword));
    }
    catch (_a) {
        return false;
    }
}
function findServicePageUrls(html, $, baseOrigin) {
    const found = [];
    const seen = new Set();
    const consider = (href) => {
        if (!href)
            return;
        const u = href.trim();
        if (/^(javascript:|mailto:|tel:|#)/i.test(u))
            return;
        let absolute = u;
        if (!/^https?:\/\//i.test(absolute)) {
            absolute = u.startsWith("/") ? `${baseOrigin}${u}` : `${baseOrigin}/${u}`;
        }
        try {
            const parsed = new URL(absolute);
            parsed.hash = "";
            parsed.search = "";
            const key = parsed.href.replace(/\/+$/, "");
            if (parsed.hostname === new URL(baseOrigin).hostname &&
                !seen.has(key) &&
                isServicePageUrl(parsed.href, baseOrigin)) {
                seen.add(key);
                found.push(key);
            }
        }
        catch (_a) {
            /* invalid URL - skip */
        }
    };
    // Collect links from navigation/menu/footer plus any icon-like service links
    $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim().toLowerCase();
        const inNavContext = $(el).closest("nav, header, footer, [class*='menu' i], [class*='nav' i], [id*='menu' i], [id*='nav' i], [class*='link' i]").length > 0;
        const textLooksLikeService = SERVICE_PAGE_KEYWORDS.some((keyword) => text.includes(keyword));
        if (inNavContext || textLooksLikeService) {
            consider(href);
        }
    });
    // Fallbacks in case navigation doesn't reveal service pages
    for (const fallback of SERVICE_URL_FALLBACKS) {
        consider(fallback);
    }
    // Also check footer and header links for service-related anchors
    $("footer a[href], header a[href], [class*='footer' i] a[href], [class*='header' i] a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim().toLowerCase();
        const textLooksLikeService = SERVICE_PAGE_KEYWORDS.some((keyword) => text.includes(keyword));
        if (textLooksLikeService) {
            consider(href);
        }
    });
    return found.slice(0, MAX_PAGES_PER_COMPANY);
}
function scoreRelevantPage(href, text) {
    const blob = `${href} ${text}`.toLowerCase();
    if (/\/(blog|news|tag|category|author)\b/.test(blob) && !/wordpress|shopify|webflow|service/.test(blob)) {
        return 0;
    }
    let score = 0;
    if (/\b(services?|solutions?|technolog|platforms?|expertise|capabilities|development)\b/.test(blob)) {
        score += 40;
    }
    if (/\b(wordpress|shopify|webflow|woocommerce|magento|react|laravel|wix|duda)\b/.test(blob)) {
        score += 30;
    }
    if (/\b(portfolio|case-stud|our-work|projects)\b/.test(blob)) {
        score += 15;
    }
    if (/\babout\b/.test(blob))
        score += 5;
    return score;
}
function collectScoredLinks(html, $, baseOrigin) {
    const seen = new Set();
    const out = [];
    const consider = (href, text) => {
        if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href.trim()))
            return;
        let absolute = href.trim();
        if (!/^https?:\/\//i.test(absolute)) {
            absolute = absolute.startsWith("/") ? `${baseOrigin}${absolute}` : `${baseOrigin}/${absolute}`;
        }
        try {
            const parsed = new URL(absolute);
            if (parsed.hostname !== new URL(baseOrigin).hostname)
                return;
            parsed.hash = "";
            parsed.search = "";
            const key = parsed.href.replace(/\/+$/, "");
            if (seen.has(key) || !isServicePageUrl(parsed.href, baseOrigin))
                return;
            seen.add(key);
            const score = scoreRelevantPage(key, text || "");
            if (score > 0)
                out.push({ url: key, score });
        }
        catch (_a) {
            /* skip */
        }
    };
    $("a[href]").each((_, el) => {
        consider($(el).attr("href") || "", ($(el).text() || "").trim());
    });
    for (const fallback of SERVICE_URL_FALLBACKS) {
        consider(fallback, fallback);
    }
    return out.sort((a, b) => b.score - a.score);
}
function deepCrawlCompanyPages(homeHtml, homeUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const origin = new URL(homeUrl).origin;
        const homeKey = homeUrl.replace(/\/+$/, "");
        const fetched = new Set([homeKey]);
        const htmls = [];
        const queue = collectScoredLinks(homeHtml, cheerio.load(homeHtml), origin);
        while (queue.length && htmls.length < MAX_PAGES_PER_COMPANY) {
            const next = queue.shift();
            if (!next || fetched.has(next.url))
                continue;
            fetched.add(next.url);
            let pageHtml = "";
            try {
                pageHtml = yield fetchPageHtml(next.url);
            }
            catch (_a) {
                continue;
            }
            if (!pageHtml || isChallengeOrBlockedHtml(pageHtml))
                continue;
            htmls.push(pageHtml);
            if (htmls.length >= MAX_PAGES_PER_COMPANY)
                break;
            const more = collectScoredLinks(pageHtml, cheerio.load(pageHtml), origin);
            for (const item of more) {
                if (!fetched.has(item.url))
                    queue.push(item);
            }
            queue.sort((a, b) => b.score - a.score);
        }
        return htmls;
    });
}
function fetchPageHtml(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield axios_1.default.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout: 10000,
                maxRedirects: 3,
            });
            if (res.status === 200 &&
                typeof res.data === "string" &&
                res.data.length > 200 &&
                !isChallengeOrBlockedHtml(res.data)) {
                return res.data;
            }
        }
        catch (_a) {
            /* page not available */
        }
        return "";
    });
}
function fetchHtmlWithPuppeteer(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let browser;
        const connectUrl = process.env.PUPPETEER_CONNECT_URL;
        try {
            if (connectUrl) {
                browser = yield puppeteer_extra_1.default.connect({ browserURL: connectUrl, defaultViewport: null });
            }
            else {
                let execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
                if (!execPath) {
                    for (const p of [
                        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                    ]) {
                        if (fs_1.default.existsSync(p)) {
                            execPath = p;
                            break;
                        }
                    }
                }
                browser = yield puppeteer_extra_1.default.launch({
                    headless: process.env.PUPPETEER_HEADLESS === "false" ? false : true,
                    executablePath: execPath,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                });
            }
            const page = yield browser.newPage();
            yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            yield page.setViewport({ width: 1280, height: 900 });
            yield page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
            yield sleep(2500);
            yield page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
            yield sleep(1000);
            yield page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            yield sleep(800);
            const html = yield page.content();
            const finalUrl = page.url();
            if (connectUrl) {
                yield page.close();
            }
            else {
                yield browser.close();
            }
            return { html, finalUrl };
        }
        catch (e) {
            if (browser && !connectUrl) {
                try {
                    yield browser.close();
                }
                catch (_a) {
                    /* ignore */
                }
            }
            throw e;
        }
    });
}
function scrapeWebsite(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (isJunkListingUrl(url)) {
            throw new Error(`Skipped directory/junk URL: ${url}`);
        }
        const fullUrl = normalizeUrl(url);
        const domain = getDomain(fullUrl);
        let html = "";
        let finalUrl = fullUrl;
        let headerText = "";
        // --- Step 1: Try axios first ---
        try {
            const res = yield axios_1.default.get(fullUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout: 15000,
                maxRedirects: 5,
            });
            html = typeof res.data === "string" ? res.data : "";
            finalUrl = ((_b = (_a = res.request) === null || _a === void 0 ? void 0 : _a.res) === null || _b === void 0 ? void 0 : _b.responseUrl) || fullUrl;
            headerText = Object.entries(res.headers || {})
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join("\n");
        }
        catch (e) {
            // axios failed — will use puppeteer below
        }
        // --- Step 2: Puppeteer when thin, blocked, or Cloudflare challenge ---
        const tempText = html
            ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
            : "";
        const needsBrowser = !html ||
            tempText.length < 1200 ||
            isChallengeOrBlockedHtml(html) ||
            /just a moment/i.test(tempText);
        if (needsBrowser) {
            try {
                console.log(`[scrapeWebsite] Using browser render for ${domain}`);
                const rendered = yield fetchHtmlWithPuppeteer(fullUrl);
                if (rendered.html && !isChallengeOrBlockedHtml(rendered.html)) {
                    html = rendered.html;
                    finalUrl = rendered.finalUrl || fullUrl;
                }
                else if (rendered.html && rendered.html.length > html.length) {
                    html = rendered.html;
                    finalUrl = rendered.finalUrl || fullUrl;
                }
            }
            catch (e2) {
                if (!html)
                    throw new Error(`Could not fetch website ${fullUrl}`);
            }
        }
        if (!html || isChallengeOrBlockedHtml(html)) {
            throw new Error(`Blocked or empty page for ${fullUrl}`);
        }
        // --- Step 3: Independent deep crawl of relevant pages (axios only — no extra CAPTCHA) ---
        const $ = cheerio.load(html);
        let servicePageHtmls = [];
        try {
            servicePageHtmls = yield deepCrawlCompanyPages(html, finalUrl);
            console.log(`[scrapeWebsite] ${domain}: deep-crawled ${servicePageHtmls.length}/${MAX_PAGES_PER_COMPANY} relevant page(s)`);
        }
        catch (crawlErr) {
            console.warn(`[scrapeWebsite] ${domain}: deep crawl failed, homepage only`, crawlErr);
        }
        // --- Step 4: Analyze services & technologies with the rich analyzer ---
        let analysis;
        try {
            analysis = (0, analyzer_1.analyzeContent)({
                mainHtml: html,
                servicePageHtmls,
                headerText,
            });
        }
        catch (err) {
            console.error(`[scrapeWebsite] Analyzer failed for ${fullUrl}:`, err);
            analysis = { services: [], technologies: [] };
        }
        let companyName = cleanText($('meta[property="og:site_name"]').attr("content")) ||
            cleanText($('meta[name="application-name"]').attr("content")) ||
            cleanText($("title").first().text()) ||
            cleanText($("h1").first().text()) ||
            domain;
        if (companyName) {
            const parts = companyName.split(/[-–—|]/)[0].trim();
            if (parts)
                companyName = parts;
        }
        const companyUrl = finalUrl || fullUrl;
        let email = "";
        const emails = new Set();
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const m = href.replace("mailto:", "").split("?")[0].trim();
            if (m && EMAIL_REGEX.test(m))
                emails.add(m);
        });
        const emailMeta = cleanText($('meta[name="email"]').attr("content")) ||
            cleanText($('meta[name="contact"]').attr("content"));
        if (emailMeta && EMAIL_REGEX.test(emailMeta))
            emails.add(emailMeta);
        const textMatches = html.match(EMAIL_REGEX) || [];
        textMatches.forEach((m) => {
            if (!m.includes("example.com") &&
                !m.includes(".png") &&
                !m.includes(".jpg")) {
                emails.add(m.toLowerCase());
            }
        });
        email = Array.from(emails)[0] || "";
        let phone = "";
        const phones = new Set();
        $('a[href^="tel:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const num = href
                .replace("tel:", "")
                .split("?")[0]
                .replace(/[^\d+]/g, "")
                .trim();
            if (num)
                phones.add(num);
        });
        const phoneMeta = cleanText($('meta[name="phone"]').attr("content")) ||
            cleanText($('meta[name="telephone"]').attr("content"));
        if (phoneMeta)
            phones.add(phoneMeta.replace(/[^\d+]/g, ""));
        const bodyText = $("body").text();
        const phoneMatches = bodyText.match(PHONE_REGEX) || [];
        phoneMatches.forEach((p) => {
            const clean = p.replace(/[^\d+]/g, "");
            if (clean.length >= 7 && clean.length <= 15)
                phones.add(clean);
        });
        phone = Array.from(phones)[0] || "";
        let service = cleanText($('meta[name="description"]').attr("content")) ||
            cleanText($('meta[property="og:description"]').attr("content")) ||
            cleanText($('meta[name="twitter:description"]').attr("content")) ||
            `${companyName} - Official Website`;
        const detectedServices = analysis.services.length > 0 ? analysis.services : ["No Services"];
        const technologies = analysis.technologies;
        const result = {
            companyName,
            companyUrl,
            companyEmail: email,
            companyPhone: phone,
            service,
            detectedServices,
            technologies,
        };
        return result;
    });
}
function enrichCompanyResult(company) {
    return __awaiter(this, void 0, void 0, function* () {
        const website = company.companyUrl ||
            company.websiteUrl ||
            company.website ||
            company.url ||
            "";
        const fallback = {
            companyName: company.companyName || company.name || "N/A",
            companyUrl: website || "",
            companyPhone: company.companyPhone || "",
            companyEmail: company.companyEmail || "",
            service: company.service || "",
            detectedServices: Array.isArray(company.detectedServices) ? company.detectedServices : [],
            technologies: Array.isArray(company.technologies) ? company.technologies : [],
            address: company.address,
            rating: company.rating,
        };
        if (!website || !/^https?:\/\//i.test(website.trim())) {
            return fallback;
        }
        try {
            const details = yield scrapeWebsite(website);
            return {
                companyName: company.companyName || details.companyName || company.name || "N/A",
                companyUrl: details.companyUrl || website,
                companyPhone: details.companyPhone || company.companyPhone || "",
                companyEmail: details.companyEmail || company.companyEmail || "",
                service: details.service || company.service || "",
                detectedServices: Array.isArray(details.detectedServices) && details.detectedServices.length > 0
                    ? details.detectedServices
                    : Array.isArray(company.detectedServices)
                        ? company.detectedServices
                        : [],
                technologies: Array.isArray(details.technologies) && details.technologies.length > 0
                    ? details.technologies
                    : Array.isArray(company.technologies)
                        ? company.technologies
                        : [],
                address: company.address || details.address,
                rating: company.rating || details.rating,
            };
        }
        catch (error) {
            return fallback;
        }
    });
}
function enrichGoogleSearchResults(companies) {
    return __awaiter(this, void 0, void 0, function* () {
        const batchSize = 5;
        const enriched = [];
        for (let i = 0; i < companies.length; i += batchSize) {
            const batch = companies.slice(i, i + batchSize);
            const batchResults = yield Promise.all(batch.map((company) => enrichCompanyResult(company)));
            enriched.push(...batchResults);
        }
        return enriched;
    });
}
function extractPlacesFromGooglePage(page) {
    return __awaiter(this, void 0, void 0, function* () {
        const rawPlaces = yield page.evaluate(() => {
            const items = [];
            const seen = new Set();
            const push = (name, website, extra = {}) => {
                const n = (name || "").trim();
                if (!n)
                    return;
                const key = n.toLowerCase() + "|" + (website || "").toLowerCase();
                if (seen.has(key))
                    return;
                seen.add(key);
                items.push({
                    companyName: n,
                    companyUrl: website || "",
                    rating: extra.rating || "",
                    address: extra.address || "",
                    companyEmail: "",
                    companyPhone: extra.phone || "",
                    service: "",
                    detectedServices: [],
                    technologies: [],
                });
            };
            const localEls = document.querySelectorAll('div[jscontroller="xkcUKe"], div.VkpGBb, div[data-result-index], div.rllt__link, a.vwVdIe, div[role="article"], div.g');
            localEls.forEach((el) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                const name = ((_b = (_a = el.querySelector('div[role="heading"], .dbg0pd, .qBF1Pd, h3, .OSrXXb')) === null || _a === void 0 ? void 0 : _a.innerText) === null || _b === void 0 ? void 0 : _b.trim()) ||
                    ((_d = (_c = el.innerText) === null || _c === void 0 ? void 0 : _c.split("\n")[0]) === null || _d === void 0 ? void 0 : _d.trim()) ||
                    "";
                const ratingText = ((_f = (_e = el.querySelector('[aria-label*="stars"], .Aq14fc')) === null || _e === void 0 ? void 0 : _e.innerText) === null || _f === void 0 ? void 0 : _f.trim()) || "";
                const address = ((_h = (_g = el.querySelector(".rllt__details, .yEWOzc, .rllt__wrapped, .a4gq8e, .W4Efsd")) === null || _g === void 0 ? void 0 : _g.innerText) === null || _h === void 0 ? void 0 : _h.trim()) || "";
                let website = ((_j = el.querySelector('a[href*="url?q="], a[data-url], a[href^="http"]')) === null || _j === void 0 ? void 0 : _j.href) || "";
                const dataUrl = (_k = el.querySelector("[data-url]")) === null || _k === void 0 ? void 0 : _k.getAttribute("data-url");
                if (dataUrl && /^https?:/i.test(dataUrl))
                    website = dataUrl;
                if (website && website.includes("url?q=")) {
                    try {
                        const params = new URLSearchParams(website.split("?")[1]);
                        website = params.get("q") || website;
                    }
                    catch (_l) {
                        /* ignore */
                    }
                }
                if (/google\./i.test(website))
                    website = "";
                push(name, website, { rating: ratingText, address });
            });
            if (items.length === 0) {
                document.querySelectorAll('div.g, div[role="article"], div[data-ved]').forEach((el) => {
                    const a = el.querySelector("a");
                    const h = el.querySelector("h3");
                    const name = ((h === null || h === void 0 ? void 0 : h.innerText) || (a === null || a === void 0 ? void 0 : a.innerText) || "").trim();
                    let website = (a === null || a === void 0 ? void 0 : a.href) || "";
                    if (/google\./i.test(website))
                        website = "";
                    push(name, website);
                });
            }
            return items;
        });
        return (rawPlaces || []);
    });
}
function dedupeGooglePlaces(places) {
    const seen = new Set();
    const out = [];
    for (const p of places) {
        const key = `${(p.companyName || "").toLowerCase()}|${(p.companyUrl || "")
            .toLowerCase()
            .replace(/\/$/, "")}`;
        if (!p.companyName || seen.has(key))
            continue;
        seen.add(key);
        out.push(p);
    }
    return out;
}
/**
 * Google Local search with CAPTCHA support — scrapes ALL pages until empty or max pages.
 * CAPTCHA: solve once in the open Chrome window; session is reused for the rest.
 */
function scrapeGoogleSearchPlaces(originalUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Optional: skip Google and use directories only
        if (process.env.USE_NO_CAPTCHA_DIRS === "true") {
            const { scrapeLocalPlacesNoCaptcha } = yield Promise.resolve().then(() => __importStar(require("./noCaptchaScraper")));
            return (yield scrapeLocalPlacesNoCaptcha(originalUrl));
        }
        const { query, startOffset } = buildCleanSearchUrl(originalUrl);
        const pageSize = 20;
        const maxPages = Math.max(1, Math.min(25, Number(process.env.GOOGLE_MAX_PAGES || 12)));
        // If user passed a start offset, begin there; otherwise page 1
        const firstStart = startOffset > 0 ? startOffset : 0;
        console.log(`[Google] Full company list scrape for "${query}" (up to ${maxPages} pages, CAPTCHA OK once)`);
        let page;
        const all = [];
        try {
            const launched = yield launchCaptchaBrowser();
            page = launched.page;
            yield page.setViewport({ width: 1280, height: 900 });
            yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            yield page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
            // --- STEP 1: open Google search and WAIT for CAPTCHA solve BEFORE scraping ---
            console.log("[CAPTCHA] Step 1/2: Opening Google — solve CAPTCHA if shown, then scrape starts.");
            yield page.setViewport({ width: 1280, height: 900 }).catch(() => { });
            yield page
                .goto("https://www.google.com/", { waitUntil: "domcontentloaded", timeout: 45000 })
                .catch(() => { });
            yield loadGoogleCookies(page);
            yield sleep(1000);
            const firstUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}` +
                `&tbm=lcl&num=${pageSize}&hl=en` +
                (firstStart > 0 ? `&start=${firstStart}` : "");
            console.log(`[CAPTCHA] Opening: ${firstUrl}`);
            try {
                yield page.goto(firstUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
            }
            catch (navErr) {
                console.warn(`[CAPTCHA] Navigation warning: ${(navErr === null || navErr === void 0 ? void 0 : navErr.message) || navErr}`);
            }
            try {
                yield page.bringToFront();
            }
            catch (_b) { /* ignore */ }
            yield sleep(1500);
            // BLOCK HERE until CAPTCHA solved / results visible — scraping has NOT started yet
            yield waitForCaptchaClear(page, 300000);
            console.log("[CAPTCHA] Step 2/2: CAPTCHA done — scraping ALL company pages now...");
            yield sleep(1000);
            for (let i = 0; i < maxPages; i++) {
                const start = firstStart + i * pageSize;
                const pageNumber = Math.floor(start / pageSize) + 1;
                const cleanUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}` +
                    `&tbm=lcl&num=${pageSize}&hl=en` +
                    (start > 0 ? `&start=${start}` : "");
                console.log(`[Google] Page ${pageNumber}/${maxPages} start=${start}`);
                // Page 1 already opened during CAPTCHA gate — don't reload (avoids new CAPTCHA)
                if (i > 0) {
                    console.log(`[Google] URL: ${cleanUrl}`);
                    try {
                        yield page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
                    }
                    catch (navErr) {
                        const msg = String((navErr === null || navErr === void 0 ? void 0 : navErr.message) || navErr);
                        if (/target closed|session closed/i.test(msg)) {
                            sharedBrowser = null;
                            sharedPage = null;
                            throw new Error("Chrome closed during page load. Keep the Chrome window open and try again.");
                        }
                        console.warn(`[Google] Navigation warning: ${msg}`);
                    }
                    yield sleep(1500);
                    if (yield isGoogleCaptchaPage(page)) {
                        yield waitForCaptchaClear(page, 300000);
                    }
                }
                for (let s = 0; s < 4; s++) {
                    yield page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
                    yield sleep(700);
                }
                const batch = yield extractPlacesFromGooglePage(page);
                console.log(`[Google] Page ${pageNumber}: extracted ${batch.length} companies`);
                if (batch.length === 0) {
                    console.log(`[Google] No more results at page ${pageNumber} — stopping.`);
                    break;
                }
                const before = all.length;
                all.push(...batch);
                const unique = dedupeGooglePlaces(all);
                all.length = 0;
                all.push(...unique);
                const added = all.length - before;
                console.log(`[Google] Running total: ${all.length} unique companies (+${Math.max(0, added)} new)`);
                if (added === 0 && i > 0) {
                    console.log(`[Google] No new companies on page ${pageNumber} — stopping.`);
                    break;
                }
                yield sleep(1500 + Math.floor(Math.random() * 1500));
            }
            yield saveGoogleCookies(page);
            console.log(`[Google] DONE — full list: ${all.length} unique companies`);
            return all;
        }
        catch (error) {
            try {
                if (page && ((_a = page.isClosed) === null || _a === void 0 ? void 0 : _a.call(page)))
                    sharedPage = null;
            }
            catch (_c) {
                sharedBrowser = null;
                sharedPage = null;
            }
            throw error;
        }
    });
}
