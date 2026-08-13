const { scrapeGoogleSearchPlaces, scrapeWebsite } = require('./backend/dist/scraper');
const { exportData } = require('./exportHelper');
const axios = require('axios');
const cheerio = require('cheerio');

const MAX_CONCURRENT_COMPANIES = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_COMPANIES) || 3
);
const WEBSITE_TIMEOUT_MS = Math.max(
  20000,
  Number(process.env.WEBSITE_TIMEOUT_MS) || 120000
);
const MAX_WEBSITE_RETRIES = Math.max(1, Number(process.env.MAX_WEBSITE_RETRIES) || 3);

/** Isolated per-URL cache — never shared across different company hosts. */
const websiteResultCache = new Map();

const JUNK_HOST_RE =
  /(localsearch\.com|yellowpages\.com|yelp\.com|bbb\.org|facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|bing\.com|duckduckgo\.com|google\.|microsoft\.com|whatsapp|wa\.me)/i;

function isJunkOrMissingWebsite(url) {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (!t) return true;
  if (/^https?:\/\/?$/.test(t)) return true;
  if (t.startsWith('data:')) return true;
  if (t.length < 6) return true;
  try {
    const host = new URL(t.startsWith('http') ? t : `https://${t}`).hostname.toLowerCase();
    return JUNK_HOST_RE.test(host);
  } catch {
    return true;
  }
}

/**
 * When listing has no real website, try DuckDuckGo HTML for "Company Name official site".
 */
async function resolveWebsiteFromName(companyName, locationHint) {
  if (!companyName || companyName === 'N/A') return '';
  const q = [companyName, locationHint, 'official website']
    .filter(Boolean)
    .join(' ')
    .trim();
  try {
    const res = await axios.post(
      'https://html.duckduckgo.com/html/',
      `q=${encodeURIComponent(q)}&b=`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://html.duckduckgo.com/',
        },
        timeout: 20000,
        validateStatus: () => true,
      }
    );
    const $ = cheerio.load(res.data || '');
    let found = '';
    $('a.result__a').each((_, el) => {
      if (found) return;
      let href = $(el).attr('href') || '';
      try {
        if (href.includes('uddg=')) {
          const u = new URL(href.startsWith('http') ? href : `https:${href}`);
          href = decodeURIComponent(u.searchParams.get('uddg') || href);
        }
      } catch (_) {}
      if (!href || !/^https?:\/\//i.test(href)) return;
      if (isJunkOrMissingWebsite(href)) return;
      found = href;
    });
    return found;
  } catch (e) {
    console.warn(`Website resolve failed for ${companyName}:`, e.message);
    return '';
  }
}

