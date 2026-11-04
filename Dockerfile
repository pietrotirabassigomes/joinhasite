FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .

ENV NODE_ENV=production
ENV DB_FILE=/var/data/joinha.sqlite
EXPOSE 3000
CMD ["npm", "start"]
