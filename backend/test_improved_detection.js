const { analyzeContent } = require('./dist/analyzer');

// Test with a realistic company homepage that mentions many services and technologies
const realisticHomepage = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="WordPress 6.4.3" />
  <meta name="description" content="We are a top IT company offering web development, mobile app development, ecommerce solutions, digital marketing, SEO, UI/UX design and custom software development." />
  <title>Top IT Company in Surat | Web & Mobile App Development</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <link rel="stylesheet" href="https://www.example.com/wp-content/themes/example/style.css" />
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
    <a href="/ecommerce-development">Ecommerce Development</a>
    <a href="/software-development">Software Development</a>
    <a href="/digital-marketing">Digital Marketing</a>
    <a href="/seo-services">SEO Services</a>
    <a href="/ui-ux-design">UI/UX Design</a>
    <a href="/contact">Contact Us</a>
  </nav>
  <h1>Example IT Solutions</h1>
  <p>We provide web development, mobile app development, UI/UX design and custom software development.</p>
  <p>Our ecommerce website development with Shopify and WooCommerce helps you sell online.</p>
  <p>We offer digital marketing, SEO services, social media marketing, and PPC campaigns.</p>
  <p>Our technology stack includes React, Node.js, PHP, Laravel, MySQL, MongoDB, and AWS.</p>
  <p>We build mobile apps with Flutter and React Native for Android and iOS.</p>
  <p>Contact us at +91 98765 43210 for a free consultation.</p>
  <footer>
    <a href="/services">Our Services</a>
    <a href="/solutions">Solutions</a>
    <a href="/portfolio">Portfolio</a>
    Copyright © 2024 Example IT Solutions
  </footer>
</body>
</html>
`;

const servicesPage = `
<!DOCTYPE html>
<html>
<head><title>Our Services - Example IT Solutions</title></head>
<body>
  <h1>Our Services</h1>
  <ul>
    <li>Website Development</li>
    <li>Web Application Development</li>
    <li>Ecommerce Development (Shopify, WooCommerce, Magento)</li>
    <li>Mobile App Development (Flutter, React Native)</li>
    <li>Custom Software Development</li>
    <li>UI/UX Design</li>
    <li>SEO Services</li>
    <li>Digital Marketing</li>
    <li>Social Media Marketing</li>
    <li>PPC / Google Ads</li>
    <li>Website Maintenance</li>
    <li>Cloud & DevOps Solutions</li>
    <li>API Development & Integration</li>
    <li>Software Testing & QA</li>
    <li>Data Analytics & BI</li>
    <li>ERP Development</li>
    <li>CRM Development</li>
    <li>Chatbot Development</li>
    <li>Blockchain Development</li>
    <li>Game Development</li>
  </ul>
</body>
</html>
`;

const result = analyzeContent({
  mainHtml: realisticHomepage,
  servicePageHtmls: [servicesPage],
});

console.log('=== SERVICES DETECTED (expected more than before) ===');
result.services.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
console.log(`  Total: ${result.services.length}`);

console.log('\n=== TECHNOLOGIES DETECTED (expected more than before) ===');
result.technologies.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
console.log(`  Total: ${result.technologies.length}`);

// Verify all expected services are found
const expectedServices = [
  'Web Development',
  'Ecommerce Development',
  'Mobile App Development',
  'Custom Software Development',
  'UI/UX Design',
  'SEO Services',
  'Digital Marketing',
  'Social Media Marketing',
  'PPC / Google Ads',
  'Website Maintenance',
  'DevOps & Cloud',
  'API Development & Integration',
  'Software Testing & QA',
  'Data Analytics & BI',
  'ERP Development',
  'CRM Development',
  'Chatbot Development',
  'Blockchain Development',
  'Game Development',
];

let passed = 0;
let failed = 0;
for (const svc of expectedServices) {
  const ok = result.services.includes(svc);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${svc}`);
  if (ok) passed++; else failed++;
}

// Check expected technologies from text mentions
const expectedTech = ['React', 'Flutter', 'React Native'];
for (const tech of expectedTech) {
  const ok = result.technologies.some(t => t.toLowerCase().includes(tech.toLowerCase()));
  console.log(`${ok ? 'PASS' : 'FAIL'}: tech mention ${tech}`);
  if (ok) passed++; else failed++;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);