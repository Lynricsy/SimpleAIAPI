FROM node:22-alpine AS builder
WORKDIR /app

# 为 MCP 工具准备常见运行环境
RUN apk add --no-cache bash curl libc6-compat unzip python3 py3-pip git \
  && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh \
  && curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

# 同样在运行时镜像内提供 uv/bun/npm 环境
RUN apk add --no-cache bash curl libc6-compat unzip python3 py3-pip git
COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY MCP.example.json ./MCP.example.json
RUN cp MCP.example.json MCP.json

EXPOSE 8080

CMD ["node", "dist/server.js"]
