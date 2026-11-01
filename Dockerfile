FROM node:24-alpine AS build-stage

WORKDIR /app
RUN npm install --global pnpm@12.9.1

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:stable-alpine AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
RUN nginx -t
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
