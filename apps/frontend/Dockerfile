FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN ( [ -f package-lock.json ] && npm ci ) || npm install

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
EXPOSE 3000
CMD ["npm", "run", "dev"]
