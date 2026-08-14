import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { analyzeContent } from "./analyzer";
import {
  puppeteerLaunchArgs,
  resolveChromeExecutable,
  useHeadlessChrome,
} from "./chromeLaunch";

puppeteer.use(StealthPlugin());

/** Persistent Chrome profile + cookie file so CAPTCHA is solved only once. */
const CHROME_PROFILE_DIR = path.join(__dirname, "../../.chrome-profile");
const COOKIE_FILE = path.join(__dirname, "../../.google-cookies.json");

/** Keep one browser alive across scrapes so Google session stays valid. */
let sharedBrowser: any = null;
let sharedPage: any = null;
let usingRemoteBrowser = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearStaleChromeLocks(profileDir: string): void {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile"]) {
    const lockPath = path.join(profileDir, name);
    try {
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
}

async function saveGoogleCookies(page: any): Promise<void> {
  try {
    const cookies = await page.cookies("https://www.google.com", "https://google.com");
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), "utf8");
    console.log(`Saved ${cookies.length} Google cookies for next runs (CAPTCHA once).`);
  } catch (e: any) {
    console.warn(`Could not save cookies: ${e?.message || e}`);
  }
}

async function loadGoogleCookies(page: any): Promise<boolean> {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return false;
    const raw = fs.readFileSync(COOKIE_FILE, "utf8");
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await page.setCookie(...cookies);
    console.log(`Loaded ${cookies.length} saved Google cookies (skip CAPTCHA if still valid).`);
    return true;
  } catch (e: any) {
    console.warn(`Could not load cookies: ${e?.message || e}`);
    return false;
  }
}

async function assertPageAlive(page: any): Promise<void> {
  if (!page || page.isClosed?.()) {
    throw new Error(
      "Chrome window was closed. Keep the browser open while scraping (especially during CAPTCHA)."
    );
  }
  try {
    page.url();
  } catch {
    throw new Error(
      "Chrome disconnected. Keep the browser open while scraping, then try again."
    );
  }
}

async function isGoogleCaptchaPage(page: any): Promise<boolean> {
  await assertPageAlive(page);
  try {
    const url = (page.url() || "").toLowerCase();
    if (url.includes("/sorry/") || url.includes("google.com/sorry")) return true;
    return await page.evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      return (
        text.includes("unusual traffic") ||
        text.includes("not a robot") ||
        text.includes("type the characters below") ||
        text.includes("to continue, please type the characters") ||
        !!document.querySelector("form#captcha-form, img#captcha, #recaptcha, #captcha")
      );
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (/target closed|session closed|protocol error/i.test(msg)) {
      sharedBrowser = null;
      sharedPage = null;
      throw new Error(
        "Chrome window was closed during CAPTCHA wait. Keep it open, solve CAPTCHA once, then retry."
      );
    }
    return false;
  }
}

async function pageHasSearchResults(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      return !!(
        document.querySelector("#search") ||
        document.querySelector("div[jscontroller='xkcUKe']") ||
        document.querySelector("div.VkpGBb") ||
        document.querySelector("div[role='article']") ||
        document.querySelector("div.g") ||
        document.querySelector("[data-result-index]") ||
        document.querySelector(".rllt__details") ||
        document.querySelector(".Nv2PK")
      );
    });
  } catch {
    return false;
  }
}

/**
 * ONE CAPTCHA only: wait until user solves it, then scraping starts.
 * Does not reload the page (reload would trigger CAPTCHA again).
 */
