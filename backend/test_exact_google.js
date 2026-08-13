const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const urlPage1 = 'https://www.google.com/search?q=surat+it+company&udm=1';
  
  console.log('Inspecting Google Search Page 1 URL:', urlPage1);
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

  await page.goto(urlPage1, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));
  
  const html = await page.content();
  fs.writeFileSync('search_page1.html', html);
  await page.screenshot({ path: 'search_page1.png' });
  
  console.log('Saved html (size:', html.length, ') and screenshot.');
  
  // Inspect all headings or links
  const elementsInfo = await page.evaluate(() => {
    const list = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent && (el.textContent.includes('La Net') || el.textContent.includes('Hunani') || el.textContent.includes('Casepoint'))) {
        list.push({
          tag: el.tagName,
          class: el.className,
          role: el.getAttribute('role'),
          id: el.id,
          text: el.textContent.trim().substring(0, 100)
        });
      }
    }
    return list.slice(0, 15);
  });

  console.log('Elements containing company names:', JSON.stringify(elementsInfo, null, 2));

  await browser.close();
})();
