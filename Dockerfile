FROM node:22-bookworm-slim
WORKDIR /app

# better-sqlite3 pode precisar compilar o módulo nativo em algumas plataformas.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .

ENV NODE_ENV=production
ENV DB_FILE=/var/data/joinha.sqlite
EXPOSE 3000
CMD ["npm", "start"]
