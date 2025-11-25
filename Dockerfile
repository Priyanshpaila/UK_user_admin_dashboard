# ---------- 1) Install deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# If you use yarn or pnpm, adjust these lines
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2) Build app ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Make sure you have "build" and "start" scripts in package.json
# e.g. "build": "next build", "start": "next start"
RUN npm run build

# ---------- 3) Production runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV PORT=8001
ENV NEXT_PUBLIC_BASE_URL=https://backend.pharma-health.co.uk/api
ENV NEXT_PUBLIC_ONLY_URL=backend.pharma-health.co.uk/api
# optional: set this if you need to know external URL
# ENV NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Create a non-root user (optional, but good practice)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

# Copy only what we need to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

EXPOSE ${PORT}

CMD ["npm", "start"]


# docker build  --no-cache -t 192.168.13.72:5000/adminukproject_24_nov_2025 .      
# docker run -d --name adminukproject_24_nov_2025 -p 80:80 adminukproject_24_nov_2025_image

# docker tag adminukproject_24_nov_2025_image 192.168.13.72:5000/adminukproject_24_nov_2025
# docker push 192.168.13.72:5000/adminukproject_24_nov_2025
# docker pull 192.168.13.72:5000/adminukproject_24_nov_2025
# docker run -d --name adminukproject_24_nov_2025 -p 8001:8001 192.168.13.72:5000/adminukproject_24_nov_2025