const puppeteer = require('puppeteer');

(async () => {
  // Strategy: Build a minimal clean search URL with only q + start params
  // This avoids CAPTCHA while scraping EXACT Google Search results
  
  const tests = [
    { name: 'Page 1', url: 'https://www.google.com/search?q=surat+it+company&udm=1&num=20&hl=en&gl=in' },
    { name: 'Page 2', url: 'https://www.google.com/search?q=surat+it+company&udm=1&num=20&hl=en&gl=in&start=20' },
  ];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1920,1080']
  });
  
  for (const test of tests) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9', 'Upgrade-Insecure-Requests': '1' });
    await page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.goto(test.url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const isCaptcha = bodyText.includes('unusual traffic') || bodyText.length < 500;
    
    if (isCaptcha) {
      console.log(`${test.name}: CAPTCHA BLOCKED`);
      await page.close();
      continue;
    }

    const places = await page.evaluate(() => {
      const SKIP = ['Choose what', 'Customised date', 'feedback', 'Map', 'Results'];
      const names = [];
      const els = document.querySelectorAll('[role="heading"], .qBF1Pd, .OSrC9, .v55F0e, .dbg0pd');
      for (const el of els) {
        const txt = el.textContent ? el.textContent.trim() : '';
        if (txt.length > 2 && !SKIP.some(s => txt.includes(s)) && !names.includes(txt)) {
          names.push(txt);
        }
      }
      return names;
    });

    console.log(`\n${test.name} (${places.length} results):`);
    places.forEach((p, i) => console.log(`  ${i+1}. ${p}`));
    await page.close();
  }

  await browser.close();
})();
