FROM node:22-alpine AS deps
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspace=apps/web

FROM deps AS dev
WORKDIR /workspace
COPY apps/web ./apps/web
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=apps/web", "--", "--host"]

FROM deps AS build
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM nginx:alpine AS runtime
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
