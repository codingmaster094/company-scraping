/**
 * Strict extraction: services from nav/footer/cards.
 * Technologies = COMPANY_SUPPORTED only (explicit development/expertise offers).
 * Never return WEBSITE_DETECTED stack (HTML, headers, JS, CDN, analytics).
 */
import * as cheerio from "cheerio";

export interface StrictAnalyzerInput {
  mainHtml: string;
  servicePageHtmls?: string[];
  headerText?: string;
}

export interface StrictAnalysisResult {
  services: string[];
  technologies: string[];
}

const NAV_NOISE =
  /^(home|about(\s+us)?|our\s+team|team|blog|news|contact|get\s+a\s+quote|careers?|jobs?|privacy|terms|login|shop|cart|search|portfolio|work|case\s+studies|reviews?|testimonials?|locations?|faq|resources?|white\s*label)$/i;

const SERVICE_RULES: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "Website Design", patterns: [/\bweb(?:site)?\s+design(?:ing)?\b/i] },
  { name: "Web Development", patterns: [/\bweb(?:site)?\s+development\b/i] },
  { name: "Ecommerce Development", patterns: [/\be-?commerce(?:\s+web)?(?:\s+design|\s+development)?\b/i] },
  { name: "WordPress Development", patterns: [/\bwordpress\s+(?:development|design|websites?)\b/i] },
  { name: "Shopify Development", patterns: [/\bshopify\s+(?:development|stores?|design)\b/i] },
  { name: "WooCommerce Development", patterns: [/\bwoocommerce\s+(?:development|stores?)?\b/i] },
  { name: "Magento Development", patterns: [/\bmagento\s+(?:development|2)?\b/i] },
  { name: "Wix Web Design", patterns: [/\bwix\s+(?:web\s+)?(?:site\s+)?design\b/i] },
  { name: "Graphic Design", patterns: [/\bgraphic\s+design\b/i] },
  { name: "Logo Design", patterns: [/\blogo\s+design\b/i] },
  { name: "Branding & Identity", patterns: [/\bbrand(?:ing)?(?:\s*&\s*|\s+)identity\b/i, /\bcorporate\s+branding\b/i] },
  { name: "Content Writing / Copywriting", patterns: [/\bcontent\s+writ(?:ing|er)\b/i, /\bcopywrit(?:ing|er)\b/i] },
  { name: "Blog Writing", patterns: [/\bblog\s+writ/i] },
  { name: "Video Production & Animation", patterns: [/\bvideo\s+(?:production|&\s*animation|animation)\b/i, /\banimation\s+services?\b/i] },
  { name: "SEO", patterns: [/\bseo\b/i, /\bsearch\s+engine\s+optimi[sz]ation\b/i] },
  { name: "Google Ads / PPC", patterns: [/\bgoogle\s+ads?\b/i, /\bgoogle\s+adwords\b/i, /\bppc\b/i, /\bpay[\s-]?per[\s-]?click\b/i] },
  { name: "Digital Marketing", patterns: [/\bdigital\s+marketing\b/i] },
  { name: "Social Media Management", patterns: [/\bsocial\s+media(?:\s+marketing|\s+management|\s+services?)?\b/i] },
  { name: "Press Release & Distribution", patterns: [/\bpress\s+release\b/i] },
  { name: "Backlink Building", patterns: [/\bbacklink(?:s|\s+building)?\b/i] },
  { name: "Tagline & Slogan Writing", patterns: [/\btagline\b/i, /\bslogan\b/i] },
  { name: "UI/UX Design", patterns: [/\bui\s*\/?\s*ux\s+design\b/i, /\buser\s+experience\s+design\b/i, /\buser\s+interface\s+design\b/i] },
  { name: "Mobile App Development", patterns: [/\bmobile\s+app(?:lication)?\s+development\b/i] },
  { name: "Custom Software Development", patterns: [/\bcustom\s+software\s+development\b/i] },
  { name: "Website Maintenance", patterns: [/\bwebsite\s+maintenance\b/i] },
];

