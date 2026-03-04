# Stage 1: Build the Vite application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build-time base path (defaults to /)
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Build the application
RUN npm run build

# Stage 2: Serve static assets + reverse proxy API with Nginx
FROM nginx:alpine

WORKDIR /app

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy runtime scripts/config templates
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
