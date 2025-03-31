# User Management System

A full-stack application with user authentication, role-based access control, and group management.

## Tech Stack

### Frontend
- React with TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Axios for API calls

### Backend
- Node.js with Express
- TypeScript
- MySQL for main database
- Redis for session management
- Passport.js for Google OAuth

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Redis (v6.0 or higher)
- Git

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Environment Setup

#### Backend (.env file in backend directory)
```env
# Server
PORT=8000
NODE_ENV=development

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=user_management_system

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session
SESSION_SECRET=your_session_secret
```

#### Frontend (.env file in frontend directory)
```env
VITE_API_URL=http://localhost:8000
```

### 3. Database Setup

#### Create MySQL Database
```sql
CREATE DATABASE user_management_system;
USE user_management_system;

-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    role ENUM('admin', 'data_team', 'art_team', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Groups Table
CREATE TABLE user_groups_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User-Group Memberships Table
CREATE TABLE user_group_memberships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    group_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES user_groups_table(id)
);

-- Processes Table
CREATE TABLE processes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth Client ID
5. Configure the OAuth consent screen
6. Add authorized redirect URI: `http://localhost:8000/auth/google/callback`
7. Copy the Client ID and Client Secret to your backend .env file

### 5. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 6. Start the Application

```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## User Roles

The application supports four roles:
1. `admin` - Full access to all features
2. `data_team` - Access to data management features
3. `art_team` - Access to art and media features
4. `user` - Basic user access

The first user to sign up will automatically become an admin.

## Features

- Google OAuth Authentication
- Role-based Access Control
- User Management
- Group Management
- Process Tracking
- Admin Dashboard

## Development

### Backend Structure
```
backend/
├── src/
│   ├── config/      # Configuration files
│   ├── middleware/  # Custom middleware
│   ├── routes/      # API routes
│   └── index.ts     # Entry point
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/  # Reusable components
│   ├── contexts/    # React contexts
│   ├── pages/       # Page components
│   └── main.tsx     # Entry point
```

## Troubleshooting

1. **Database Connection Issues**
   - Verify MySQL and Redis are running
   - Check credentials in .env file
   - Ensure database and tables are created

2. **OAuth Issues**
   - Verify Google OAuth credentials
   - Check redirect URI configuration
   - Ensure cookies are enabled in browser

3. **Frontend Connection Issues**
   - Check if backend is running
   - Verify VITE_API_URL in frontend .env
   - Check CORS configuration

## License

[Your License Here] 