# TapeX - Tape Management System

A web application for managing tapes, built with React, Express, and MySQL.

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