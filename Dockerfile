# ---- build stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage (serve static)
FROM nginx:alpine

# Angular builds into dist/<app-name>/ . We copy the whole dist output.
COPY --from=build /app/dist/theindex-front/browser/ /usr/share/nginx/html

# SPA routing
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF
