FROM node:20-alpine
WORKDIR /app

# Cache deps layer
COPY package.json package-lock.json* ./
# Try ci; if there is no lockfile, use install.
RUN ( [ -f package-lock.json ] && npm ci ) || npm install

COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