function cacheKeyForWebsite(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Website timeout after ${ms}ms (${label})`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Isolated deep scrape for one company. Failures never throw out of the batch.
 */
async function scrapeCompanyWebsiteIsolated(websiteField, nameField) {
  const key = cacheKeyForWebsite(websiteField);
  if (websiteResultCache.has(key)) {
    return websiteResultCache.get(key);
  }
  let lastError;
  for (let attempt = 1; attempt <= MAX_WEBSITE_RETRIES; attempt++) {
    try {
      const result = await withTimeout(
        scrapeWebsite(websiteField),
        WEBSITE_TIMEOUT_MS,
        nameField || websiteField
      );
      websiteResultCache.set(key, result);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(
        `[isolated] ${nameField || websiteField} attempt ${attempt}/${MAX_WEBSITE_RETRIES} failed:`,
        (error && error.message) || error
      );
      if (attempt < MAX_WEBSITE_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }
  throw lastError || new Error('Website scrape failed');
}

/**
 * Main service to orchestrate the entire scraping process.
 * Scrapes ALL companies in the list (resolves missing websites when possible).
 */
async function scrapeGooglePlacesAndWebsites(googleSearchUrl, ws) {
  const sendJSON = (type, payload) => ws.send(JSON.stringify({ type, ...payload }));

  try {
    sendJSON('STATUS_UPDATE', { message: 'Starting Google full company list scrape (CAPTCHA OK — solve once if shown)...' });

    try {
      let url = new URL(googleSearchUrl);
      if (url.hostname.includes('google.') && url.pathname === '/search') {
        if (url.searchParams.get('tbm') !== 'lcl') {
          url.searchParams.set('tbm', 'lcl');
          const paramsToRemove = [
            'sca_esv',
            'sxsrf',
            'udm',
            'lsack',
            'ved',
            'biw',
            'bih',
            'dpr',
            'sourceid',
            'ie',
          ];
          paramsToRemove.forEach((p) => url.searchParams.delete(p));
          googleSearchUrl = url.toString();
        }
      }
    } catch (e) {
      console.warn('Could not parse or modify the provided URL, proceeding with original.', e.message);
    }

    sendJSON('STATUS_UPDATE', {
      message: 'STEP 1: Chrome opening — solve Google CAPTCHA first, then scraping starts...',
    });

    const initialCompanies = await scrapeGoogleSearchPlaces(googleSearchUrl);

    if (initialCompanies.length === 0) {
      sendJSON('STATUS_UPDATE', {
        message: 'No companies found for the given URL. The process will stop.',
      });
      sendJSON('SCRAPING_COMPLETE', {
        message: 'Scraping complete! No results found.',
        results: [],
        exportFiles: {},
      });
      return;
    }

    websiteResultCache.clear();

    sendJSON('STATUS_UPDATE', {
      message: `Found ${initialCompanies.length} companies. Resolving websites and scraping ALL of them...`,
    });
    sendJSON('TOTAL_COMPANIES', { total: initialCompanies.length });

    // Pre-resolve missing/junk websites so every company can be enriched when possible
    const locationHint = (() => {
      try {
        const u = new URL(googleSearchUrl.startsWith('http') ? googleSearchUrl : `https://${googleSearchUrl}`);
        const q = u.searchParams.get('q') || '';
        if (q) return q.split(/\s+/).slice(-1)[0];
        if (u.pathname.includes('/maps/search/')) {
          const part = decodeURIComponent(u.pathname.split('/maps/search/')[1] || '').replace(/\+/g, ' ');
          return part.split(/\s+/).slice(-1)[0];
        }
      } catch (_) {}
      return '';
    })();

    for (let i = 0; i < initialCompanies.length; i++) {
      const c = initialCompanies[i];
      const websiteField = c.websiteUrl || c.companyUrl || c.website || c.url || '';
      const nameField = c.name || c.companyName || '';
      if (isJunkOrMissingWebsite(websiteField) && nameField) {
        sendJSON('STATUS_UPDATE', {
          message: `Resolving website ${i + 1}/${initialCompanies.length}: ${nameField}`,
        });
        const resolved = await resolveWebsiteFromName(nameField, locationHint);
        if (resolved) {
          console.log(`[resolve] ${nameField} => ${resolved}`);
          c.companyUrl = resolved;
        }
      }
    }

    const allResults = [];
    let completedCount = 0;

    for (let i = 0; i < initialCompanies.length; i += MAX_CONCURRENT_COMPANIES) {
      const batch = initialCompanies.slice(i, i + MAX_CONCURRENT_COMPANIES);

      const batchPromises = batch.map((company) => {
        const websiteField =
          company.websiteUrl || company.companyUrl || company.website || company.url || '';
        const nameField = company.name || company.companyName || '';

        if (isJunkOrMissingWebsite(websiteField)) {
          completedCount++;
          const progress = (completedCount / initialCompanies.length) * 100;
          sendJSON('PROGRESS_UPDATE', {
            progress,
            message: `Kept listing (no website) ${completedCount}/${initialCompanies.length}: ${nameField}`,
          });
          const fallbackResult = {
            ...company,
            companyUrl: websiteField || '',
            companyName: nameField || company.companyName || 'N/A',
            detectedServices: Array.isArray(company.detectedServices)
              ? company.detectedServices
              : [],
            technologies: Array.isArray(company.technologies) ? company.technologies : [],
            error: 'No company website found — listing data only',
          };
          sendJSON('DATA_UPDATE', { company: fallbackResult });
          return Promise.resolve(fallbackResult);
        }

        return scrapeCompanyWebsiteIsolated(websiteField, nameField)
          .then((result) => {
            completedCount++;
            const progress = (completedCount / initialCompanies.length) * 100;
            sendJSON('PROGRESS_UPDATE', {
              progress,
              message: `Deep-scraped ${completedCount}/${initialCompanies.length}: ${nameField || websiteField}`,
            });

            const mergedResult = {
              ...company,
              ...result,
              companyName: nameField || result.companyName,
              companyPhone: result.companyPhone || company.companyPhone || '',
              companyEmail: result.companyEmail || company.companyEmail || '',
              address: company.address || result.address,
            };

            sendJSON('DATA_UPDATE', { company: mergedResult });
            return mergedResult;
          })
          .catch((error) => {
            console.error(`Failed to scrape ${websiteField}:`, (error && error.message) || error);
            completedCount++;
            const progress = (completedCount / initialCompanies.length) * 100;
            sendJSON('PROGRESS_UPDATE', {
              progress,
              message: `Failed website, kept listing ${completedCount}/${initialCompanies.length}: ${nameField}`,
            });
            const fallbackResult = {
              ...company,
              companyUrl: websiteField,
              companyName: nameField || company.companyName || 'N/A',
              detectedServices: [],
              technologies: [],
              error: `Failed to scrape: ${(error && error.message) || error}`,
            };
            sendJSON('DATA_UPDATE', { company: fallbackResult });
            return fallbackResult;
          });
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);

      // Refresh downloadable files after every batch so Export Excel works mid-scrape
      // (e.g. 50, 100, 160 rows) without waiting for the full run to finish.
      try {
        const liveFiles = await exportData(allResults, 'scrape-in-progress');
        sendJSON('EXPORT_READY', {
          exportFiles: liveFiles,
          count: allResults.length,
          message: `${allResults.length} companies ready to export`,
        });
      } catch (exportErr) {
        console.warn('Live export failed:', exportErr.message);
      }
    }

    sendJSON('STATUS_UPDATE', {
      message: `Exporting ${allResults.length}/${initialCompanies.length} companies...`,
    });
    const exportFiles = await exportData(allResults);

    sendJSON('SCRAPING_COMPLETE', {
      message: `Scraping complete! ${allResults.length} companies processed.`,
      results: allResults,
      exportFiles,
    });
  } catch (error) {
    console.error('An error occurred during the scraping process:', error);
    sendJSON('ERROR', { message: `A critical error occurred: ${error.message}` });
  }
}

module.exports = { scrapeGooglePlacesAndWebsites };
