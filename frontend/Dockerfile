# Build Stage
FROM node:20-alpine AS builder

WORKDIR /frontend

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production Stage (Vite Server)
FROM node:20-alpine AS runner

WORKDIR /frontend

# Install only production dependencies
COPY --from=builder /frontend .

# Expose the port Vite uses in preview mode
EXPOSE 4173

# Run Vite preview server
CMD ["npm", "run", "preview"]
