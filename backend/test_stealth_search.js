const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const targetUrl = 'https://www.google.com/search?q=surat+it+company&sca_esv=cc5c7de7f204be12&rlz=1C1GCCA_en&sxsrf=APpeQnsvYBpj7Up9r7fw3APbWKrYyf7tXw:1785818517591&udm=1&lsack=lW1xarLYI9e5seMPwrG6kQs&sa=X&ved=2ahUKEwjy9v6ylIaWAxXXXGwGHcKYLrIQjGp6BAg1EAA&biw=2560&bih=1225&dpr=0.75';
  
  console.log('Testing Stealth Google Search URL:', targetUrl);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  const html = await page.content();
  console.log('HTML size:', html.length, 'Title:', await page.title());
  fs.writeFileSync('stealth_search.html', html);

  // Check extracted headings / company names
  const placeNames = await page.evaluate(() => {
    const items = [];
    const elements = document.querySelectorAll('[role="heading"], h3, .OSrC9, .qBF1Pd, .dbg0pd, .vwV14, .rnGtFd, .v55F0e');
    elements.forEach(el => {
      const txt = el.textContent ? el.textContent.trim() : '';
      if (txt && txt.length > 2 && !items.includes(txt)) items.push(txt);
    });
    return items;
  });

  console.log('Found place headings on EXACT page:', JSON.stringify(placeNames, null, 2));

  await browser.close();
})();
