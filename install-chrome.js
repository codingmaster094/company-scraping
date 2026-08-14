const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR ||
  path.join(__dirname, ".cache", "puppeteer");
process.env.PUPPETEER_CACHE_DIR = cacheDir;

function systemChromeExists() {
  const p = process.env.PUPPETEER_EXECUTABLE_PATH;
  return Boolean(p && fs.existsSync(p));
}

if (process.env.PUPPETEER_SKIP_DOWNLOAD === "true" && systemChromeExists()) {
  console.log(
    `Using system Chrome at ${process.env.PUPPETEER_EXECUTABLE_PATH} — skip download`
  );
  process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });
console.log(`Installing Puppeteer Chrome into ${cacheDir}`);
try {
  execSync("npx puppeteer browsers install chrome", {
    stdio: "inherit",
    env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
  });
} catch (err) {
  console.warn(
    "Could not install Puppeteer Chrome:",
    err && err.message ? err.message : err
  );
  process.exit(0);
}
