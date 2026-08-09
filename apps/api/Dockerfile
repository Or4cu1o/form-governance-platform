FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace=apps/api

FROM deps AS build
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace=apps/api \
 && npm run build --workspace=apps/api

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/api/scripts ./apps/api/scripts
COPY --from=build /workspace/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/docker-entrypoint.sh /workspace/docker-entrypoint.sh
RUN chmod +x /workspace/docker-entrypoint.sh
WORKDIR /workspace/apps/api
EXPOSE 3000
ENTRYPOINT ["/workspace/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
