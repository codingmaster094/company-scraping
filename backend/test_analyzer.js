const { analyzeContent } = require('./dist/analyzer');

// Simulated real-world company homepage (WordPress + common services + technologies)
const homepage = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="WordPress 6.4.3" />
  <meta name="description" content="We are a leading web development and digital marketing agency in Pune." />
  <title>ABC IT Solutions | Web Development & SEO Services Pune</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <link rel="stylesheet" href="https://www.abcitsolutions.com/wp-content/themes/abc/style.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX"></script>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/web-development">Web Development</a>
    <a href="/mobile-app-development">Mobile App Development</a>
    <a href="/seo-services">SEO Services</a>
    <a href="/contact">Contact Us</a>
  </nav>
  <h1>ABC IT Solutions</h1>
  <p>We provide web development, mobile app development, UI/UX design and custom software development.</p>
  <p>We build ecommerce websites with Shopify and WooCommerce. Our SEO services and digital marketing help you grow.</p>
  <p>Contact us at +91 98765 43210</p>
  <footer>Copyright © 2024 ABC IT Solutions</footer>
</body>
</html>
`;

const servicesPage = `
<!DOCTYPE html>
<html>
<head><title>Our Services - ABC IT Solutions</title></head>
<body>
  <h1>Our Services</h1>
  <ul>
    <li>Website Development</li>
    <li>Ecommerce Development (Shopify, WooCommerce, Magento)</li>
    <li>Mobile App Development (Flutter, React Native)</li>
    <li>UI/UX Design</li>
    <li>SEO Services</li>
    <li>Digital Marketing</li>
    <li>Website Maintenance</li>
    <li>Cloud & DevOps Solutions</li>
  </ul>
</body>
</html>
`;

const result = analyzeContent({
  mainHtml: homepage,
  servicePageHtmls: [servicesPage],
});

console.log('=== SERVICES DETECTED ===');
result.services.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
console.log('\n=== TECHNOLOGIES DETECTED ===');
result.technologies.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

// Assertions
const checks = [];
checks.push(['Web Development', result.services.includes('Web Development')]);
checks.push(['Ecommerce Development', result.services.includes('Ecommerce Development')]);
checks.push(['Mobile App Development', result.services.includes('Mobile App Development')]);
checks.push(['UI/UX Design', result.services.includes('UI/UX Design')]);
checks.push(['SEO Services', result.services.includes('SEO Services')]);
checks.push(['Digital Marketing', result.services.includes('Digital Marketing')]);
checks.push(['Website Maintenance', result.services.includes('Website Maintenance')]);
checks.push(['DevOps & Cloud', result.services.includes('DevOps & Cloud')]);
checks.push(['WordPress', result.technologies.some(t => t.startsWith('WordPress'))]);
checks.push(['jQuery', result.technologies.some(t => t.startsWith('jQuery'))]);
checks.push(['Bootstrap', result.technologies.some(t => t.startsWith('Bootstrap'))]);
checks.push(['Font Awesome', result.technologies.includes('Font Awesome')]);
checks.push(['Google Analytics', result.technologies.includes('Google Analytics')]);

let passed = 0;
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (ok) passed++; else failed++;
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
