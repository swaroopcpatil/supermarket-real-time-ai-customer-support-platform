FROM node:20-alpine
WORKDIR /app
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_TIMEOUT=120000
COPY apps/web/package*.json ./
RUN npm install
COPY apps/web ./
EXPOSE 3000
CMD ["npm", "run", "dev"]