async function waitForCaptchaClear(page: any, timeoutMs = 300000): Promise<void> {
  const started = Date.now();
  let warned = false;
  let sawCaptcha = false;

  console.warn(
    "\n========================================\n" +
      "STEP 1: GOOGLE CAPTCHA (do this FIRST)\n" +
      "1) Look at the Chrome window that opened\n" +
      "2) If CAPTCHA is shown: type characters and Submit\n" +
      "3) Do NOT close Chrome\n" +
      "4) After CAPTCHA clears, scraping starts automatically\n" +
      "========================================\n"
  );

  while (Date.now() - started < timeoutMs) {
    await assertPageAlive(page);
    try { await page.bringToFront(); } catch { /* ignore */ }

    const blocked = await isGoogleCaptchaPage(page);
    if (blocked) {
      sawCaptcha = true;
      if (!warned) {
        console.warn("[CAPTCHA] CAPTCHA is on screen — solve it in Chrome now...");
        warned = true;
      }
      await sleep(2000);
      continue;
    }

    if (await pageHasSearchResults(page)) {
      if (sawCaptcha) console.log("[CAPTCHA] Solved — starting company scraping now...");
      else console.log("[CAPTCHA] Clear — starting scrape...");
      await saveGoogleCookies(page);
      return;
    }

    if (!warned) {
      console.warn("[CAPTCHA] Waiting on Google... If you see CAPTCHA, solve it now.");
      warned = true;
    }
    await sleep(1500);
  }

  throw new Error(
    "Timed out waiting for CAPTCHA. Solve CAPTCHA in the open Chrome window, then run again."
  );
}

/** Always open VISIBLE Chrome so CAPTCHA can be solved (never headless). */
async function launchCaptchaBrowser(): Promise<{ browser: any; page: any }> {
  if (sharedBrowser && sharedPage) {
    try {
      await assertPageAlive(sharedPage);
      console.log("[CAPTCHA] Reusing open Chrome session.");
      try { await sharedPage.bringToFront(); } catch { /* ignore */ }
      return { browser: sharedBrowser, page: sharedPage };
    } catch {
      sharedBrowser = null;
      sharedPage = null;
    }
  }

  const execPath = resolveChromeExecutable();
  const headless = useHeadlessChrome();
  if (execPath) console.log(`Found browser: ${execPath}`);
  else console.warn("No system Chrome found; Puppeteer will use its bundled Chromium if installed.");

  if (!fs.existsSync(CHROME_PROFILE_DIR)) fs.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
  clearStaleChromeLocks(CHROME_PROFILE_DIR);
  console.log(
    `[CAPTCHA] Opening Chrome (${headless ? "headless/cloud" : "visible"}) profile: ${CHROME_PROFILE_DIR}`
  );

  const launchOpts: any = {
    headless,
    ...(execPath ? { executablePath: execPath } : {}),
    defaultViewport: headless ? { width: 1280, height: 900 } : null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: puppeteerLaunchArgs(
      headless
        ? ["--window-size=1280,900"]
        : ["--window-size=1280,900", "--window-position=80,40", "--start-maximized"]
    ),
  };

  let browser: any;
  try {
    browser = await puppeteer.launch({
      ...launchOpts,
      userDataDir: CHROME_PROFILE_DIR,
    });
  } catch (launchErr: any) {
    console.warn(`Profile launch failed (${launchErr?.message || launchErr}). Retrying...`);
    browser = await puppeteer.launch(launchOpts);
  }

  const page = await browser.newPage();
  usingRemoteBrowser = false;
  sharedBrowser = browser;
  sharedPage = page;
  browser.on("disconnected", () => { sharedBrowser = null; sharedPage = null; });
  try { await page.bringToFront(); } catch { /* ignore */ }
  return { browser, page };
}

