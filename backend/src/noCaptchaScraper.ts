import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

export interface LocalPlaceResult {
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

const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function extractQuery(originalUrl: string): {
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
    const q = u.searchParams.get("q");
    if (q && q.trim()) {
      query = q.trim();
    } else if (u.pathname.includes("/maps/search/")) {
      const parts = u.pathname.split("/maps/search/");
      if (parts[1]) {
        query = decodeURIComponent(parts[1].split("/")[0]).replace(/\+/g, " ");
      }
    }
    const start = u.searchParams.get("start");
    if (start) {
      const parsed = parseInt(start, 10);
      if (!isNaN(parsed) && parsed >= 0) startOffset = parsed;
    }
  } catch {
    /* keep defaults */
  }
  return {
    query,
    startOffset,
    pageNumber: Math.floor(startOffset / 20) + 1,
  };
}

function emptyPlace(
  partial: Partial<LocalPlaceResult> & Record<string, any>
): LocalPlaceResult {
  return {
    companyName: partial.companyName || "N/A",
    companyUrl: partial.companyUrl || "",
    companyPhone: partial.companyPhone || "",
    companyEmail: partial.companyEmail || "",
    service: partial.service || "",
    detectedServices: Array.isArray(partial.detectedServices)
      ? partial.detectedServices
      : [],
    technologies: Array.isArray(partial.technologies)
      ? partial.technologies
      : [],
    address: partial.address,
    rating: partial.rating,
  };
}

