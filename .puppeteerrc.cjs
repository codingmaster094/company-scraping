const { join } = require("path");

/**
 * Keep Chrome inside the project so Render's build output still has it at runtime.
 * Default home cache (/opt/render/.cache/puppeteer) is often empty after deploy.
 */
module.exports = {
  cacheDirectory:
    process.env.PUPPETEER_CACHE_DIR || join(__dirname, ".cache", "puppeteer"),
};
