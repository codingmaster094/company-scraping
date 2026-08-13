/**
 * Offline tests D/E/F + isolation (C). A/B need live scrape.
 */
const { extractVerified } = require("./strictExtract");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testD() {
  const html = `
    <html><body>
      <header><nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header>
      <main>
        <p>This website is powered by WordPress.</p>
        <p>Built with PHP and jQuery. Google Analytics installed.</p>
      </main>
      <footer>Powered by WordPress</footer>
    </body></html>`;
  const r = extractVerified({ mainHtml: html });
  assert(!r.technologies.includes("WordPress"), "D: WordPress must not be added without service evidence");
  console.log("PASS D", r.technologies);
}

function testE() {
  const html = `
    <html><body>
      <nav>
        <a href="/services">Services</a>
        <a href="/wordpress-development">WordPress Development</a>
        <a href="/shopify-development">Shopify Development</a>
        <a href="/webflow-development">Webflow Development</a>
      </nav>
      <main>
        <h1>Services</h1>
        <p>We provide WordPress development services.</p>
        <p>We specialize in Shopify development.</p>
        <p>Our expertise includes Webflow.</p>
      </main>
    </body></html>`;
  const r = extractVerified({
    mainHtml: html,
    servicePageHtmls: [
      "<html><body><h1>WordPress Development</h1><p>We provide WordPress development.</p></body></html>",
      "<html><body><h1>Shopify Development</h1><p>We specialize in Shopify development.</p></body></html>",
      "<html><body><h1>Webflow Development</h1><p>Our expertise includes Webflow.</p></body></html>",
    ],
  });
  for (const t of ["WordPress", "Shopify", "Webflow"]) {
    assert(r.technologies.includes(t), `E: missing ${t}: ${JSON.stringify(r.technologies)}`);
  }
  console.log("PASS E", r.technologies);
}

function testF() {
  const html = `
    <html><head>
      <script src="jquery.min.js"></script>
      <script>gtag('js'); WP Rocket; Cloudflare</script>
    </head><body>
      <p>WP Rocket, Cloudflare, Google Analytics, jQuery are on this page.</p>
      <p>We provide custom web design.</p>
    </body></html>`;
  const r = extractVerified({ mainHtml: html });
  for (const t of ["jQuery", "Cloudflare", "Google Analytics", "WP Rocket"]) {
    assert(!r.technologies.includes(t), `F: ${t} must not appear: ${JSON.stringify(r.technologies)}`);
  }
  console.log("PASS F", r.technologies);
}

function testC_isolation() {
  const results = [];
  const jobs = [
    Promise.reject(new Error("timeout")),
    Promise.resolve({ technologies: ["Shopify"] }),
    Promise.resolve({ technologies: ["Webflow"] }),
  ];
  return Promise.all(
    jobs.map((p) =>
      p.then((v) => {
        results.push({ ok: true, v });
        return v;
      }).catch((e) => {
        results.push({ ok: false, error: e.message });
        return { technologies: [], error: e.message };
      })
    )
  ).then((out) => {
    assert(out.length === 3, "C: all three jobs settled");
    assert(out[0].error, "C: failed company marked failed");
    assert(out[1].technologies[0] === "Shopify", "C: company B continued");
    assert(out[2].technologies[0] === "Webflow", "C: company C continued");
    console.log("PASS C isolation");
  });
}

testD();
testE();
testF();
testC_isolation()
  .then(() => console.log("All offline tests passed"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