// Keep old name as alias for any other callers
async function launchPersistentBrowser(): Promise<{ browser: any; page: any }> {
  return launchCaptchaBrowser();
}
export interface ScrapeResult {
  companyName: string;
  companyUrl: string;
  companyPhone: string;
  companyEmail: string;
  service: string;
  detectedServices: string[];
  technologies: string[];
  address?: string;
  rating?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;

export function isGoogleSearchUrl(url: string): boolean {
  try {
    const u = url.trim().toLowerCase();
    return (
      u.includes("google.com/search") ||
      u.includes("google.co.in/search") ||
      u.includes("google.com/maps") ||
      u.includes("udm=1") ||
      u.includes("tbm=lcl")
    );
  } catch {
    return false;
  }
}


export function buildCleanSearchUrl(originalUrl: string): {
  cleanUrl: string;
  query: string;
  startOffset: number;
  pageNumber: number;
} {
  let query = "it company";
  let startOffset = 0;

  try {
    const u = new URL(
      originalUrl.startsWith("http") ? originalUrl : `https://${originalUrl}`
    );

    // Extract query
    const q = u.searchParams.get("q");
    if (q && q.trim()) {
      query = q.trim();
    } else if (u.pathname.includes("/maps/search/")) {
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
  } catch { }

  const pageNumber = Math.floor(startOffset / 20) + 1;

  // Softer URL reduces repeat CAPTCHAs (no udm=1 / forced gl=in)
  const cleanUrl =
    `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=lcl&num=20&hl=en` +
    (startOffset > 0 ? `&start=${startOffset}` : "");

  return { cleanUrl, query, startOffset, pageNumber };
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = "https://" + u;
  }
  return u;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function cleanText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

const MAX_PAGES_PER_COMPANY = Math.max(
  3,
  Number(process.env.MAX_PAGES_PER_COMPANY) || 15
);

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
  "case-stud",
  "projects",
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

const JUNK_HOST_RE =
  /(localsearch\.com|yellowpages\.com|yelp\.com|bbb\.org|facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|bing\.com|duckduckgo\.com|google\.)/i;

function isJunkListingUrl(url: string): boolean {
  if (!url || typeof url !== "string") return true;
  try {
    const host = new URL(normalizeUrl(url)).hostname.toLowerCase();
    return JUNK_HOST_RE.test(host);
  } catch {
    return true;
  }
}

function isChallengeOrBlockedHtml(html: string): boolean {
  if (!html || html.length < 200) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("cf-challenge") ||
    lower.includes("checking your browser") ||
    lower.includes("attention required") ||
    lower.includes("access denied") ||
    lower.includes("enable javascript and cookies") ||
    (lower.includes("cloudflare") && lower.includes("ray id"))
  );
}

function isServicePageUrl(rawUrl: string, baseOrigin: string): boolean {
  if (!rawUrl) return false;
  const u = rawUrl.trim();
  if (/^(javascript:|mailto:|tel:|#)/i.test(u)) return false;
  let absolute = u;
  if (!/^https?:\/\//i.test(absolute)) {
    absolute = u.startsWith("/") ? `${baseOrigin}${u}` : `${baseOrigin}/${u}`;
  }
  try {
    const parsed = new URL(absolute);
    if (parsed.hostname !== new URL(baseOrigin).hostname) return false;
    const path = parsed.pathname.toLowerCase();
    // Ignore assets and page-like fragments
    if (/\.(png|jpe?g|gif|svg|css|js|webp|ico|pdf|zip|woff2?)$/.test(path)) return false;
    if (/\/(blog|news|tag|category|author)\b/i.test(path) && !/service|develop|wordpress|shopify/i.test(path)) {
      return false;
    }
    return SERVICE_PAGE_KEYWORDS.some((keyword) => path.includes(keyword));
  } catch {
    return false;
  }
}

function findServicePageUrls(
  html: string,
  $: cheerio.CheerioAPI,
  baseOrigin: string
): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const consider = (href: string) => {
    if (!href) return;
    const u = href.trim();
    if (/^(javascript:|mailto:|tel:|#)/i.test(u)) return;
    let absolute = u;
    if (!/^https?:\/\//i.test(absolute)) {
      absolute = u.startsWith("/") ? `${baseOrigin}${u}` : `${baseOrigin}/${u}`;
    }
    try {
      const parsed = new URL(absolute);
      parsed.hash = "";
      parsed.search = "";
      const key = parsed.href.replace(/\/+$/, "");
      if (
        parsed.hostname === new URL(baseOrigin).hostname &&
        !seen.has(key) &&
        isServicePageUrl(parsed.href, baseOrigin)
      ) {
        seen.add(key);
        found.push(key);
      }
    } catch {
      /* invalid URL - skip */
    }
  };

  // Collect links from navigation/menu/footer plus any icon-like service links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().toLowerCase();
    const inNavContext =
      $(el).closest(
        "nav, header, footer, [class*='menu' i], [class*='nav' i], [id*='menu' i], [id*='nav' i], [class*='link' i]"
      ).length > 0;
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

function scoreRelevantPage(href: string, text: string): number {
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
  if (/\babout\b/.test(blob)) score += 5;
  return score;
}

function collectScoredLinks(
  html: string,
  $: cheerio.CheerioAPI,
  baseOrigin: string
): Array<{ url: string; score: number }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; score: number }> = [];
  const consider = (href: string, text: string) => {
    if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href.trim())) return;
    let absolute = href.trim();
    if (!/^https?:\/\//i.test(absolute)) {
      absolute = absolute.startsWith("/") ? `${baseOrigin}${absolute}` : `${baseOrigin}/${absolute}`;
    }
    try {
      const parsed = new URL(absolute);
      if (parsed.hostname !== new URL(baseOrigin).hostname) return;
      parsed.hash = "";
      parsed.search = "";
      const key = parsed.href.replace(/\/+$/, "");
      if (seen.has(key) || !isServicePageUrl(parsed.href, baseOrigin)) return;
      seen.add(key);
      const score = scoreRelevantPage(key, text || "");
      if (score > 0) out.push({ url: key, score });
    } catch {
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

async function deepCrawlCompanyPages(
  homeHtml: string,
  homeUrl: string
): Promise<string[]> {
  const origin = new URL(homeUrl).origin;
  const homeKey = homeUrl.replace(/\/+$/, "");
  const fetched = new Set<string>([homeKey]);
  const htmls: string[] = [];
  const queue = collectScoredLinks(homeHtml, cheerio.load(homeHtml), origin);

  while (queue.length && htmls.length < MAX_PAGES_PER_COMPANY) {
    const next = queue.shift();
    if (!next || fetched.has(next.url)) continue;
    fetched.add(next.url);
    let pageHtml = "";
    try {
      pageHtml = await fetchPageHtml(next.url);
    } catch {
      continue;
    }
    if (!pageHtml || isChallengeOrBlockedHtml(pageHtml)) continue;
    htmls.push(pageHtml);
    if (htmls.length >= MAX_PAGES_PER_COMPANY) break;
    const more = collectScoredLinks(pageHtml, cheerio.load(pageHtml), origin);
    for (const item of more) {
      if (!fetched.has(item.url)) queue.push(item);
    }
    queue.sort((a, b) => b.score - a.score);
  }
  return htmls;
}

async function fetchPageHtml(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
      maxRedirects: 3,
    });
    if (
      res.status === 200 &&
      typeof res.data === "string" &&
      res.data.length > 200 &&
      !isChallengeOrBlockedHtml(res.data)
    ) {
      return res.data;
    }
  } catch {
    /* page not available */
  }
  return "";
}

async function fetchHtmlWithPuppeteer(url: string): Promise<{ html: string; finalUrl: string }> {
  let browser: any;
  const connectUrl = process.env.PUPPETEER_CONNECT_URL;
  try {
    if (connectUrl) {
      browser = await puppeteer.connect({ browserURL: connectUrl, defaultViewport: null });
    } else {
      const execPath = resolveChromeExecutable();
      browser = await puppeteer.launch({
        headless: useHeadlessChrome() ? true : process.env.PUPPETEER_HEADLESS === "false" ? false : true,
        ...(execPath ? { executablePath: execPath } : {}),
        args: puppeteerLaunchArgs(),
      });
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await sleep(2500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await sleep(1000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(800);
    const html = await page.content();
    const finalUrl = page.url();
    if (connectUrl) {
      await page.close();
    } else {
      await browser.close();
    }
    return { html, finalUrl };
  } catch (e) {
    if (browser && !connectUrl) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
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
    const res = await axios.get(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
    });
    html = typeof res.data === "string" ? res.data : "";
    finalUrl = res.request?.res?.responseUrl || fullUrl;
    headerText = Object.entries(res.headers || {})
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
  } catch (e) {
    // axios failed — will use puppeteer below
  }

  // --- Step 2: Puppeteer when thin, blocked, or Cloudflare challenge ---
  const tempText = html
    ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const needsBrowser =
    !html ||
    tempText.length < 1200 ||
    isChallengeOrBlockedHtml(html) ||
    /just a moment/i.test(tempText);

  if (needsBrowser) {
    try {
      console.log(`[scrapeWebsite] Using browser render for ${domain}`);
      const rendered = await fetchHtmlWithPuppeteer(fullUrl);
      if (rendered.html && !isChallengeOrBlockedHtml(rendered.html)) {
        html = rendered.html;
        finalUrl = rendered.finalUrl || fullUrl;
      } else if (rendered.html && rendered.html.length > html.length) {
        html = rendered.html;
        finalUrl = rendered.finalUrl || fullUrl;
      }
    } catch (e2) {
      if (!html) throw new Error(`Could not fetch website ${fullUrl}`);
    }
  }

  if (!html || isChallengeOrBlockedHtml(html)) {
    throw new Error(`Blocked or empty page for ${fullUrl}`);
  }

  // --- Step 3: Independent deep crawl of relevant service/tech pages (not the whole site) ---
  const $ = cheerio.load(html);
  let servicePageHtmls: string[] = [];
  try {
    servicePageHtmls = await deepCrawlCompanyPages(html, finalUrl);
    console.log(
      `[scrapeWebsite] ${domain}: deep-crawled ${servicePageHtmls.length}/${MAX_PAGES_PER_COMPANY} relevant page(s)`
    );
  } catch (crawlErr) {
    console.warn(`[scrapeWebsite] ${domain}: deep crawl failed, homepage only`, crawlErr);
  }

  // --- Step 4: Analyze services & technologies with the rich analyzer ---
  let analysis: { services: string[]; technologies: string[] };
  try {
    analysis = analyzeContent({
      mainHtml: html,
      servicePageHtmls,
      headerText,
    });
  } catch (err) {
    console.error(`[scrapeWebsite] Analyzer failed for ${fullUrl}:`, err);
    analysis = { services: [], technologies: [] };
  }

  let companyName =
    cleanText($('meta[property="og:site_name"]').attr("content")) ||
    cleanText($('meta[name="application-name"]').attr("content")) ||
    cleanText($("title").first().text()) ||
    cleanText($("h1").first().text()) ||
    domain;

  if (companyName) {
    const parts = companyName.split(/[-–—|]/)[0].trim();
    if (parts) companyName = parts;
  }

  const companyUrl = finalUrl || fullUrl;

  let email = "";
  const emails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.replace("mailto:", "").split("?")[0].trim();
    if (m && EMAIL_REGEX.test(m)) emails.add(m);
  });
  const emailMeta =
    cleanText($('meta[name="email"]').attr("content")) ||
    cleanText($('meta[name="contact"]').attr("content"));
  if (emailMeta && EMAIL_REGEX.test(emailMeta)) emails.add(emailMeta);
  const textMatches = html.match(EMAIL_REGEX) || [];
  textMatches.forEach((m) => {
    if (
      !m.includes("example.com") &&
      !m.includes(".png") &&
      !m.includes(".jpg")
    ) {
      emails.add(m.toLowerCase());
    }
  });
  email = Array.from(emails)[0] || "";

  let phone = "";
  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = href
      .replace("tel:", "")
      .split("?")[0]
      .replace(/[^\d+]/g, "")
      .trim();
    if (num) phones.add(num);
  });
  const phoneMeta =
    cleanText($('meta[name="phone"]').attr("content")) ||
    cleanText($('meta[name="telephone"]').attr("content"));
  if (phoneMeta) phones.add(phoneMeta.replace(/[^\d+]/g, ""));
  const bodyText = $("body").text();
  const phoneMatches = bodyText.match(PHONE_REGEX) || [];
  phoneMatches.forEach((p) => {
    const clean = p.replace(/[^\d+]/g, "");
    if (clean.length >= 7 && clean.length <= 15) phones.add(clean);
  });
  phone = Array.from(phones)[0] || "";

  let service =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content")) ||
    cleanText($('meta[name="twitter:description"]').attr("content")) ||
    `${companyName} - Official Website`;

  const detectedServices =
    analysis.services.length > 0 ? analysis.services : ["No Services"];

  const technologies = analysis.technologies;

  const result: ScrapeResult = {
    companyName,
    companyUrl,
    companyEmail: email,
    companyPhone: phone,
    service,
    detectedServices,
    technologies,
  };

  return result;
}

