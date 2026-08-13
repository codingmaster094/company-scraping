const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const urlPage2 = 'https://www.google.com/search?q=surat+it+company&udm=1&start=20';
  
  console.log('Testing Google Search Page 2 URL:', urlPage2);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=en-US,en'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto(urlPage2, { waitUntil: 'domcontentloaded', timeout: 45000 });
  
  await new Promise(r => setTimeout(r, 3000));
  
  const title = await page.title();
  console.log('Page Title:', title);
  
  // Extract companies on Page 2
  const placeData = await page.evaluate(() => {
    const items = [];
    const seen = new Set();
    
    // Selectors for Google Places search results cards (page-based)
    const cards = Array.from(document.querySelectorAll('.VkpForm, .rllt__details, .uE80Be, [jscontroller="VkpFyc"], div[data-cid]'));
    
    for (const card of cards) {
      const headingEl = card.querySelector('[role="heading"], h3, .OSrC9, .qBF1Pd, .dbg0pd, .vwV14, .rnGtFd');
      const name = headingEl ? headingEl.textContent.trim() : '';

      if (!name || seen.has(name) || name.toLowerCase().includes('results for')) continue;

      let websiteUrl = '';
      const webLinks = Array.from(card.querySelectorAll('a[href]'));
      for (const a of webLinks) {
        const href = a.getAttribute('href') || '';
        if (href.includes('/url?q=')) {
          try {
            const match = href.match(/\/url\?q=([^&]+)/);
            if (match && match[1]) websiteUrl = decodeURIComponent(match[1]);
          } catch {}
        } else if (href.startsWith('http') && !href.includes('google.com')) {
          websiteUrl = href;
        }
        if (websiteUrl) break;
      }

      let phone = '';
      const phoneMatch = card.textContent.match(/(?:\+91[\s-]?)?\d{5}[\s-]?\d{5}|\b0\d{2,4}[-.\s]?\d{6,8}\b|\b\d{10}\b/);
      if (phoneMatch) phone = phoneMatch[0];

      let rating = '';
      const ratingEl = card.querySelector('span[aria-label*="star" i], span[aria-label*="Rated" i], .MW4wKf, .yi40Hd');
      if (ratingEl) rating = ratingEl.textContent.trim() || ratingEl.getAttribute('aria-label') || '';

      seen.add(name);
      items.push({ name, websiteUrl, phone, rating });
    }
    return items;
  });

  console.log(`Page 2 found ${placeData.length} places:`);
  console.log(JSON.stringify(placeData.slice(0, 10), null, 2));

  await page.screenshot({ path: 'google_page2.png' });
  await browser.close();
})();
