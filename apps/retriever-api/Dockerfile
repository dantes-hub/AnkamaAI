FROM node:20-bullseye-slim

# Install pdftotext (Poppler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache deps
COPY package.json package-lock.json* ./
RUN ( [ -f package-lock.json ] && npm ci ) || npm install

# App
COPY . .

EXPOSE 8000
CMD ["node", "server.js"]