export async function enrichCompanyResult(
  company: Partial<ScrapeResult> & Record<string, any>
): Promise<ScrapeResult> {
  const website =
    company.companyUrl ||
    company.websiteUrl ||
    company.website ||
    company.url ||
    "";

  const fallback: ScrapeResult = {
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
    const details = await scrapeWebsite(website);
    return {
      companyName: company.companyName || details.companyName || company.name || "N/A",
      companyUrl: details.companyUrl || website,
      companyPhone: details.companyPhone || company.companyPhone || "",
      companyEmail: details.companyEmail || company.companyEmail || "",
      service: details.service || company.service || "",
      detectedServices:
        Array.isArray(details.detectedServices) && details.detectedServices.length > 0
          ? details.detectedServices
          : Array.isArray(company.detectedServices)
            ? company.detectedServices
            : [],
      technologies:
        Array.isArray(details.technologies) && details.technologies.length > 0
          ? details.technologies
          : Array.isArray(company.technologies)
            ? company.technologies
            : [],
      address: company.address || details.address,
      rating: company.rating || details.rating,
    };
  } catch (error) {
    return fallback;
  }
}

export async function enrichGoogleSearchResults(
  companies: Array<Partial<ScrapeResult> & Record<string, any>>
): Promise<ScrapeResult[]> {
  const batchSize = 5;
  const enriched: ScrapeResult[] = [];

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((company) => enrichCompanyResult(company)));
    enriched.push(...batchResults);
  }

  return enriched;
}



