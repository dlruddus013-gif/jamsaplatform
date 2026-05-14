FROM node:20-slim

# Chromium + 한글 폰트 + Python 설치
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium fonts-nanum fonts-noto-cjk \
    python3 python3-pip \
    ca-certificates wget \
  && pip3 install pandas openpyxl --break-system-packages \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --production

COPY . .
RUN mkdir -p .data closings

# Puppeteer → 시스템 Chromium 사용
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

EXPOSE 3500
CMD ["node", "server.js"]