const SERVICE_NEVER_INFER = [
  /\bai\/ml\s+custom\s+development\b/i,
  /\bpos\s*&\s*inventory\b/i,
  /\bcontent\s+marketing\b/i,
  /\bemail\s+marketing\b/i,
  /\bcrm\b/i,
  /\bmarketing\s+automation\b/i,
];

/** Longer names first so Shopify Plus wins over Shopify. */
const OFFERED_TECH: Array<{ name: string; token: RegExp }> = [
  { name: "Shopify Plus", token: /\bshopify\s+plus\b/i },
  { name: "React Native", token: /\breact\s+native\b/i },
  { name: "WooCommerce", token: /\bwoocommerce\b/i },
  { name: "WordPress", token: /\bwordpress\b/i },
  { name: "Squarespace", token: /\bsquarespace\b/i },
  { name: "BigCommerce", token: /\bbigcommerce\b/i },
  { name: "PrestaShop", token: /\bprestashop\b/i },
  { name: "OpenCart", token: /\bopencart\b/i },
  { name: "Elementor", token: /\belementor\b/i },
  { name: "Shopify", token: /\bshopify\b/i },
  { name: "Magento", token: /\bmagento(?:\s*2)?\b/i },
  { name: "Webflow", token: /\bwebflow\b/i },
  { name: "Laravel", token: /\blaravel\b/i },
  { name: "Drupal", token: /\bdrupal\b/i },
  { name: "Joomla", token: /\bjoomla\b/i },
  { name: "HubSpot", token: /\bhubspot\b/i },
  { name: "Next.js", token: /\bnext(?:\.js|js)\b/i },
  { name: "Node.js", token: /\bnode(?:\.js|js)\b/i },
  { name: "Vue.js", token: /\bvue(?:\.js|js)?\b/i },
  { name: "Angular", token: /\bangular(?:\.js|js)?\b/i },
  { name: "TypeScript", token: /\btypescript\b/i },
  { name: "JavaScript", token: /\bjavascript\b/i },
  { name: "Flutter", token: /\bflutter\b/i },
  { name: "Django", token: /\bdjango\b/i },
  { name: "Python", token: /\bpython\b/i },
  { name: "Duda", token: /\bduda\b/i },
  { name: "Wix", token: /\bwix\b/i },
  { name: "React", token: /\breact(?:\.js|js)?\b/i },
  { name: "PHP", token: /\bphp\b/i },
];

const NEVER_TECH = new Set([
  "Cloudflare",
  "Google Analytics",
  "Google Tag Manager",
  "jQuery",
  "HTML",
  "HTML5",
  "CSS",
  "CSS3",
  "Sass",
  "Babel",
  "Lodash",
  "Sentry",
  "Webpack",
  "Vite",
  "CDN",
]);

const HIGH_AFTER = String.raw`(?:\s+(?:cms|framework|platform|plus))?` +
  String.raw`\s+(?:development|developers?|design(?:ing)?|services?|experts?|specialists?|agency|websites?|stores?|apps?|applications?)`;

const HIGH_BEFORE =
  String.raw`(?:we\s+(?:provide|offer|specialize\s+in|are\s+experts?\s+in|build\s+(?:on|with)|work\s+with|develop(?:\s+on|\s+in)?|create)|` +
  String.raw`our\s+expertise\s+(?:includes?|in)|expertise\s+(?:includes?|in)|` +
  String.raw`speciali[sz]e(?:s|d)?\s+in|` +
  String.raw`technologies\s+we\s+work\s+with|platforms?\s+we\s+work\s+with|` +
  String.raw`platform\s+expertise)`;

const MEDIUM_SECTION =
  /\b(platform(?:s)?\s+(?:we\s+work\s+with|expertise)|technologies\s+we\s+work\s+with|our\s+platforms?|tech(?:nology)?\s+stack\s+we|cms\s+we|ecommerce\s+platforms?|we\s+build\s+(?:on|across)|short\s+list\s+of\s+our\s+platform)\b/i;

