const puppeteer = require('puppeteer');

(async () => {
  const urlPage1 = 'https://www.google.com/search?q=surat+it+company&udm=1';
  const urlPage2 = 'https://www.google.com/search?q=surat+it+company&udm=1&start=20';

  function getStartOffset(urlStr) {
    try {
      const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      const start = u.searchParams.get('start');
      return start ? parseInt(start, 10) : 0;
    } catch {
      return 0;
    }
  }

  console.log('Page 1 offset:', getStartOffset(urlPage1)); // Expected: 0
  console.log('Page 2 offset:', getStartOffset(urlPage2)); // Expected: 20

  const query = 'surat it company';
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(mapsUrl, { waitUntil: 'networkidle2' });

  // Scroll 6 times to get at least 40+ places
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
    await new Promise(r => setTimeout(r, 1200));
  }

  const allPlaces = await page.evaluate(() => {
    const items = [];
    const feed = document.querySelector('div[role="feed"]') || document.body;
    const cards = Array.from(feed.querySelectorAll('div[role="article"], div.Nv2PK, div.THTBg'));
    const seen = new Set();

    for (const card of cards) {
      const heading = card.querySelector('.qBF1Pd, .fontHeadlineSmall, [role="heading"]');
      const name = heading ? heading.textContent.trim() : '';
      if (!name || seen.has(name)) continue;

      let websiteUrl = '';
      const webLink = card.querySelector('a[aria-label*="website" i], a[title*="website" i], a[data-value="Website"]');
      if (webLink) websiteUrl = webLink.getAttribute('href') || '';

      seen.add(name);
      items.push({ name, websiteUrl });
    }
    return items;
  });

  await browser.close();

  console.log(`Total places loaded: ${allPlaces.length}`);
  
  const offsetP1 = getStartOffset(urlPage1);
  const offsetP2 = getStartOffset(urlPage2);

  const page1Items = allPlaces.slice(offsetP1, offsetP1 + 20);
  const page2Items = allPlaces.slice(offsetP2, offsetP2 + 20);

  console.log(`--- Page 1 (${page1Items.length} items) ---`);
  page1Items.forEach((p, idx) => console.log(`${idx + 1}. ${p.name}`));

  console.log(`\n--- Page 2 (${page2Items.length} items) ---`);
  page2Items.forEach((p, idx) => console.log(`${idx + 21}. ${p.name}`));
})();
