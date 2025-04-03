# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production Stage (using Nginx)
FROM nginx:alpine AS runner

WORKDIR /usr/share/nginx/html

# Copy built files from builder stage
COPY --from=builder /app/dist .

# Expose the port Vite usually runs on
EXPOSE 4173

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