function dedupePlaces(places: LocalPlaceResult[]): LocalPlaceResult[] {
  const seen = new Set<string>();
  const out: LocalPlaceResult[] = [];
  for (const p of places) {
    const key = `${(p.companyName || "").toLowerCase()}|${getDomain(
      p.companyUrl || ""
    )}`;
    if (!p.companyName || p.companyName === "N/A") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function looksLikeCompanySite(url: string): boolean {
  if (!url) return false;
  let href = url.trim();
  if (!/^https?:\/\//i.test(href)) {
    href = "https://" + href.replace(/^\/\//, "");
  }
  try {
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host.length < 3) return false;
    if (
      /(^|\.)(google|bing|duckduckgo|youtube|facebook|instagram|twitter|x|linkedin|yelp|wikipedia|microsoft|apple|msn|live|office|aka\.ms|whatsapp|wa\.me|yellowpages|bbb\.org)(\.|$)/i.test(
        host
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Split "web design chicago" -> { terms: "web design", location: "Chicago, IL" } */
function splitServiceAndLocation(query: string): { terms: string; location: string } {
  const q = cleanText(query);
  const cityMap: Record<string, string> = {
    chicago: "Chicago, IL",
    "new york": "New York, NY",
    "los angeles": "Los Angeles, CA",
    houston: "Houston, TX",
    phoenix: "Phoenix, AZ",
    philadelphia: "Philadelphia, PA",
    "san antonio": "San Antonio, TX",
    "san diego": "San Diego, CA",
    dallas: "Dallas, TX",
    "san jose": "San Jose, CA",
    austin: "Austin, TX",
    jacksonville: "Jacksonville, FL",
    seattle: "Seattle, WA",
    denver: "Denver, CO",
    boston: "Boston, MA",
    miami: "Miami, FL",
    atlanta: "Atlanta, GA",
  };

  const lower = q.toLowerCase();
  for (const city of Object.keys(cityMap).sort((a, b) => b.length - a.length)) {
    if (lower.endsWith(city) || lower.includes(` in ${city}`) || lower.includes(` ${city}`)) {
      const terms = q
        .replace(new RegExp(`\\s+in\\s+${city}$`, "i"), "")
        .replace(new RegExp(`\\s+${city}$`, "i"), "")
        .replace(new RegExp(city, "i"), "")
        .trim();
      return { terms: terms || q, location: cityMap[city] };
    }
  }

  // Fallback: last word as city
  const parts = q.split(/\s+/);
  if (parts.length >= 2) {
    return {
      terms: parts.slice(0, -1).join(" "),
      location: parts[parts.length - 1],
    };
  }
  return { terms: q, location: q };
}

/**
 * Yellow Pages via headless Chrome — multi-page local listings (no Google CAPTCHA).
 */
export async function scrapeYellowPagesPlaces(
  query: string
): Promise<LocalPlaceResult[]> {
  const { terms, location } = splitServiceAndLocation(query);
  const maxPages = Math.max(1, Math.min(10, Number(process.env.YP_MAX_PAGES || 6)));

  let browser: any;
  try {
    let execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    if (!execPath) {
      for (const p of [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ]) {
        if (fs.existsSync(p)) {
          execPath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--lang=en-US,en",
        "--window-size=1280,900",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const allRaw: any[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url =
        `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(terms)}` +
        `&geo_location_terms=${encodeURIComponent(location)}` +
        (pageNum > 1 ? `&page=${pageNum}` : "");
      console.log(`[No-CAPTCHA] Yellow Pages page ${pageNum}/${maxPages}: ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await sleep(2500);
      for (let i = 0; i < 3; i++) {
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await sleep(600);
      }

      const raw = await page.evaluate(() => {
        const items: any[] = [];
        const cards = document.querySelectorAll(
          "div.result, .search-results .result, .v-card, .srp-listing"
        );
        const nodes =
          cards.length > 0
            ? cards
            : document.querySelectorAll("a.business-name");

        nodes.forEach((node) => {
          const card =
            (node as HTMLElement).closest?.(
              "div.result, .v-card, .srp-listing, li, article"
            ) || node;
          const nameEl =
            (card as HTMLElement).querySelector?.(
              "a.business-name, .business-name"
            ) || (node as HTMLElement);
          const name = (nameEl as HTMLElement)?.innerText?.trim() || "";
          if (!name) return;

          let website = "";
          const siteA = (card as HTMLElement).querySelector?.(
            "a.track-visit-website, a.website-link, a[class*='website']"
          ) as HTMLAnchorElement | null;
          if (siteA?.href) website = siteA.href;

          if (!website) {
            (card as HTMLElement)
              .querySelectorAll?.('a[href^="http"]')
              .forEach((a) => {
                const href = (a as HTMLAnchorElement).href || "";
                if (
                  href &&
                  !/yellowpages\.com|facebook\.com|yelp\.com|bbb\.org/i.test(href)
                ) {
                  website = href;
                }
              });
          }

          const phone =
            (
              (card as HTMLElement).querySelector?.(
                ".phones, .phone, [class*='phone']"
              ) as HTMLElement
            )?.innerText?.trim() || "";
          const address =
            (
              (card as HTMLElement).querySelector?.(
                ".adr, .address, .street-address, [class*='address']"
              ) as HTMLElement
            )?.innerText?.trim() || "";

          items.push({
            companyName: name,
            companyUrl: website,
            companyPhone: phone,
            address,
          });
        });

        return items;
      });

      console.log(`[No-CAPTCHA] Yellow Pages page ${pageNum}: ${raw.length} raw cards`);
      if (!raw.length) break;
      allRaw.push(...raw);
      await sleep(1200);
    }

    await browser.close();
    browser = null;

    const places = dedupePlaces(
      allRaw.map((r: any) =>
        emptyPlace({
          companyName: r.companyName,
          companyUrl: r.companyUrl,
          companyPhone: (r.companyPhone || "").replace(/[^\d+]/g, ""),
          address: r.address,
          service: `${terms} — ${location}`,
        })
      )
    );

    console.log(`[No-CAPTCHA] Yellow Pages total unique listings: ${places.length}`);
    return places;
  } catch (err: any) {
    console.warn(`[No-CAPTCHA] Yellow Pages failed: ${err?.message || err}`);
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    return [];
  }
}
export async function scrapeYelpPlaces(query: string): Promise<LocalPlaceResult[]> {
  const { terms, location } = splitServiceAndLocation(query);
  const url =
    `https://www.yelp.com/search?find_desc=${encodeURIComponent(terms)}` +
    `&find_loc=${encodeURIComponent(location)}`;
  console.log(`[No-CAPTCHA] Yelp search: ${url}`);

  let browser: any;
  try {
    let execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    if (!execPath) {
      for (const p of [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ]) {
        if (fs.existsSync(p)) {
          execPath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--lang=en-US,en",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(3000);

    const raw = await page.evaluate(() => {
      const items: any[] = [];
      const cards = document.querySelectorAll(
        '[data-testid="serp-ia-card"], li[class*="border-color"], div[class*="container__"] h3, h3 a'
      );
      // Prefer business name links under main results
      document.querySelectorAll('a[href*="/biz/"]').forEach((a) => {
        const el = a as HTMLAnchorElement;
        const name = (el.innerText || "").trim();
        const href = el.href || "";
        if (!name || name.length < 2) return;
        if (!href.includes("/biz/")) return;
        // Skip review/photo sublinks
        if (/\/biz\/[^/]+\/(reviews|photos|map)/i.test(href)) return;
        items.push({
          companyName: name,
          companyUrl: "", // Yelp page; website enrichment may fill later
          yelpUrl: href.split("?")[0],
          rating: "",
          address: "",
          companyEmail: "",
          companyPhone: "",
          service: "",
          detectedServices: [],
          technologies: [],
        });
      });
      return items;
    });

    await browser.close();
    browser = null;

    // Keep Yelp biz pages as companyUrl temporarily so enrichment can try; filter empty names
    const places = dedupePlaces(
      (raw || []).map((r: any) =>
        emptyPlace({
          companyName: r.companyName,
          companyUrl: r.yelpUrl || "",
          service: `${terms} â€” ${location}`,
        })
      )
        ).slice(0, 100);

    console.log(`[No-CAPTCHA] Yelp found ${places.length} listings`);
    return places;
  } catch (err: any) {
    console.warn(`[No-CAPTCHA] Yelp failed: ${err?.message || err}`);
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    return [];
  }
}

/** DuckDuckGo HTML â€” no CAPTCHA, no paid API, no Google. */
export async function scrapeDuckDuckGoPlaces(
  query: string
): Promise<LocalPlaceResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log(`[No-CAPTCHA] DuckDuckGo HTML search: ${url}`);

  try {
    const res = await axios.post(
      "https://html.duckduckgo.com/html/",
      `q=${encodeURIComponent(query)}&b=`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: "https://html.duckduckgo.com/",
        },
        timeout: 25000,
        maxRedirects: 5,
        validateStatus: () => true,
      }
    );

    if (res.status >= 400) {
      console.warn(`[No-CAPTCHA] DuckDuckGo HTTP ${res.status}`);
    }

    const $ = cheerio.load(res.data || "");
    const items: LocalPlaceResult[] = [];

    $(".result, .web-result, .results_links, .links_main").each((_, el) => {
      const titleEl = $(el).find("a.result__a, .result__a, h2 a, a.result__url, a").first();
      const name = cleanText(titleEl.text());
      let href = titleEl.attr("href") || "";
      try {
        if (href.includes("uddg=")) {
          const u = new URL(href.startsWith("http") ? href : `https:${href}`);
          href = decodeURIComponent(u.searchParams.get("uddg") || href);
        }
      } catch {
        /* keep href */
      }
      const snippet = cleanText(
        $(el).find(".result__snippet, .result__body").text()
      );
      if (!name || !looksLikeCompanySite(href)) return;

      const phones = snippet.match(PHONE_REGEX) || [];
      items.push(
        emptyPlace({
          companyName: name,
          companyUrl: href,
          companyPhone: phones[0] ? phones[0].replace(/[^\d+]/g, "") : "",
          service: snippet.slice(0, 180),
          address: "",
        })
      );
    });

    // Fallback: any result__a anchors
    if (items.length === 0) {
      $("a.result__a").each((_, el) => {
        const name = cleanText($(el).text());
        let href = $(el).attr("href") || "";
        try {
          if (href.includes("uddg=")) {
            const u = new URL(href.startsWith("http") ? href : `https:${href}`);
            href = decodeURIComponent(u.searchParams.get("uddg") || href);
          }
        } catch {
          /* keep */
        }
        if (!name || !looksLikeCompanySite(href)) return;
        items.push(emptyPlace({ companyName: name, companyUrl: href }));
      });
    }

    console.log(`[No-CAPTCHA] DuckDuckGo found ${items.length} results`);
    return dedupePlaces(items    ).slice(0, 100);
  } catch (err: any) {
    console.warn(`[No-CAPTCHA] DuckDuckGo failed: ${err?.message || err}`);
    return [];
  }
}

/** Bing HTML via headless Chrome â€” no CAPTCHA, no paid API, no Google. */
export async function scrapeBingLocalPlaces(
  query: string
): Promise<LocalPlaceResult[]> {
  // Force US English market so local business queries return real company sites
  const bingUrl =
    `https://www.bing.com/search?q=${encodeURIComponent(query)}` +
    `&mkt=en-US&setlang=en-US&cc=US&count=20`;
  console.log(`[No-CAPTCHA] Bing search: ${bingUrl}`);

  let browser: any;
  try {
    const execPathEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
    let execPath = execPathEnv || undefined;
    if (!execPath) {
      for (const p of [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ]) {
        if (fs.existsSync(p)) {
          execPath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,900",
        "--lang=en-US,en",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    await page.goto(bingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);

    for (let i = 0; i < 3; i++) {
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await sleep(800);
    }

    const raw = await page.evaluate(() => {
      const items: any[] = [];
      const seen = new Set<string>();

      const add = (name: string, website: string, snippet: string) => {
        const n = (name || "").trim();
        const w = (website || "").trim();
        if (!n || !w) return;
        const key = n.toLowerCase() + "|" + w.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          companyName: n,
          companyUrl: w,
          rating: "",
          address: "",
          companyEmail: "",
          companyPhone: "",
          service: (snippet || "").slice(0, 200),
          detectedServices: [],
          technologies: [],
        });
      };

      document.querySelectorAll("li.b_algo").forEach((el) => {
        const a = el.querySelector("h2 a") as HTMLAnchorElement;
        const name = (a?.innerText || "").trim();
        let website = a?.href || "";
        const cite = (el.querySelector("cite") as HTMLElement)?.innerText || "";
        const citeUrl = (() => {
          const t = (cite || "").replace(/\s+/g, " ").trim();
          if (!t) return "";
          if (/^https?:\/\//i.test(t)) return t;
          const domain = t.split(/[â€º>]/)[0].trim().replace(/\s+/g, "");
          if (domain && domain.includes(".")) return "https://" + domain;
          return "";
        })();
        if (citeUrl) website = citeUrl;
        const snippet =
          (
            el.querySelector(
              ".b_caption p, .b_lineclamp2, .b_algoSlug, .b_attribution"
            ) as HTMLElement
          )?.innerText?.trim() || "";
        add(name, website, snippet);
      });

      return items;
    });

    await browser.close();
    browser = null;

    // Prefer cite domain (real site) over Bing redirect hrefs
    const normalized = (raw || []).map((r: any) => {
      let url = r.companyUrl || "";
      try {
        const u = new URL(url);
        if (u.hostname.includes("bing.com")) {
          // try query params commonly used by Bing
          for (const key of ["u", "r", "url"]) {
            const val = u.searchParams.get(key);
            if (!val) continue;
            try {
              let decoded = val;
              if (/^a1/i.test(decoded)) {
                decoded = Buffer.from(decoded.slice(2), "base64").toString("utf8");
              } else {
                try {
                  decoded = Buffer.from(decoded, "base64").toString("utf8");
                } catch {
                  decoded = decodeURIComponent(val);
                }
              }
              if (/^https?:\/\//i.test(decoded)) {
                url = decoded;
                break;
              }
            } catch {
              /* keep */
            }
          }
        }
      } catch {
        /* keep */
      }
      return emptyPlace({ ...r, companyUrl: url });
    });

    let filtered = dedupePlaces(
      normalized.filter((r: LocalPlaceResult) => looksLikeCompanySite(r.companyUrl))
        ).slice(0, 100);

    // If everything filtered, still keep named results with any http link for enrichment
    if (filtered.length === 0) {
      filtered = dedupePlaces(
        normalized.filter(
          (r: LocalPlaceResult) =>
            !!r.companyName &&
            r.companyName.length > 2 &&
            /^https?:\/\//i.test(r.companyUrl || "") &&
            !/bing\.com|microsoft\.com|whatsapp/i.test(r.companyUrl)
        )
            ).slice(0, 80);
    }

    console.log(`[No-CAPTCHA] Bing found ${filtered.length} company sites`);
    if (filtered.length === 0 && (raw || []).length > 0) {
      console.warn(
        `[No-CAPTCHA] Bing returned ${(raw || []).length} raw hits but none looked like company websites.`
      );
    }
    return filtered;
  } catch (err: any) {
    console.warn(`[No-CAPTCHA] Bing failed: ${err?.message || err}`);
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    return [];
  }
}

/**
 * Use Google Maps/Search URL only to read the query, then scrape directories (no Google).
 * Pulls as many listings as possible from Yellow Pages (multi-page) + Bing + DuckDuckGo + Yelp.
 */
export async function scrapeLocalPlacesNoCaptcha(
  originalUrl: string
): Promise<LocalPlaceResult[]> {
  const { query, startOffset, pageNumber } = extractQuery(originalUrl);

  console.log(
    `[No-CAPTCHA] Local scrape Page ${pageNumber} (start=${startOffset}) for: "${query}"`
  );
  console.log(
    `[No-CAPTCHA] Collecting FULL company list from Yellow Pages (multi-page) + Bing + DuckDuckGo + Yelp.`
  );

  // Yellow Pages first (paginated), then parallel search engines + Yelp
  const yp = await scrapeYellowPagesPlaces(query);
  const [bing, ddg, yelp] = await Promise.all([
    scrapeBingLocalPlaces(query),
    scrapeDuckDuckGoPlaces(query),
    scrapeYelpPlaces(query),
  ]);

  let merged = dedupePlaces([...yp, ...bing, ...ddg, ...yelp]).filter((p) => {
    const url = (p.companyUrl || "").toLowerCase();
    if (!url) return true; // keep name/phone-only rows — website resolved later
    return !/(localsearch\.com|facebook\.com|instagram\.com|linkedin\.com|wa\.me|whatsapp)/i.test(
      url
    );
  });

  console.log(
    `[No-CAPTCHA] Sources — YP:${yp.length} Bing:${bing.length} DDG:${ddg.length} Yelp:${yelp.length}`
  );
  console.log(`[No-CAPTCHA] Total unique companies to scrape: ${merged.length}`);
  return merged;
}

