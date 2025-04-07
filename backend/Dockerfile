# Build stage
FROM node:16.20.2-alpine AS builder

WORKDIR /backend

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:16.20.2-alpine AS runner

WORKDIR /backend

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built files from builder stage
COPY --from=builder /backend/dist ./dist

# # Copy necessary configuration files
# COPY --from=builder /backend/.env* ./
# COPY --from=builder /backend/src/config ./src/config

#Migrate the database
RUN npm run migrate

# Expose the port the app runs on
EXPOSE 8000

#Bridge to another container

# Start the application
CMD ["npm", "start"]

