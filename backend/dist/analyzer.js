"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeContent = analyzeContent;
exports.detectServices = detectServices;
exports.detectTechnologies = detectTechnologies;
/**
 * Analyzer module — strict verified Services + Technologies only.
 * Delegates to extractVerified (nav/footer/service pages + structural tech evidence).
 */
const strictExtract_1 = require("./strictExtract");
const SERVICE_CATALOG = [
    {
        name: "Custom Software Development",
        keywords: [
            { text: "custom software development", weight: 2 },
            { text: "custom application development", weight: 2 },
            { text: "bespoke software", weight: 2 },
            { text: "software product development", weight: 2 },
            { text: "custom software", weight: 1 },
            { text: "tailored software", weight: 2 },
            { text: "enterprise software development", weight: 2 },
            { text: "product engineering", weight: 2 },
            { text: "application development", weight: 1 },
            { text: "software solutions", weight: 1 },
            { text: "software services", weight: 1 },
        ],
    },
    {
        name: "Web Development",
        keywords: [
            { text: "website development", weight: 2 },
            { text: "web development", weight: 2 },
            { text: "web app development", weight: 2 },
            { text: "web application development", weight: 2 },
            { text: "web portal development", weight: 2 },
            { text: "website development company", weight: 2 },
            { text: "web development company", weight: 2 },
            { text: "website designing", weight: 1 },
            { text: "website design", weight: 1 },
            { text: "web designing", weight: 1 },
            { text: "web design", weight: 1 },
            { text: "website development services", weight: 2 },
            { text: "responsive website", weight: 1 },
            { text: "web application", weight: 1 },
            { text: "web solutions", weight: 1 },
            { text: "dynamic website", weight: 1 },
        ],
    },
    {
        name: "WordPress Development",
        keywords: [
            { text: "wordpress development", weight: 2 },
            { text: "wordpress website", weight: 1 },
            { text: "wordpress design", weight: 1 },
            { text: "wordpress customization", weight: 2 },
            { text: "wordpress developer", weight: 2 },
            { text: "wordpress site", weight: 1 },
        ],
    },
    {
        name: "Ecommerce Development",
        keywords: [
            { text: "ecommerce development", weight: 2 },
            { text: "e-commerce development", weight: 2 },
            { text: "ecommerce website", weight: 1 },
            { text: "e-commerce website", weight: 1 },
            { text: "online store development", weight: 2 },
            { text: "online shop", weight: 1 },
            { text: "ecommerce solution", weight: 2 },
            { text: "e-commerce solution", weight: 2 },
            { text: "ecommerce platform", weight: 1 },
            { text: "online shopping website", weight: 1 },
            { text: "b2b ecommerce", weight: 2 },
            { text: "b2c ecommerce", weight: 2 },
            { text: "ecommerce support", weight: 1 },
            { text: "woocommerce development", weight: 2 },
            { text: "shopify development", weight: 2 },
            { text: "magento development", weight: 2 },
        ],
    },
    {
        name: "Shopify Development",
        keywords: [
            { text: "shopify development", weight: 2 },
            { text: "shopify store", weight: 1 },
            { text: "shopify design", weight: 1 },
            { text: "shopify customization", weight: 2 },
            { text: "shopify expert", weight: 1 },
            { text: "shopify theme", weight: 1 },
            { text: "shopify app development", weight: 2 },
        ],
    },
    {
        name: "Magento Development",
        keywords: [
            { text: "magento development", weight: 2 },
            { text: "magento 2", weight: 1 },
            { text: "magento website", weight: 1 },
            { text: "magento customization", weight: 2 },
            { text: "magento migration", weight: 2 },
        ],
    },
    {
        name: "WooCommerce Development",
        keywords: [
            { text: "woocommerce development", weight: 2 },
            { text: "woocommerce customization", weight: 2 },
            { text: "woocommerce plugin", weight: 1 },
            { text: "woocommerce site", weight: 1 },
        ],
    },
    {
        name: "UI/UX Design",
        keywords: [
            { text: "ui/ux design", weight: 2 },
            { text: "ui ux design", weight: 2 },
            { text: "ui/ux", weight: 1 },
            { text: "ui ux", weight: 1 },
            { text: "ux design", weight: 2 },
            { text: "ui design", weight: 2 },
            { text: "user interface design", weight: 2 },
            { text: "user experience design", weight: 2 },
            { text: "ux ui", weight: 1 },
            { text: "user interface", weight: 1 },
            { text: "user experience", weight: 1 },
            { text: "wireframe", weight: 1 },
            { text: "prototype design", weight: 1 },
            { text: "interaction design", weight: 2 },
            { text: "design system", weight: 1 },
            { text: "ux research", weight: 2 },
            { text: "product design", weight: 2 },
            { text: "mobile app design", weight: 1 },
        ],
    },
    {
        name: "Website Design",
        keywords: [
            { text: "website design", weight: 2 },
            { text: "web design", weight: 2 },
            { text: "website designing", weight: 2 },
            { text: "web designing", weight: 2 },
            { text: "website design company", weight: 2 },
            { text: "web design company", weight: 2 },
            { text: "landing page design", weight: 2 },
            { text: "creative website design", weight: 2 },
            { text: "responsive web design", weight: 2 },
            { text: "website redesign", weight: 2 },
        ],
    },
    {
        name: "Website Maintenance",
        keywords: [
            { text: "website maintenance", weight: 2 },
            { text: "website maintenance services", weight: 2 },
            { text: "website support", weight: 1 },
            { text: "website maintenance & support", weight: 2 },
            { text: "maintenance and support", weight: 2 },
            { text: "website care plan", weight: 2 },
            { text: "web maintenance", weight: 2 },
            { text: "site maintenance", weight: 2 },
            { text: "annual maintenance contract", weight: 2 },
            { text: "amc", weight: 1 },
            { text: "website management", weight: 2 },
            { text: "ongoing support", weight: 1 },
        ],
    },
    {
        name: "SEO Services",
        keywords: [
            { text: "seo services", weight: 2 },
            { text: "search engine optimization", weight: 2 },
            { text: "search engine optimisation", weight: 2 },
            { text: "seo", weight: 1 },
            { text: "on-page seo", weight: 2 },
            { text: "off-page seo", weight: 2 },
            { text: "offpage seo", weight: 2 },
            { text: "technical seo", weight: 2 },
            { text: "local seo", weight: 2 },
            { text: "seo audit", weight: 2 },
            { text: "seo company", weight: 1 },
            { text: "seo optimization", weight: 2 },
            { text: "seo marketing", weight: 2 },
            { text: "search ranking", weight: 1 },
            { text: "keyword research", weight: 2 },
            { text: "link building", weight: 2 },
            { text: "backlink", weight: 1 },
        ],
    },
    {
        name: "Digital Marketing",
        keywords: [
            { text: "digital marketing", weight: 2 },
            { text: "digital marketing services", weight: 2 },
            { text: "digital marketing agency", weight: 2 },
            { text: "online marketing", weight: 2 },
            { text: "internet marketing", weight: 2 },
            { text: "marketing services", weight: 1 },
            { text: "digital marketing solutions", weight: 2 },
            { text: "performance marketing", weight: 2 },
            { text: "growth marketing", weight: 2 },
        ],
    },
    {
        name: "Social Media Marketing",
        keywords: [
            { text: "social media marketing", weight: 2 },
            { text: "social media management", weight: 2 },
            { text: "social media services", weight: 2 },
            { text: "social media optimization", weight: 2 },
            { text: "smo", weight: 1 },
            { text: "instagram marketing", weight: 2 },
            { text: "facebook marketing", weight: 2 },
            { text: "linkedin marketing", weight: 2 },
            { text: "social media ads", weight: 2 },
            { text: "community management", weight: 1 },
        ],
    },
    {
        name: "PPC / Google Ads",
        keywords: [
            { text: "google ads", weight: 2 },
            { text: "google adwords", weight: 2 },
            { text: "ppc", weight: 1 },
            { text: "pay per click", weight: 2 },
            { text: "pay-per-click", weight: 2 },
            { text: "adwords campaign", weight: 2 },
            { text: "ppc management", weight: 2 },
            { text: "google advertising", weight: 2 },
            { text: "display advertising", weight: 1 },
            { text: "ad campaigns", weight: 1 },
            { text: "paid search", weight: 2 },
            { text: "paid advertising", weight: 1 },
        ],
    },
    {
        name: "Email Marketing",
        keywords: [
            { text: "email marketing", weight: 2 },
            { text: "email campaigns", weight: 2 },
            { text: "email automation", weight: 2 },
            { text: "newsletter design", weight: 1 },
            { text: "bulk email", weight: 2 },
            { text: "mailchimp", weight: 1 },
            { text: "email blast", weight: 2 },
            { text: "drip campaign", weight: 2 },
        ],
    },
    {
        name: "Content Marketing",
        keywords: [
            { text: "content marketing", weight: 2 },
            { text: "content writing", weight: 2 },
            { text: "copywriting", weight: 2 },
            { text: "blog writing", weight: 2 },
            { text: "article writing", weight: 2 },
            { text: "content creation", weight: 1 },
            { text: "website content", weight: 1 },
            { text: "seo content", weight: 2 },
        ],
    },
    {
        name: "Video & Animation",
        keywords: [
            { text: "video production", weight: 2 },
            { text: "video marketing", weight: 2 },
            { text: "video editing", weight: 2 },
            { text: "2d animation", weight: 2 },
            { text: "3d animation", weight: 2 },
            { text: "motion graphics", weight: 2 },
            { text: "explainer video", weight: 2 },
            { text: "animated video", weight: 2 },
            { text: "product animation", weight: 1 },
            { text: "whiteboard animation", weight: 2 },
        ],
    },
    {
        name: "Logo Design",
        keywords: [
            { text: "logo design", weight: 2 },
            { text: "logo designing", weight: 2 },
            { text: "custom logo", weight: 2 },
            { text: "logo maker", weight: 1 },
            { text: "logo creation", weight: 2 },
            { text: "logo redesign", weight: 2 },
        ],
    },
    {
        name: "Graphic Design",
        keywords: [
            { text: "graphic design", weight: 2 },
            { text: "graphic designing", weight: 2 },
            { text: "graphic design services", weight: 2 },
            { text: "creative design", weight: 1 },
            { text: "visual design", weight: 1 },
            { text: "print design", weight: 1 },
            { text: "banner design", weight: 1 },
            { text: "social media creatives", weight: 1 },
            { text: "poster design", weight: 1 },
        ],
    },
    {
        name: "Branding & Identity",
        keywords: [
            { text: "branding", weight: 1 },
            { text: "brand identity", weight: 2 },
            { text: "branding services", weight: 2 },
            { text: "brand strategy", weight: 2 },
            { text: "rebranding", weight: 2 },
            { text: "corporate identity", weight: 2 },
            { text: "brochure design", weight: 2 },
            { text: "corporate branding", weight: 2 },
        ],
    },
    {
        name: "Mobile App Development",
        keywords: [
            { text: "mobile app development", weight: 2 },
            { text: "android app development", weight: 2 },
            { text: "ios app development", weight: 2 },
            { text: "iphone app development", weight: 2 },
            { text: "mobile application development", weight: 2 },
            { text: "cross platform app development", weight: 2 },
            { text: "flutter app development", weight: 2 },
            { text: "react native app development", weight: 2 },
            { text: "hybrid app development", weight: 2 },
            { text: "native app development", weight: 2 },
            { text: "mobile app design", weight: 1 },
            { text: "app development company", weight: 2 },
            { text: "mobile app", weight: 1 },
            { text: "ios development", weight: 2 },
            { text: "android development", weight: 2 },
            { text: "app developer", weight: 1 },
            { text: "mobile applications", weight: 2 },
        ],
    },
    {
        name: "ERP Development",
        keywords: [
            { text: "erp development", weight: 2 },
            { text: "erp software", weight: 2 },
            { text: "enterprise resource planning", weight: 2 },
            { text: "erp solutions", weight: 2 },
            { text: "erp implementation", weight: 2 },
            { text: "erp system", weight: 1 },
            { text: "sap", weight: 1 },
            { text: "erpnext", weight: 2 },
            { text: "odoo", weight: 2 },
            { text: "erp customization", weight: 2 },
        ],
    },
    {
        name: "CRM Development",
        keywords: [
            { text: "crm development", weight: 2 },
            { text: "crm software", weight: 2 },
            { text: "customer relationship management", weight: 2 },
            { text: "crm solution", weight: 2 },
            { text: "crm implementation", weight: 2 },
            { text: "salesforce", weight: 1 },
            { text: "crm customization", weight: 2 },
        ],
    },
    {
        name: "SaaS Development",
        keywords: [
            { text: "saas development", weight: 2 },
            { text: "saas product", weight: 2 },
            { text: "saas platform", weight: 1 },
            { text: "saas application", weight: 2 },
            { text: "multi-tenant", weight: 2 },
            { text: "subscription software", weight: 1 },
        ],
    },
    {
        name: "API Development & Integration",
        keywords: [
            { text: "api development", weight: 2 },
            { text: "api integration", weight: 2 },
            { text: "rest api", weight: 2 },
            { text: "restful api", weight: 2 },
            { text: "third party integration", weight: 2 },
            { text: "payment gateway integration", weight: 2 },
            { text: "payment integration", weight: 2 },
            { text: "software integration", weight: 2 },
            { text: "system integration", weight: 2 },
            { text: "webhook", weight: 1 },
            { text: "application integration", weight: 2 },
            { text: "zapier", weight: 1 },
        ],
    },
    {
        name: "AI / ML Development",
        keywords: [
            { text: "artificial intelligence", weight: 2 },
            { text: "machine learning", weight: 2 },
            { text: "ai development", weight: 2 },
            { text: "ai solutions", weight: 2 },
            { text: "ml models", weight: 2 },
            { text: "deep learning", weight: 2 },
            { text: "nlp", weight: 1 },
            { text: "natural language processing", weight: 2 },
            { text: "computer vision", weight: 2 },
            { text: "generative ai", weight: 2 },
            { text: "chatgpt integration", weight: 2 },
            { text: "ai chatbot", weight: 1 },
            { text: "predictive analytics", weight: 2 },
            { text: "data science", weight: 2 },
            { text: "llm", weight: 1 },
            { text: "ai consulting", weight: 2 },
            { text: "intelligent automation", weight: 2 },
        ],
    },
    {
        name: "Blockchain Development",
        keywords: [
            { text: "blockchain development", weight: 2 },
            { text: "blockchain solutions", weight: 2 },
            { text: "smart contract", weight: 2 },
            { text: "cryptocurrency", weight: 1 },
            { text: "nft", weight: 1 },
            { text: "defi", weight: 1 },
            { text: "web3", weight: 1 },
            { text: "dapp", weight: 2 },
            { text: "ethereum", weight: 1 },
            { text: "hyperledger", weight: 2 },
        ],
    },
    {
        name: "DevOps & Cloud",
        keywords: [
            { text: "devops", weight: 2 },
            { text: "cloud services", weight: 2 },
            { text: "cloud computing", weight: 2 },
            { text: "cloud migration", weight: 2 },
            { text: "aws services", weight: 2 },
            { text: "azure", weight: 1 },
            { text: "google cloud", weight: 2 },
            { text: "ci/cd", weight: 2 },
            { text: "kubernetes", weight: 1 },
            { text: "docker", weight: 1 },
            { text: "infrastructure management", weight: 2 },
            { text: "cloud hosting", weight: 2 },
            { text: "cloud solutions", weight: 2 },
            { text: "server management", weight: 2 },
            { text: "cloud infrastructure", weight: 2 },
        ],
    },
    {
        name: "Software Testing & QA",
        keywords: [
            { text: "software testing", weight: 2 },
            { text: "quality assurance", weight: 2 },
            { text: "qa testing", weight: 2 },
            { text: "automation testing", weight: 2 },
            { text: "automated testing", weight: 2 },
            { text: "manual testing", weight: 2 },
            { text: "test automation", weight: 2 },
            { text: "unit testing", weight: 1 },
            { text: "performance testing", weight: 2 },
            { text: "load testing", weight: 2 },
            { text: "security testing", weight: 2 },
            { text: "sdet", weight: 2 },
            { text: "regression testing", weight: 2 },
            { text: "api testing", weight: 2 },
            { text: "uat", weight: 1 },
        ],
    },
    {
        name: "Data Analytics & BI",
        keywords: [
            { text: "data analytics", weight: 2 },
            { text: "business intelligence", weight: 2 },
            { text: "data visualization", weight: 2 },
            { text: "power bi", weight: 2 },
            { text: "tableau", weight: 2 },
            { text: "data warehousing", weight: 2 },
            { text: "data engineering", weight: 2 },
            { text: "data mining", weight: 2 },
            { text: "analytics dashboard", weight: 2 },
            { text: "big data", weight: 2 },
            { text: "data analysis", weight: 2 },
            { text: "bi solutions", weight: 2 },
            { text: "reporting service", weight: 1 },
        ],
    },
    {
        name: "IoT Development",
        keywords: [
            { text: "internet of things", weight: 2 },
            { text: "iot development", weight: 2 },
            { text: "iot solutions", weight: 2 },
            { text: "embedded systems", weight: 2 },
            { text: "sensor integration", weight: 1 },
            { text: "smart devices", weight: 1 },
            { text: "firmware development", weight: 2 },
        ],
    },
    {
        name: "Chatbot Development",
        keywords: [
            { text: "chatbot development", weight: 2 },
            { text: "chatbot", weight: 1 },
            { text: "chat bot", weight: 2 },
            { text: "ai chatbot", weight: 2 },
            { text: "conversational ai", weight: 2 },
            { text: "virtual assistant", weight: 2 },
            { text: "voice assistant", weight: 2 },
        ],
    },
    {
        name: "Web Hosting & Domain",
        keywords: [
            { text: "web hosting", weight: 2 },
            { text: "website hosting", weight: 2 },
            { text: "domain registration", weight: 2 },
            { text: "domain name registration", weight: 2 },
            { text: "hosting services", weight: 2 },
            { text: "shared hosting", weight: 2 },
            { text: "vps hosting", weight: 2 },
            { text: "dedicated server", weight: 2 },
            { text: "cloud hosting", weight: 1 },
            { text: "ssl certificate", weight: 1 },
        ],
    },
    {
        name: "Cybersecurity",
        keywords: [
            { text: "cyber security", weight: 2 },
            { text: "cybersecurity", weight: 2 },
            { text: "cyber security services", weight: 2 },
            { text: "network security", weight: 2 },
            { text: "penetration testing", weight: 2 },
            { text: "ethical hacking", weight: 2 },
            { text: "vulnerability assessment", weight: 2 },
            { text: "information security", weight: 2 },
            { text: "security audit", weight: 1 },
            { text: "firewall", weight: 1 },
            { text: "security solutions", weight: 2 },
            { text: "threat detection", weight: 2 },
            { text: "security consulting", weight: 2 },
        ],
    },
    {
        name: "E-Learning / LMS",
        keywords: [
            { text: "e-learning", weight: 2 },
            { text: "elearning", weight: 2 },
            { text: "lms development", weight: 2 },
            { text: "learning management system", weight: 2 },
            { text: "training portal", weight: 2 },
            { text: "online course", weight: 1 },
            { text: "e-learning solutions", weight: 2 },
            { text: "educational software", weight: 2 },
        ],
    },
    {
        name: "Portal Development",
        keywords: [
            { text: "portal development", weight: 2 },
            { text: "job portal", weight: 2 },
            { text: "matrimonial website", weight: 2 },
            { text: "matrimony portal", weight: 2 },
            { text: "real estate portal", weight: 2 },
            { text: "classified portal", weight: 2 },
            { text: "directory website", weight: 2 },
            { text: "school management", weight: 2 },
            { text: "college management", weight: 2 },
            { text: "student management system", weight: 2 },
            { text: "hospital management", weight: 2 },
            { text: "clinic management", weight: 2 },
            { text: "gym management", weight: 2 },
            { text: "hotel management", weight: 2 },
            { text: "restaurant management", weight: 2 },
            { text: "tourism website", weight: 1 },
            { text: "travel portal", weight: 2 },
        ],
    },
    {
        name: "Booking & Reservation Systems",
        keywords: [
            { text: "booking system", weight: 2 },
            { text: "booking engine", weight: 2 },
            { text: "reservation system", weight: 2 },
            { text: "appointment booking", weight: 2 },
            { text: "online booking", weight: 2 },
            { text: "hotel booking", weight: 2 },
            { text: "cab booking", weight: 2 },
            { text: "ticket booking", weight: 2 },
            { text: "event booking", weight: 2 },
        ],
    },
    {
        name: "POS & Inventory",
        keywords: [
            { text: "pos software", weight: 2 },
            { text: "point of sale", weight: 2 },
            { text: "billing software", weight: 2 },
            { text: "inventory management", weight: 2 },
            { text: "stock management", weight: 2 },
            { text: "warehouse management", weight: 2 },
            { text: "retail management", weight: 2 },
            { text: "barcode system", weight: 2 },
            { text: "invoicing software", weight: 2 },
        ],
    },
    {
        name: "HR & Payroll Software",
        keywords: [
            { text: "hr software", weight: 2 },
            { text: "human resource management", weight: 2 },
            { text: "hrm software", weight: 2 },
            { text: "payroll software", weight: 2 },
            { text: "payroll management", weight: 2 },
            { text: "attendance system", weight: 2 },
            { text: "hrms", weight: 2 },
            { text: "recruitment software", weight: 2 },
            { text: "leave management", weight: 2 },
        ],
    },
    {
        name: "Accounting Software",
        keywords: [
            { text: "accounting software", weight: 2 },
            { text: "accounting solution", weight: 2 },
            { text: "bookkeeping software", weight: 2 },
            { text: "gst billing", weight: 2 },
            { text: "gst software", weight: 2 },
            { text: "tally integration", weight: 2 },
            { text: "accounting system", weight: 2 },
            { text: "tax software", weight: 1 },
        ],
    },
    {
        name: "IT Staffing & Outsourcing",
        keywords: [
            { text: "it staffing", weight: 2 },
            { text: "staff augmentation", weight: 2 },
            { text: "dedicated development team", weight: 2 },
            { text: "dedicated team", weight: 1 },
            { text: "it outsourcing", weight: 2 },
            { text: "offshore development", weight: 2 },
            { text: "onsite development", weight: 2 },
            { text: "hire developers", weight: 2 },
            { text: "hire dedicated", weight: 2 },
            { text: "software outsourcing", weight: 2 },
            { text: "contract developers", weight: 1 },
            { text: "it consultants", weight: 1 },
            { text: "technology consulting", weight: 2 },
            { text: "it consulting", weight: 2 },
            { text: "managed it services", weight: 2 },
            { text: "it support", weight: 2 },
            { text: "it services", weight: 1 },
            { text: "outsourcing services", weight: 2 },
        ],
    },
    {
        name: "Digital Transformation",
        keywords: [
            { text: "digital transformation", weight: 2 },
            { text: "digitalization", weight: 2 },
            { text: "digitalisation", weight: 2 },
            { text: "legacy modernization", weight: 2 },
            { text: "business automation", weight: 2 },
            { text: "process automation", weight: 2 },
            { text: "rpa", weight: 1 },
            { text: "workflow automation", weight: 2 },
            { text: "digital consulting", weight: 2 },
        ],
    },
    {
        name: "Database Management",
        keywords: [
            { text: "database design", weight: 2 },
            { text: "database development", weight: 2 },
            { text: "database management", weight: 2 },
            { text: "database administration", weight: 2 },
            { text: "data migration", weight: 2 },
            { text: "database optimization", weight: 2 },
            { text: "sql development", weight: 2 },
        ],
    },
    {
        name: "CRM / Marketing Automation",
        keywords: [
            { text: "marketing automation", weight: 2 },
            { text: "hubspot", weight: 1 },
            { text: "marketing automation tool", weight: 2 },
            { text: "lead generation", weight: 2 },
            { text: "lead management", weight: 2 },
            { text: "automation platform", weight: 1 },
        ],
    },
    // --- Additional common services for IT companies ---
    {
        name: "Game Development",
        keywords: [
            { text: "game development", weight: 2 },
            { text: "game design", weight: 2 },
            { text: "2d game", weight: 2 },
            { text: "3d game", weight: 2 },
            { text: "unity development", weight: 2 },
            { text: "unreal engine", weight: 2 },
            { text: "game developer", weight: 1 },
        ],
    },
    {
        name: "AR/VR Development",
        keywords: [
            { text: "augmented reality", weight: 2 },
            { text: "virtual reality", weight: 2 },
            { text: "ar development", weight: 2 },
            { text: "vr development", weight: 2 },
            { text: "mixed reality", weight: 2 },
        ],
    },
    {
        name: "AWS Development",
        keywords: [
            { text: "aws development", weight: 2 },
            { text: "aws solution", weight: 2 },
            { text: "amazon web services", weight: 2 },
            { text: "aws cloud", weight: 2 },
        ],
    },
    {
        name: "Dedicated Developers",
        keywords: [
            { text: "hire dedicated developers", weight: 2 },
            { text: "dedicated developers", weight: 2 },
            { text: "hire remote developers", weight: 2 },
            { text: "onsite developers", weight: 2 },
            { text: "outsource development", weight: 2 },
        ],
    },
    {
        name: "IT Consulting",
        keywords: [
            { text: "it consulting", weight: 2 },
            { text: "technology consulting", weight: 2 },
            { text: "tech consulting", weight: 2 },
            { text: "it consultancy", weight: 2 },
            { text: "digital consulting", weight: 2 },
        ],
    },
    {
        name: "Cloud Consulting",
        keywords: [
            { text: "cloud consulting", weight: 2 },
            { text: "cloud strategy", weight: 2 },
            { text: "cloud assessment", weight: 2 },
            { text: "multicloud", weight: 1 },
        ],
    },
    {
        name: "Data Science",
        keywords: [
            { text: "data science", weight: 2 },
            { text: "data scientist", weight: 2 },
            { text: "predictive modeling", weight: 2 },
            { text: "statistical modeling", weight: 2 },
        ],
    },
    {
        name: "Office 365 & SharePoint",
        keywords: [
            { text: "sharepoint development", weight: 2 },
            { text: "sharepoint", weight: 1 },
            { text: "office 365", weight: 2 },
            { text: "microsoft 365", weight: 2 },
            { text: "powerapps", weight: 2 },
            { text: "power automate", weight: 2 },
        ],
    },
    {
        name: "React Native Development",
        keywords: [
            { text: "react native development", weight: 2 },
            { text: "react native", weight: 1 },
            { text: "react native app", weight: 2 },
        ],
    },
    {
        name: "Flutter Development",
        keywords: [
            { text: "flutter development", weight: 2 },
            { text: "flutter app", weight: 2 },
            { text: "flutter", weight: 1 },
        ],
    },
];
const TECH_CATALOG = [
    // ---- Frameworks / Frontend ----
    {
        name: "React", category: "Frontend", signals: [
            { type: "asset", pattern: /react(?:\.min)?\.js|react-dom|__react|data-reactroot/i },
            { type: "html", pattern: /data-reactroot|__react/i },
        ], versionPattern: /react@?([0-9]+\.[0-9]+\.[0-9]+)/i
    },
    {
        name: "Next.js", category: "Frontend", signals: [
            { type: "asset", pattern: /_next\/static/i },
            { type: "html", pattern: /__NEXT_DATA__/i },
        ]
    },
    {
        name: "Angular", category: "Frontend", signals: [
            { type: "html", pattern: /ng-version|ng-app|ng-controller/i },
            { type: "asset", pattern: /angular(?:\.min)?\.js|@angular/i },
        ], versionPattern: /Angular ([0-9]+\.[0-9]+\.[0-9]+)/i
    },
    {
        name: "Vue.js", category: "Frontend", signals: [
            { type: "asset", pattern: /vue(?:\.min)?\.js|vue\.runtime|@vue/i },
            { type: "html", pattern: /__vue__|data-v-[a-f0-9]{6,}/i },
        ]
    },
    {
        name: "Nuxt.js", category: "Frontend", signals: [
            { type: "html", pattern: /__NUXT__/i },
            { type: "asset", pattern: /_nuxt\//i },
        ]
    },
    {
        name: "Gatsby", category: "Frontend", signals: [
            { type: "html", pattern: /___gatsby|gatsby-\//i },
        ]
    },
    {
        name: "Svelte", category: "Frontend", signals: [
            { type: "html", pattern: /svelte/i },
            { type: "asset", pattern: /svelte\.js/i },
        ]
    },
    {
        name: "Remix", category: "Frontend", signals: [
            { type: "html", pattern: /__remixContext/i },
            { type: "asset", pattern: /remix\/|@remix-run/i },
        ]
    },
    {
        name: "Astro", category: "Frontend", signals: [
            { type: "html", pattern: /astro[.\-]/i },
            { type: "asset", pattern: /_astro\//i },
        ]
    },
    {
        name: "jQuery", category: "Frontend", signals: [
            { type: "asset", pattern: /jquery(?:\.min)?\.js/i },
            { type: "html", pattern: /jquery(?:\.min)?\.js/i },
        ], versionPattern: /jQuery v?([0-9.]+)|jquery\/([0-9.]+)/i
    },
    {
        name: "Alpine.js", category: "Frontend", signals: [
            { type: "asset", pattern: /alpine(?:\.min)?\.js/i },
            { type: "html", pattern: /x-data=|x-init=/i },
        ]
    },
    {
        name: "HTMX", category: "Frontend", signals: [
            { type: "asset", pattern: /htmx(?:\.min)?\.js/i },
            { type: "html", pattern: /hx-get=|hx-post=|hx-trigger=/i },
        ]
    },
    {
        name: "Preact", category: "Frontend", signals: [
            { type: "asset", pattern: /preact/i },
        ]
    },
    // ---- CSS / UI ----
    {
        name: "Bootstrap", category: "CSS Framework", signals: [
            { type: "asset", pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i },
            { type: "html", pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i },
        ], versionPattern: /Bootstrap v?([0-9.]+)|bootstrap\/([0-9.]+)/i
    },
    {
        name: "Tailwind CSS", category: "CSS Framework", signals: [
            { type: "asset", pattern: /tailwindcss|tailwind\.min\.css/i },
            { type: "html", pattern: /tailwindcss/i },
        ]
    },
    {
        name: "Material UI", category: "CSS Framework", signals: [
            { type: "asset", pattern: /@mui|material-ui/i },
            { type: "html", pattern: /mui[a-z]|material-ui/i },
        ]
    },
    {
        name: "Ant Design", category: "CSS Framework", signals: [
            { type: "asset", pattern: /antd|ant-design/i },
            { type: "html", pattern: /ant-btn|ant-modal/i },
        ]
    },
    {
        name: "Bulma", category: "CSS Framework", signals: [
            { type: "asset", pattern: /bulma(?:\.min)?\.css/i },
        ]
    },
    {
        name: "Foundation", category: "CSS Framework", signals: [
            { type: "asset", pattern: /foundation(?:\.min)?\.(?:css|js)/i },
        ]
    },
    {
        name: "Sass", category: "CSS Framework", signals: [
            { type: "asset", pattern: /\.scss|\.sass\b|sass\//i },
            { type: "html", pattern: /\.scss|\.sass\b/i },
        ]
    },
    {
        name: "Less", category: "CSS Framework", signals: [
            { type: "asset", pattern: /\.less|less\.js/i },
            { type: "html", pattern: /\.less/i },
        ]
    },
    // ---- CMS / Website Builders ----
    {
        name: "WordPress", category: "CMS", signals: [
            { type: "meta", pattern: /wordpress/i },
            { type: "asset", pattern: /wp-content\/|wp-includes\//i },
            { type: "html", pattern: /wp-content\/|wp-includes\/|wp-json\//i },
        ], versionPattern: /WordPress (?:version )?([0-9.]+)/i
    },
    {
        name: "WooCommerce", category: "Ecommerce", signals: [
            { type: "asset", pattern: /woocommerce/i },
            { type: "html", pattern: /woocommerce/i },
        ]
    },
    {
        name: "Shopify", category: "Ecommerce", signals: [
            { type: "asset", pattern: /cdn\.shopify\.com/i },
            { type: "html", pattern: /shopify/ },
        ]
    },
    {
        name: "Magento", category: "Ecommerce", signals: [
            { type: "asset", pattern: /magento|mage\/|static\/version/i },
            { type: "html", pattern: /magento/ },
        ]
    },
    {
        name: "BigCommerce", category: "Ecommerce", signals: [
            { type: "asset", pattern: /bigcommerce|cdn\.bigcommerce/i },
        ]
    },
    {
        name: "PrestaShop", category: "Ecommerce", signals: [
            { type: "asset", pattern: /prestashop/i },
        ]
    },
    {
        name: "OpenCart", category: "Ecommerce", signals: [
            { type: "asset", pattern: /opencart|catalog\/view/i },
        ]
    },
    {
        name: "Joomla", category: "CMS", signals: [
            { type: "meta", pattern: /joomla/i },
            { type: "asset", pattern: /\/media\/system\/js|\/media\/jui\//i },
            { type: "html", pattern: /joomla/i },
        ]
    },
    {
        name: "Drupal", category: "CMS", signals: [
            { type: "meta", pattern: /drupal/i },
            { type: "asset", pattern: /\/(?:sites|modules|themes)\/(?:default|contrib|custom)/i },
        ]
    },
    {
        name: "Wix", category: "Website Builder", signals: [
            { type: "asset", pattern: /static\.wixstatic\.com|wixSiteAssets/i },
            { type: "html", pattern: /wix\.com/i },
        ]
    },
    {
        name: "Squarespace", category: "Website Builder", signals: [
            { type: "asset", pattern: /static1\.squarespace\.com/i },
            { type: "html", pattern: /squarespace/i },
        ]
    },
    {
        name: "Webflow", category: "Website Builder", signals: [
            { type: "asset", pattern: /webflow/i },
            { type: "html", pattern: /data-wf-/i },
        ]
    },
    {
        name: "Ghost", category: "CMS", signals: [
            { type: "html", pattern: /ghost(?:-)?version/i },
            { type: "asset", pattern: /ghost\//i },
        ]
    },
    {
        name: "Strapi", category: "CMS", signals: [
            { type: "asset", pattern: /strapi/i },
            { type: "html", pattern: /strapi/i },
        ]
    },
    // ---- Backend ----
    {
        name: "Node.js", category: "Backend", signals: [
            { type: "asset", pattern: /node_modules\/|\.node\b/i },
            { type: "html", pattern: /node_modules\//i },
        ]
    },
    {
        name: "Express", category: "Backend", signals: [
            { type: "html", pattern: /express|powered.by.express/i },
            { type: "asset", pattern: /express(?:\.min)?\.js/i },
        ]
    },
    {
        name: "NestJS", category: "Backend", signals: [
            { type: "asset", pattern: /@nestjs|nest\.js/i },
        ]
    },
    {
        name: "PHP", category: "Backend", signals: [
            { type: "html", pattern: /\bphp\b|\.php\b/i },
            { type: "asset", pattern: /\.php/i },
        ], versionPattern: /PHP\s?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i
    },
    {
        name: "Laravel", category: "Backend", signals: [
            { type: "asset", pattern: /laravel|mix-manifest/i },
            { type: "html", pattern: /csrf-token|laravel_session/i },
        ]
    },
    {
        name: "CodeIgniter", category: "Backend", signals: [
            { type: "asset", pattern: /codeigniter|ci\-base/i },
        ]
    },
    {
        name: "Symfony", category: "Backend", signals: [
            { type: "asset", pattern: /\_profiler\/|symfony/i },
        ]
    },
    {
        name: "Django", category: "Backend", signals: [
            { type: "asset", pattern: /django|static\/admin\//i },
            { type: "html", pattern: /csrfmiddlewaretoken/i },
        ]
    },
    {
        name: "Flask", category: "Backend", signals: [
            { type: "html", pattern: /flask/i },
        ]
    },
    {
        name: "Rails", category: "Backend", signals: [
            { type: "asset", pattern: /assets\/application|actioncable|rails/i },
            { type: "html", pattern: /rails/i },
        ]
    },
    {
        name: "ASP.NET", category: "Backend", signals: [
            { type: "asset", pattern: /webresource\.axd|scriptresource\.axd|aspnet/i },
            { type: "html", pattern: /viewstate|aspnet/i },
        ]
    },
    {
        name: "Spring", category: "Backend", signals: [
            { type: "asset", pattern: /springframework|spring-boot/i },
            { type: "html", pattern: /springframework/i },
        ]
    },
    {
        name: "Go", category: "Backend", signals: [
            { type: "asset", pattern: /\.golang|go\.wasm/i },
        ]
    },
    {
        name: "Firebase", category: "Backend", signals: [
            { type: "asset", pattern: /firebase(?:app|analytics|init)?\.js|firebase\.google/i },
            { type: "html", pattern: /firebaseapp\.com/i },
        ]
    },
    {
        name: "Supabase", category: "Backend", signals: [
            { type: "asset", pattern: /supabase/i },
        ]
    },
    {
        name: "GraphQL", category: "API", signals: [
            { type: "asset", pattern: /graphql|apollo/i },
            { type: "html", pattern: /graphql|__APOLLO/i },
        ]
    },
    {
        name: "Socket.io", category: "Realtime", signals: [
            { type: "asset", pattern: /socket\.io|sockjs/i },
        ]
    },
    {
        name: "Meteor", category: "Backend", signals: [
            { type: "asset", pattern: /meteor/i },
        ]
    },
    {
        name: "AdonisJS", category: "Backend", signals: [
            { type: "asset", pattern: /@adonisjs|adonis/i },
        ]
    },
    {
        name: "Koa", category: "Backend", signals: [
            { type: "asset", pattern: /koa(?:\.min)?\.js/i },
        ]
    },
    {
        name: "Ruby", category: "Backend", signals: [
            { type: "html", pattern: /ruby|\.rb\b/i },
        ]
    },
    {
        name: "Python", category: "Backend", signals: [
            { type: "html", pattern: /python|\.py\b/i },
        ]
    },
    {
        name: "Java", category: "Backend", signals: [
            { type: "html", pattern: /java|\.jsp\b/i },
            { type: "asset", pattern: /\.jsp\b/i },
        ]
    },
    {
        name: "Go (Golang)", category: "Backend", signals: [
            { type: "asset", pattern: /go\.wasm|\.golang/i },
        ]
    },
    // ---- Databases ----
    {
        name: "MySQL", category: "Database", signals: [
            { type: "html", pattern: /mysql/i },
            { type: "asset", pattern: /mysql/i },
        ], versionPattern: /MySQL(?: \/)? ([0-9.]+)/i
    },
    {
        name: "PostgreSQL", category: "Database", signals: [
            { type: "html", pattern: /postgres|postgre/i },
        ]
    },
    {
        name: "MongoDB", category: "Database", signals: [
            { type: "html", pattern: /mongodb|mongo/i },
        ]
    },
    {
        name: "Redis", category: "Database", signals: [
            { type: "html", pattern: /redis/i },
        ]
    },
    {
        name: "Elasticsearch", category: "Database", signals: [
            { type: "asset", pattern: /elastic/i },
            { type: "html", pattern: /elastic|opensearch/i },
        ]
    },
    {
        name: "Oracle", category: "Database", signals: [
            { type: "html", pattern: /oracle/i },
        ]
    },
    {
        name: "SQLite", category: "Database", signals: [
            { type: "html", pattern: /sqlite/i },
        ]
    },
    {
        name: "DynamoDB", category: "Database", signals: [
            { type: "asset", pattern: /dynamodb/i },
        ]
    },
    {
        name: "MariaDB", category: "Database", signals: [
            { type: "html", pattern: /mariadb/i },
        ]
    },
    // ---- Hosting / CDN / Infra ----
    {
        name: "AWS", category: "Cloud", signals: [
            { type: "asset", pattern: /s3\.amazonaws\.com|cloudfront\.net|amazonaws\.com/i },
            { type: "html", pattern: /amazonaws\.com|aws\.powered|aws\.amazon/i },
        ]
    },
    {
        name: "Azure", category: "Cloud", signals: [
            { type: "asset", pattern: /windows\.net|azureedge\.net|azurewebsites\.net/i },
            { type: "html", pattern: /azurewebsites\.net/i },
        ]
    },
    {
        name: "Google Cloud", category: "Cloud", signals: [
            { type: "asset", pattern: /storage\.googleapis\.com|firebasestorage|appspot\.com/i },
        ]
    },
    {
        name: "Cloudflare", category: "CDN", signals: [
            { type: "html", pattern: /cloudflare|cdn-cgi\//i },
            { type: "asset", pattern: /cdn-cgi\//i },
        ]
    },
    {
        name: "Nginx", category: "Server", signals: [
            { type: "html", pattern: /nginx/i },
        ], versionPattern: /nginx\/([0-9.]+)/i
    },
    {
        name: "Apache", category: "Server", signals: [
            { type: "html", pattern: /apache/i },
        ], versionPattern: /Apache\/([0-9.]+)/i
    },
    {
        name: "Netlify", category: "Hosting", signals: [
            { type: "html", pattern: /netlify/i },
        ]
    },
    {
        name: "Vercel", category: "Hosting", signals: [
            { type: "html", pattern: /vercel/i },
        ]
    },
    {
        name: "Heroku", category: "Hosting", signals: [
            { type: "asset", pattern: /herokuapp\.com/i },
        ]
    },
    {
        name: "DigitalOcean", category: "Hosting", signals: [
            { type: "html", pattern: /digitalocean/i },
        ]
    },
    {
        name: "cPanel", category: "Hosting", signals: [
            { type: "html", pattern: /cpanel/i },
            { type: "asset", pattern: /cpanel/i },
        ]
    },
    {
        name: "Plesk", category: "Hosting", signals: [
            { type: "html", pattern: /plesk/i },
        ]
    },
    {
        name: "GoDaddy", category: "Hosting", signals: [
            { type: "asset", pattern: /godaddy/i },
        ]
    },
    {
        name: "Hostinger", category: "Hosting", signals: [
            { type: "html", pattern: /hostinger/i },
        ]
    },
    {
        name: "Namecheap", category: "Hosting", signals: [
            { type: "asset", pattern: /namecheap/i },
        ]
    },
    {
        name: "LiteSpeed", category: "Server", signals: [
            { type: "html", pattern: /litespeed/i },
        ]
    },
    // ---- Analytics & Marketing ----
    {
        name: "Google Analytics", category: "Analytics", signals: [
            { type: "asset", pattern: /googletagmanager\.com|google-analytics\.com|analytics\.js|gtag\/js|ga\.js/i },
            { type: "html", pattern: /googletagmanager\.com|google-analytics\.com/i },
        ]
    },
    {
        name: "Google Tag Manager", category: "Analytics", signals: [
            { type: "asset", pattern: /googletagmanager\.com\/gtm\.js/i },
        ]
    },
    {
        name: "Facebook Pixel", category: "Analytics", signals: [
            { type: "asset", pattern: /connect\.facebook\.net|fbq\b/i },
            { type: "html", pattern: /fbq\(/i },
        ]
    },
    {
        name: "Hotjar", category: "Analytics", signals: [
            { type: "asset", pattern: /static\.hotjar\.com/i },
        ]
    },
    {
        name: "Mixpanel", category: "Analytics", signals: [
            { type: "asset", pattern: /cdn\.mxpnl\.com/i },
        ]
    },
    {
        name: "HubSpot", category: "Marketing", signals: [
            { type: "asset", pattern: /js\.hs-scripts\.com|hs-analytics/i },
            { type: "html", pattern: /hubspot/i },
        ]
    },
    {
        name: "LinkedIn Insight", category: "Marketing", signals: [
            { type: "asset", pattern: /snap\.licdn\.com|insight\.licdn\.com/i },
        ]
    },
    {
        name: "TikTok Pixel", category: "Marketing", signals: [
            { type: "asset", pattern: /analytics\.tiktok\.com/i },
        ]
    },
    {
        name: "Pinterest Tag", category: "Marketing", signals: [
            { type: "asset", pattern: /s\.pinimg\.com\/ct/i },
        ]
    },
    {
        name: "Zoho", category: "Marketing", signals: [
            { type: "asset", pattern: /zoho\.com/i },
            { type: "html", pattern: /zoho/i },
        ]
    },
    {
        name: "Mailchimp", category: "Marketing", signals: [
            { type: "asset", pattern: /mailchimp\.com|list-manage\.com/i },
        ]
    },
    {
        name: "SendGrid", category: "Marketing", signals: [
            { type: "asset", pattern: /sendgrid/i },
        ]
    },
    {
        name: "Zendesk", category: "Marketing", signals: [
            { type: "asset", pattern: /zendesk/i },
        ]
    },
    {
        name: "Intercom", category: "Marketing", signals: [
            { type: "asset", pattern: /intercom/i },
        ]
    },
    {
        name: "Drift", category: "Marketing", signals: [
            { type: "asset", pattern: /drift\b|js\.drift/i },
        ]
    },
    {
        name: "Freshchat", category: "Marketing", signals: [
            { type: "asset", pattern: /freshchat/i },
        ]
    },
    // ---- Payments ----
    {
        name: "Stripe", category: "Payment", signals: [
            { type: "asset", pattern: /stripe\.com|js\.stripe\.com|@stripe/i },
            { type: "html", pattern: /stripe\.com/i },
        ]
    },
    {
        name: "PayPal", category: "Payment", signals: [
            { type: "asset", pattern: /paypal(?:objects)?\.com|paypal\.com\/sdk/i },
            { type: "html", pattern: /paypal\.com/i },
        ]
    },
    {
        name: "Razorpay", category: "Payment", signals: [
            { type: "asset", pattern: /razorpay\.com|checkout\.razorpay/i },
            { type: "html", pattern: /razorpay/i },
        ]
    },
    {
        name: "CCAvenue", category: "Payment", signals: [
            { type: "asset", pattern: /ccavenue\.com/i },
        ]
    },
    {
        name: "PayU", category: "Payment", signals: [
            { type: "asset", pattern: /payu\.in|payu\.com|payumoney/i },
        ]
    },
    {
        name: "Instamojo", category: "Payment", signals: [
            { type: "asset", pattern: /instamojo\.com/i },
        ]
    },
    {
        name: "Paytm", category: "Payment", signals: [
            { type: "asset", pattern: /paytm\.com/i },
        ]
    },
    {
        name: "Braintree", category: "Payment", signals: [
            { type: "asset", pattern: /braintree/i },
        ]
    },
    {
        name: "Billdesk", category: "Payment", signals: [
            { type: "asset", pattern: /billdesk/i },
        ]
    },
    {
        name: "Cashfree", category: "Payment", signals: [
            { type: "asset", pattern: /cashfree/i },
        ]
    },
    // ---- Build tools / Utilities ----
    {
        name: "TypeScript", category: "Language", signals: [
            { type: "asset", pattern: /\.ts\b|typescript/i },
            { type: "html", pattern: /typescript/i },
        ]
    },
    {
        name: "Webpack", category: "Build Tool", signals: [
            { type: "asset", pattern: /webpack|__webpack_require__|\.bundle\.js/i },
            { type: "html", pattern: /__webpack_require__/i },
        ]
    },
    {
        name: "Vite", category: "Build Tool", signals: [
            { type: "asset", pattern: /@vite|vite\/client|\.vite\//i },
            { type: "html", pattern: /data-vite|@vite/i },
        ]
    },
    {
        name: "Babel", category: "Build Tool", signals: [
            { type: "asset", pattern: /babel|polyfill/i },
        ]
    },
    {
        name: "Gulp", category: "Build Tool", signals: [
            { type: "asset", pattern: /gulp/i },
        ]
    },
    {
        name: "Grunt", category: "Build Tool", signals: [
            { type: "asset", pattern: /grunt/i },
        ]
    },
    {
        name: "Parcel", category: "Build Tool", signals: [
            { type: "asset", pattern: /parcel/i },
        ]
    },
    {
        name: "ESLint", category: "Build Tool", signals: [
            { type: "asset", pattern: /eslint/i },
        ]
    },
    {
        name: "Docker", category: "DevOps", signals: [
            { type: "html", pattern: /docker/i },
        ]
    },
    {
        name: "Kubernetes", category: "DevOps", signals: [
            { type: "html", pattern: /kubernetes|k8s/i },
        ]
    },
    {
        name: "Terraform", category: "DevOps", signals: [
            { type: "html", pattern: /terraform/i },
        ]
    },
    {
        name: "Jenkins", category: "DevOps", signals: [
            { type: "html", pattern: /jenkins/i },
        ]
    },
    {
        name: "GitHub Actions", category: "DevOps", signals: [
            { type: "asset", pattern: /github\.com\/actions|githubusercontent\.com/i },
        ]
    },
    {
        name: "GitLab CI", category: "DevOps", signals: [
            { type: "html", pattern: /gitlab-ci/i },
        ]
    },
    {
        name: "Sentry", category: "Monitoring", signals: [
            { type: "asset", pattern: /browser\.sentry|@sentry/i },
        ]
    },
    {
        name: "New Relic", category: "Monitoring", signals: [
            { type: "asset", pattern: /newrelic/i },
        ]
    },
    {
        name: "Datadog", category: "Monitoring", signals: [
            { type: "asset", pattern: /datadog/i },
        ]
    },
    {
        name: "Google Maps", category: "API", signals: [
            { type: "asset", pattern: /maps\.googleapis\.com|maps\.google\.com/i },
        ]
    },
    {
        name: "Leaflet", category: "API", signals: [
            { type: "asset", pattern: /leaflet/i },
        ]
    },
    {
        name: "Mapbox", category: "API", signals: [
            { type: "asset", pattern: /api\.mapbox\.com|mapbox\.gl/i },
        ]
    },
    {
        name: "Swiper", category: "Library", signals: [
            { type: "asset", pattern: /swiper/i },
        ]
    },
    {
        name: "Owl Carousel", category: "Library", signals: [
            { type: "asset", pattern: /owl\.carousel|owlcarousel/i },
        ]
    },
    {
        name: "AOS", category: "Library", signals: [
            { type: "asset", pattern: /aos\.(?:js|css)|aos@2/i },
        ]
    },
    {
        name: "GSAP", category: "Library", signals: [
            { type: "asset", pattern: /gsap|greensock/i },
        ]
    },
    {
        name: "Three.js", category: "Library", signals: [
            { type: "asset", pattern: /three(?:\.min)?\.js|three@/i },
        ]
    },
    {
        name: "Chart.js", category: "Library", signals: [
            { type: "asset", pattern: /chart(?:\.min)?\.js|chart\.js/i },
        ]
    },
    {
        name: "D3.js", category: "Library", signals: [
            { type: "asset", pattern: /d3(?:\.min)?\.js|d3js/i },
        ]
    },
    {
        name: "CKEditor", category: "Library", signals: [
            { type: "asset", pattern: /ckeditor/i },
        ]
    },
    {
        name: "TinyMCE", category: "Library", signals: [
            { type: "asset", pattern: /tinymce/i },
        ]
    },
    {
        name: "Font Awesome", category: "Library", signals: [
            { type: "asset", pattern: /font-awesome|fontawesome/i },
        ]
    },
    {
        name: "Material Icons", category: "Library", signals: [
            { type: "asset", pattern: /material-icons/i },
        ]
    },
    {
        name: "Lodash", category: "Library", signals: [
            { type: "asset", pattern: /lodash/i },
        ]
    },
    {
        name: "Axios", category: "Library", signals: [
            { type: "asset", pattern: /axios(?:\.min)?\.js/i },
        ]
    },
    {
        name: "Redux", category: "Library", signals: [
            { type: "asset", pattern: /redux(?:\.min)?\.js|@reduxjs/i },
        ]
    },
    {
        name: "Google Optimize", category: "Analytics", signals: [
            { type: "asset", pattern: /googleoptimize\.com/i },
        ]
    },
    {
        name: "ReCAPTCHA", category: "Security", signals: [
            { type: "asset", pattern: /recaptcha|google\.com\/recaptcha/i },
        ]
    },
    {
        name: "hCaptcha", category: "Security", signals: [
            { type: "asset", pattern: /hcaptcha/i },
        ]
    },
    {
        name: "Cookiebot", category: "Compliance", signals: [
            { type: "asset", pattern: /cookiebot/i },
        ]
    },
    {
        name: "OneTrust", category: "Compliance", signals: [
            { type: "asset", pattern: /onetrust/i },
        ]
    },
    {
        name: "Elementor", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /elementor/i },
            { type: "html", pattern: /elementor/i },
        ]
    },
    {
        name: "WPBakery", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /wpbakery|js_composer/i },
        ]
    },
    {
        name: "Divi", category: "WordPress Theme", signals: [
            { type: "asset", pattern: /divi/i },
        ]
    },
    {
        name: "Avada", category: "WordPress Theme", signals: [
            { type: "asset", pattern: /avada/i },
        ]
    },
    {
        name: "Astra", category: "WordPress Theme", signals: [
            { type: "asset", pattern: /astra/i },
        ]
    },
    {
        name: "Rank Math", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /rank-math|rankmath/i },
        ]
    },
    {
        name: "Yoast SEO", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /yoast/i },
        ]
    },
    {
        name: "WPForms", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /wpforms/i },
        ]
    },
    {
        name: "Contact Form 7", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /contact-form-7|wpcf7/i },
        ]
    },
    {
        name: "Gravity Forms", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /gravityforms/i },
        ]
    },
    {
        name: "W3 Total Cache", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /w3-total-cache|w3tc/i },
        ]
    },
    {
        name: "WP Rocket", category: "WordPress Plugin", signals: [
            { type: "asset", pattern: /wp-rocket|wprocket/i },
        ]
    },
    {
        name: "Cloudways", category: "Hosting", signals: [
            { type: "asset", pattern: /cloudways/i },
        ]
    },
    {
        name: "A2 Hosting", category: "Hosting", signals: [
            { type: "asset", pattern: /a2hosting/i },
        ]
    },
    {
        name: "SiteGround", category: "Hosting", signals: [
            { type: "asset", pattern: /siteground/i },
        ]
    },
    {
        name: "Bluehost", category: "Hosting", signals: [
            { type: "asset", pattern: /bluehost/i },
        ]
    },
];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// HTML entity constants built via char codes to avoid literal entity sequences in source.
const ENTITY_AMP = String.fromCharCode(38);
const ENTITY_LT = String.fromCharCode(60);
const ENTITY_GT = String.fromCharCode(62);
const ENTITY_NBSP = String.fromCharCode(160);
function decodeHtmlEntities(text) {
    const amp = ENTITY_AMP;
    return text
        .replace(new RegExp(amp + "nbsp;", "g"), " ")
        .replace(new RegExp(amp + "amp;", "g"), amp)
        .replace(new RegExp(amp + "#39;", "g"), "'")
        .replace(new RegExp(amp + "quot;", "g"), '"')
        .replace(new RegExp(amp + "lt;", "g"), ENTITY_LT)
        .replace(new RegExp(amp + "gt;", "g"), ENTITY_GT);
}
function stripTags(html) {
    return decodeHtmlEntities(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase();
}
function collectAssets(...htmls) {
    const assets = [];
    const patterns = /<(?:script|link|img|source|iframe|video|audio)[^>]+(?:src|href|data-src|srcset)\s*=\s*["']([^"']+)["']/gi;
    for (const html of htmls) {
        if (!html)
            continue;
        let match;
        while ((match = patterns.exec(html)) !== null) {
            assets.push(match[1]);
        }
    }
    return assets.join(" ");
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function detectServicesFromText(text) {
    const normalized = ` ${text} `.toLowerCase();
    const scored = [];
    for (const def of SERVICE_CATALOG) {
        let score = 0;
        const matchedKeywords = [];
        for (const kw of def.keywords) {
            const escaped = kw.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Use flexible boundaries: spaces, punctuation, start/end of string
            const rx = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
            if (rx.test(normalized)) {
                score += kw.weight;
                matchedKeywords.push(kw.text);
            }
        }
        if (score > 0) {
            scored.push({ name: def.name, score, matchedKeywords });
        }
    }
    const detected = scored
        .filter((entry) => entry.score >= 1)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .map((entry) => entry.name);
    // Remove overlapping/duplicate service names: e.g. "Website Design" vs "Web Development"
    // Keep all max_services results, deduplicate by name.
    const unique = Array.from(new Set(detected));
    const MAX_SERVICES = 35;
    return unique.slice(0, MAX_SERVICES);
}
function analyzeContent(options) {
    return (0, strictExtract_1.extractVerified)({
        mainHtml: options.mainHtml,
        servicePageHtmls: options.servicePageHtmls,
        headerText: options.headerText,
    });
}
function detectServices(options) {
    return analyzeContent(options).services;
}
function detectTechnologies(options) {
    return analyzeContent(options).technologies;
}
