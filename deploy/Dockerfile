# Single image: builds the React client and serves it from the Express API.
# Build from the repo root:  docker build -f deploy/Dockerfile -t won-avenue .
FROM node:22-alpine AS build
WORKDIR /app
COPY client/package*.json client/
RUN npm ci --prefix client
COPY client client
RUN npm run build --prefix client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json server/
RUN npm ci --prefix server --omit=dev
COPY server server
COPY --from=build /app/client/dist client/dist
EXPOSE 5000
USER node
CMD ["node", "server/src/server.js"]
