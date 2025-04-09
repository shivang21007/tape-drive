# User Management System

A full-stack application for managing users, groups, and processes with role-based access control.

## Architecture

The application consists of two main parts:
- Frontend: React + Vite application running on port 5173
- Backend: Node.js + Express application running on port 8000

## Request Flow

### 1. Initial Application Load
```
Browser -> Frontend (5173) -> App.tsx
```

- The application starts at `App.tsx`
- `AuthProvider` is initialized and checks user authentication
- If not authenticated, redirects to `/login`

### 2. Authentication Flow
```
Browser -> Frontend (5173) -> Backend (8000) -> Google OAuth -> Backend (8000) -> Frontend (5173)
```

1. User clicks "Login with Google" button
2. Frontend redirects to `/auth/google`
3. Backend initiates Google OAuth flow
4. Google authenticates user and redirects back to `/auth/google/callback`
5. Backend:
   - Creates/updates user in database
   - Creates session
   - Sets session cookie
   - Redirects to frontend

### 3. Protected Route Access
```
Browser -> Frontend (5173) -> Backend (8000) -> Frontend (5173)
```

1. User tries to access protected route (e.g., `/admin`)
2. Frontend checks authentication via `/auth/me`
3. Backend:
   - Validates session cookie
   - Returns user data if authenticated
   - Returns 401 if not authenticated
4. Frontend:
   - Shows protected content if authenticated
   - Redirects to login if not authenticated

### 4. API Request Flow
```
Browser -> Frontend (5173) -> Backend (8000) -> Database -> Backend (8000) -> Frontend (5173)
```

1. Frontend makes API request (e.g., `/api/users`)
2. Vite proxy forwards request to backend
3. Backend:
   - Validates session
   - Checks user role
   - Executes database query
   - Returns response
4. Frontend:
   - Handles response
   - Updates UI

## Key Components

### Frontend
- `App.tsx`: Main application component with routing
- `AuthContext.tsx`: Manages authentication state
- `ProtectedRoute.tsx`: Protects routes based on authentication
- `Login.tsx`: Google OAuth login page
- `Home.tsx`: Main dashboard
- `Admin.tsx`: Admin interface

### Backend
- `index.ts`: Main server setup
- `routes/auth.ts`: Authentication routes
- `routes/api.ts`: Protected API routes
- `middleware/auth.ts`: Authentication middleware
- `config/passport.ts`: Passport.js configuration
- `config/database.ts`: Database configuration

## Environment Configuration

### Local Development
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Database: Local MySQL

### Production
- Frontend: `http://serv19.octro.net:5173`
- Backend: `http://serv19.octro.net:8000`
- Database: Production MySQL

## Security Features
- Session-based authentication
- Role-based access control
- CORS protection
- Secure cookie settings
- HTTPS in production

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd backend
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local` for local development
   - Copy `.env.example` to `.env.production` for production

4. Start the applications:
   ```bash
   # Frontend
   cd frontend
   npm run dev

   # Backend
   cd backend
   npm run dev
   ```

## Deployment

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Start the backend in production mode:
   ```bash
   cd backend
   NODE_ENV=production npm start
   ```

## Tech Stack

### Frontend
- React 18.2.0
- TypeScript 4.9.5
- Vite 4.5.2
- React Router 6.22.1
- Axios 1.6.7
- Tailwind CSS 3.4.1

### Backend
- Node.js 16.20.2
- Express.js 4.18.2
- TypeScript 4.9.5
- MySQL2 3.6.5
- Passport.js 0.6.0

## Prerequisites

- CentOS 7
- Node.js 16.20.2 (LTS)
- MySQL 5.7 or higher
- npm 8.x or higher

## Installation

### Setting up Node.js 16 on CentOS 7

```bash
# Install NodeSource repository for Node.js 16
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -

# Install Node.js 16
sudo yum install -y nodejs

# Verify installation
node --version  # Should output v16.x.x
npm --version   # Should output 8.x.x or higher
```

### Clone the repository

```bash
git clone <repository-url>
cd tape-drive
```

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create a .env file with the following variables
cat > .env << EOL
PORT=8000
FRONTEND_URL=http://localhost:5173
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=tapex
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback
SESSION_SECRET=your_session_secret
EOL

# Run database migrations
npm run migrate

# Start the development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create a .env file with the following variables
cat > .env << EOL
VITE_API_URL=http://localhost:8000
EOL

# Start the development server
npm run dev
```

## Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## Building for Production

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
```

The built files will be in the `frontend/dist` directory, which can be served using a static file server like Nginx.

## Troubleshooting

### Common Issues

1. **Node.js version mismatch**: Ensure you're using Node.js 16.20.2 (LTS) on CentOS 7.
2. **MySQL connection issues**: Verify your MySQL server is running and the credentials in the `.env` file are correct.
3. **Google OAuth issues**: Ensure your Google OAuth credentials are correctly set up in the Google Cloud Console and match the values in your `.env` file.

## License

ISC 