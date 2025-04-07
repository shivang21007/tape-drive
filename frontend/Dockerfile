# Build Stage
FROM node:16.20.2-alpine AS builder

WORKDIR /frontend

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production Stage (Vite Server)
FROM node:16.20.2-alpine AS runner

WORKDIR /frontend

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built files from builder stage
COPY --from=builder /frontend/dist ./dist

# Expose the port Vite uses in preview mode
EXPOSE 4173

# Run Vite preview server
CMD ["npm", "run", "preview"]
