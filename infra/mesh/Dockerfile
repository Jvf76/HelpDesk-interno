FROM node:24-bookworm-slim
WORKDIR /opt/mesh
COPY package*.json patch-bootstrap.mjs ./
RUN npm ci --omit=dev
EXPOSE 4433
CMD ["node", "node_modules/meshcentral", "--datapath", "/opt/mesh/meshcentral-data"]
