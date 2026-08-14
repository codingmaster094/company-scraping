FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* .puppeteerrc.cjs ./
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install --omit=dev && npx puppeteer browsers install chrome || true

COPY . .

ENV NODE_ENV=production
ENV PUPPETEER_HEADLESS=true

EXPOSE 10000
CMD ["node", "server.js"]