const FOOTER_BUILT_WITH = /\bbuilt\s+with\s+(?:wix|wordpress|squarespace|webflow|shopify)\b/i;

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function extractScopedLabels(html: string): string[] {
  const $ = cheerio.load(html || "");
  const labels: string[] = [];
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || t.length < 2 || t.length > 80) return;
    if (NAV_NOISE.test(t)) return;
    labels.push(t);
  };

  $("header, nav, footer, [role='navigation'], [role='contentinfo'], [role='banner']")
    .find("a, button, [role='menuitem'], [role='listitem'], h2, h3, h4")
    .each((_, el) => push($(el).text()));

  $("main h2, main h3, section h2, section h3").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length <= 60) push(t);
  });

  return labels;
}

function mapServiceLabel(label: string): string | null {
  const t = label.trim();
  if (SERVICE_NEVER_INFER.some((rx) => rx.test(t))) return null;
  for (const rule of SERVICE_RULES) {
    if (rule.patterns.some((rx) => rx.test(t))) return rule.name;
  }
  return null;
}

function visibleCopy(html: string): string {
  const $ = cheerio.load(html || "");
  $("script, style, noscript, template, iframe, svg").remove();
  $("footer, [role='contentinfo']").find("*").each((_, el) => {
    const t = $(el).text();
    if (FOOTER_BUILT_WITH.test(t)) $(el).remove();
  });
  return ($("body").text() || html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

function evidenceForToken(copy: string, token: RegExp): Confidence {
  const re = new RegExp(token.source, "gi");
  let best: Confidence = "NONE";
  let m: RegExpExecArray | null;
  while ((m = re.exec(copy)) !== null) {
    const idx = m.index;
    const window = copy.slice(Math.max(0, idx - 90), Math.min(copy.length, idx + m[0].length + 90));
    const highAfter = new RegExp(`${token.source}${HIGH_AFTER}`, "i");
    const highBefore = new RegExp(`${HIGH_BEFORE}[^.]{0,80}${token.source}`, "i");
    const navOffer = new RegExp(
      `${token.source}\\s+(?:web\\s+)?(?:site\\s+)?(?:design|development|stores?|websites?|packages?)`,
      "i"
    );
    if (highAfter.test(window) || highBefore.test(window) || navOffer.test(window)) {
      return "HIGH";
    }
    if (MEDIUM_SECTION.test(copy)) {
      const sectionIdx = copy.search(MEDIUM_SECTION);
      if (sectionIdx >= 0 && token.test(copy.slice(sectionIdx, sectionIdx + 800))) {
        best = "MEDIUM";
        continue;
      }
    }
    if (/[✔✓]/.test(copy) && new RegExp(`[✔✓]\\s*${token.source}`, "i").test(copy)) {
      best = "MEDIUM";
      continue;
    }
    if (best === "NONE") best = "LOW";
  }
  return best;
}

function extractCompanySupportedTech(htmls: string[], labels: string[]): string[] {
  const copy = htmls.map(visibleCopy).concat(labels).join(" \n ");
  const found: string[] = [];
  const claimed = new Set<string>();

  for (const tech of OFFERED_TECH) {
    if (NEVER_TECH.has(tech.name)) continue;
    if (claimed.has(tech.name)) continue;
    // Shopify Plus already claimed → skip generic Shopify duplicate only if Plus matched as Plus
    const conf = evidenceForToken(copy, tech.token);
    if (conf !== "HIGH" && conf !== "MEDIUM") continue;
    found.push(tech.name);
    claimed.add(tech.name);
    if (tech.name === "Shopify Plus") claimed.add("Shopify");
  }

  // Second pass: can we point to explicit offer wording? Drop leftovers.
  return unique(found).filter((name) => {
    const def = OFFERED_TECH.find((t) => t.name === name);
    if (!def) return false;
    const conf = evidenceForToken(copy, def.token);
    return conf === "HIGH" || conf === "MEDIUM";
  });
}

export function extractVerified(options: StrictAnalyzerInput): StrictAnalysisResult {
  const htmls = [options.mainHtml, ...(options.servicePageHtmls || [])].filter(Boolean);
  const labels: string[] = [];
  for (const html of htmls) labels.push(...extractScopedLabels(html));

  const services = unique(
    labels.map(mapServiceLabel).filter((s): s is string => Boolean(s))
  );

  const technologies = extractCompanySupportedTech(htmls, labels);

  return { services, technologies };
}