async function extractPlacesFromGooglePage(page: any): Promise<ScrapeResult[]> {
  const rawPlaces = await page.evaluate(() => {
    const items: any[] = [];
    const seen = new Set<string>();

    const push = (name: string, website: string, extra: any = {}) => {
      const n = (name || "").trim();
      if (!n) return;
      const key = n.toLowerCase() + "|" + (website || "").toLowerCase();
      if (seen.has(key)) return;
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

    const localEls = document.querySelectorAll(
      'div[jscontroller="xkcUKe"], div.VkpGBb, div[data-result-index], div.rllt__link, a.vwVdIe, div[role="article"], div.g'
    );
    localEls.forEach((el: Element) => {
      const name =
        (el.querySelector('div[role="heading"], .dbg0pd, .qBF1Pd, h3, .OSrXXb') as HTMLElement)
          ?.innerText?.trim() ||
        (el as HTMLElement).innerText?.split("\n")[0]?.trim() ||
        "";
      const ratingText =
        (el.querySelector('[aria-label*="stars"], .Aq14fc') as HTMLElement)?.innerText?.trim() || "";
      const address =
        (el.querySelector(".rllt__details, .yEWOzc, .rllt__wrapped, .a4gq8e, .W4Efsd") as HTMLElement)
          ?.innerText?.trim() || "";
      let website =
        (el.querySelector('a[href*="url?q="], a[data-url], a[href^="http"]') as HTMLAnchorElement)
          ?.href || "";
      const dataUrl = (el.querySelector("[data-url]") as HTMLElement)?.getAttribute("data-url");
      if (dataUrl && /^https?:/i.test(dataUrl)) website = dataUrl;
      if (website && website.includes("url?q=")) {
        try {
          const params = new URLSearchParams(website.split("?")[1]);
          website = params.get("q") || website;
        } catch {
          /* ignore */
        }
      }
      if (/google\./i.test(website)) website = "";
      push(name, website, { rating: ratingText, address });
    });

    if (items.length === 0) {
      document.querySelectorAll('div.g, div[role="article"], div[data-ved]').forEach((el: Element) => {
        const a = el.querySelector("a") as HTMLAnchorElement;
        const h = el.querySelector("h3") as HTMLElement;
        const name = (h?.innerText || a?.innerText || "").trim();
        let website = a?.href || "";
        if (/google\./i.test(website)) website = "";
        push(name, website);
      });
    }

    return items;
  });

  return (rawPlaces || []) as ScrapeResult[];
}

function dedupeGooglePlaces(places: ScrapeResult[]): ScrapeResult[] {
  const seen = new Set<string>();
  const out: ScrapeResult[] = [];
  for (const p of places) {
    const key = `${(p.companyName || "").toLowerCase()}|${(p.companyUrl || "")
      .toLowerCase()
      .replace(/\/$/, "")}`;
    if (!p.companyName || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Google Local search with CAPTCHA support — scrapes ALL pages until empty or max pages.
 * CAPTCHA: solve once in the open Chrome window; session is reused for the rest.
 */
export async function scrapeGoogleSearchPlaces(
  originalUrl: string
): Promise<ScrapeResult[]> {
  // Optional: skip Google and use directories only
  if (process.env.USE_NO_CAPTCHA_DIRS === "true") {
    const { scrapeLocalPlacesNoCaptcha } = await import("./noCaptchaScraper");
    return (await scrapeLocalPlacesNoCaptcha(originalUrl)) as ScrapeResult[];
  }

  const { query, startOffset } = buildCleanSearchUrl(originalUrl);
  const pageSize = 20;
  const maxPages = Math.max(
    1,
    Math.min(25, Number(process.env.GOOGLE_MAX_PAGES || 12))
  );
  // If user passed a start offset, begin there; otherwise page 1
  const firstStart = startOffset > 0 ? startOffset : 0;

  console.log(
    `[Google] Full company list scrape for "${query}" (up to ${maxPages} pages, CAPTCHA OK once)`
  );

  let page: any;
  const all: ScrapeResult[] = [];

  try {
    const launched = await launchCaptchaBrowser();
    page = launched.page;

    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // --- STEP 1: open Google search and WAIT for CAPTCHA solve BEFORE scraping ---
    console.log("[CAPTCHA] Step 1/2: Opening Google — solve CAPTCHA if shown, then scrape starts.");
    await page.setViewport({ width: 1280, height: 900 }).catch(() => {});
    await page
      .goto("https://www.google.com/", { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch(() => {});
    await loadGoogleCookies(page);
    await sleep(1000);

    const firstUrl =
      `https://www.google.com/search?q=${encodeURIComponent(query)}` +
      `&tbm=lcl&num=${pageSize}&hl=en` +
      (firstStart > 0 ? `&start=${firstStart}` : "");
    console.log(`[CAPTCHA] Opening: ${firstUrl}`);
    try {
      await page.goto(firstUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (navErr: any) {
      console.warn(`[CAPTCHA] Navigation warning: ${navErr?.message || navErr}`);
    }
    try { await page.bringToFront(); } catch { /* ignore */ }
    await sleep(1500);

    // BLOCK HERE until CAPTCHA solved / results visible — scraping has NOT started yet
    await waitForCaptchaClear(page, 300000);
    console.log("[CAPTCHA] Step 2/2: CAPTCHA done — scraping ALL company pages now...");
    await sleep(1000);

    for (let i = 0; i < maxPages; i++) {
      const start = firstStart + i * pageSize;
      const pageNumber = Math.floor(start / pageSize) + 1;
      const cleanUrl =
        `https://www.google.com/search?q=${encodeURIComponent(query)}` +
        `&tbm=lcl&num=${pageSize}&hl=en` +
        (start > 0 ? `&start=${start}` : "");

      console.log(`[Google] Page ${pageNumber}/${maxPages} start=${start}`);

      // Page 1 already opened during CAPTCHA gate — don't reload (avoids new CAPTCHA)
      if (i > 0) {
        console.log(`[Google] URL: ${cleanUrl}`);
        try {
          await page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        } catch (navErr: any) {
          const msg = String(navErr?.message || navErr);
          if (/target closed|session closed/i.test(msg)) {
            sharedBrowser = null;
            sharedPage = null;
            throw new Error(
              "Chrome closed during page load. Keep the Chrome window open and try again."
            );
          }
          console.warn(`[Google] Navigation warning: ${msg}`);
        }
        await sleep(1500);
        if (await isGoogleCaptchaPage(page)) {
          await waitForCaptchaClear(page, 300000);
        }
      }

      for (let s = 0; s < 4; s++) {
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await sleep(700);
      }

      const batch = await extractPlacesFromGooglePage(page);
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
      console.log(
        `[Google] Running total: ${all.length} unique companies (+${Math.max(0, added)} new)`
      );

      if (added === 0 && i > 0) {
        console.log(`[Google] No new companies on page ${pageNumber} — stopping.`);
        break;
      }

      await sleep(1500 + Math.floor(Math.random() * 1500));
    }

    await saveGoogleCookies(page);
    console.log(`[Google] DONE — full list: ${all.length} unique companies`);
    return all;
  } catch (error) {
    try {
      if (page && page.isClosed?.()) sharedPage = null;
    } catch {
      sharedBrowser = null;
      sharedPage = null;
    }
    throw error;
  }
}


