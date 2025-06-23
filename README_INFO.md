# TapeX: Tape Management System

This project is created to manage LTO9 Tape Library connected to our server.
A modern full-stack application for secure tape, file, and user management with advanced role-based access control, group management, and real-time notifications.

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Usage](#usage)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🔐 Authentication & Security
- **Google OAuth Authentication** with secure session management
- **Role-based Access Control** (Admin, User, etc.)
- **Secure cookie handling** with HTTPS support
- **CORS protection** and input sanitization

### 👥 User & Group Management
- **User Management**: Add/delete users (admin only)
- **Group Management**: Add/delete groups with user reassignment checks
- **Role Assignment**: Change user roles and group assignments
- **Domain Restrictions**: Restrict access to specific email domains

### 📼 Tape Management
- **Tape Information**: View, search, and filter tapes
- **Group Assignment**: Admin can reassign tapes to groups
- **Access Control**: Users see only tapes for their group
- **Status Tracking**: Monitor tape usage and availability

### 📁 File Operations
- **File Upload**: Upload from PC or through server with progress tracking
- **File Download**: Secure download with authentication
- **Progress Tracking**: Real-time upload/download progress with speed calculation
- **Cancel Operations**: Ability to cancel ongoing uploads
- **File History**: Complete upload and download history
- **Description Editing**: Inline editing of file descriptions

### 🔍 Advanced Search & Filtering
- **Real-time Search**: Instant search with suggestions
- **Multi-criteria Filtering**: Filter by username, filename, tape number, description
- **Debounced Search**: Optimized API calls with 500ms debounce
- **URL Parameters**: Shareable and bookmarkable filter states
- **Server-side Pagination**: Efficient data loading with 20 items per page

### 📧 Notifications & Communication
- **Toast Notifications**: Real-time feedback for all major actions
- **Email Notifications**: Automated emails via Nodemailer
- **Contact Admin**: Direct email integration for support

### 🎨 Modern UI/UX
- **Responsive Design**: Optimized for 1920x1080 screens
- **Tailwind CSS**: Modern, consistent styling
- **Animated Elements**: Smooth transitions and hover effects
- **Accessibility**: Keyboard navigation and screen reader support
- **Dark/Light Theme**: Automatic theme detection

### 🔧 System Features
- **SSH Integration**: Secure file transfers between servers
- **Worker System**: Background job processing for file operations
- **Redis Integration**: Session storage and job queuing
- **Database Management**: MySQL with optimized queries
- **File Caching**: Intelligent caching system for frequently accessed files

---

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Browser   │◄──►│  Frontend   │◄──►│   Backend   │◄──►│    MySQL    │
│             │    │   (5173)    │    │   (8000)    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │    Redis    │    │ Worker      │
                   │  (Sessions) │    │ Service     │
                   └─────────────┘    └─────────────┘
```

---

## Tech Stack

### Frontend
- **React 18+** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **React-Toastify** - Toast notifications
- **Lodash** - Utility functions (debounce)

### Backend
- **Node.js 16+** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type-safe development
- **MySQL2** - Database driver
- **Passport.js** - Authentication middleware
- **Nodemailer** - Email service
- **Redis** - Session storage and caching
- **Multer** - File upload handling
- **Shell-escape** - Command injection protection

### Infrastructure
- **MySQL** - Primary database
- **Redis** - Session storage and job queuing
- **Nginx** - Reverse proxy (production)
- **PM2** - Process manager (production)

---

## Getting Started

### Prerequisites
- **Node.js 16.20.2** (LTS) or higher
- **npm 8.x** or higher
- **MySQL 5.7** or higher
- **Redis** (for session storage and job queuing)
- **Git** for version control

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd tape
```

2. **Backend Setup:**
```bash
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

3. **Frontend Setup:**
```bash
cd frontend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

4. **Worker Service Setup:**
```bash
cd worker-service
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start worker service
npm run dev
```

### Environment Configuration

#### Backend (.env)
```env
# Server Configuration
PORT=8000
NODE_ENV=development
BACKEND_NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=tapex_db
DB_PORT=3306

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback

# Session
SESSION_SECRET=your_session_secret
FRONTEND_URL=http://localhost:5173

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# File Upload
UPLOAD_DIR=/path/to/upload/directory
MAX_FILE_SIZE=100gb

# Server Information
SERVER_NAME=your_server_name
SERVER_IP=your_server_ip
```

#### Frontend (.env)
```env
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_NODE_ENV=development

```

#### Worker Service (.env)
```env
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=tapex_db
DB_PORT=3306

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# File Operations
UPLOAD_DIR=/path/to/upload/directory
TAPE_MOUNT_DIR=/path/to/tape/mount
```

---

## Usage

### For Administrators

#### User Management
- Navigate to `/admin` → Users tab
- **Add Users**: Click "Add User" and fill in details
- **Delete Users**: Click delete button (⚠️ irreversible)
- **Change Roles**: Use dropdown to assign admin/user roles
- **Group Assignment**: Assign users to groups

#### Group Management
- Navigate to `/admin` → Groups tab
- **Add Groups**: Create new groups for organization
- **Delete Groups**: Remove groups (only if no users assigned)
- **User Reassignment**: Automatically handled when deleting groups

#### Tape Management
- Navigate to `/admin` → Tapes tab
- **View All Tapes**: See complete tape inventory
- **Reassign Tapes**: Change group ownership
- **Monitor Usage**: Track tape status and capacity

### For Users

#### File Operations
- **Upload Files**: Drag & drop or click to upload
- **Download Files**: Click download button for any file
- **View History**: Check upload/download history
- **Edit Descriptions**: Click edit icon to modify file descriptions

#### Search & Filter
- **Real-time Search**: Type to search across files
- **Advanced Filters**: Use dropdown to filter by specific criteria
- **Clear Filters**: Remove individual or all filters
- **Pagination**: Navigate through large datasets

#### Tape Information
- Navigate to `/tapeinfo` to view tapes for your group
- **Click Tape Numbers**: Direct links to filtered file lists
- **Status Monitoring**: Check tape availability and usage

### Navigation
- **Home** (`/`): Main dashboard with upload options
- **Files** (`/files`): File management and search
- **History** (`/history`): Download/upload history
- **Tape Info** (`/tapeinfo`): Tape information for your group
- **Admin** (`/admin`): Administrative functions (admin only)

---

## API Overview

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout user

### User Management
- `GET /api/users` - List all users (admin)
- `POST /api/users` - Create new user (admin)
- `DELETE /api/users/:id` - Delete user (admin)
- `PUT /api/users/:id/role` - Update user role (admin)

### Group Management
- `GET /api/groups` - List all groups
- `POST /api/groups` - Create new group (admin)
- `DELETE /api/groups/:groupName` - Delete group (admin)
- `PUT /api/groups/:id` - Update group (admin)

### File Operations
- `GET /api/files` - List files with pagination and filtering
- `POST /api/upload` - Upload file
- `POST /api/download` - Request file download
- `PUT /api/files/:id/description` - Update file description
- `POST /api/cancel-upload` - Cancel ongoing upload

### Tape Management
- `GET /api/tapes` - List tapes (filtered by user group)
- `PUT /api/tapes/:id/group` - Reassign tape to group (admin)
- `GET /api/tapeinfo` - Get tape information

### History
- `GET /api/history` - Get download/upload history with filtering

### Secure Operations
- `POST /api/secureupload` - Secure file upload via SSH
- `POST /api/securedownload` - Secure file download via SSH

---

## Troubleshooting

### Common Issues

#### Node.js Version Issues
```bash
# Check Node.js version
node --version  # Should be 16.20.2 or higher

# Use nvm to switch versions
nvm use 16.20.2
```

#### MySQL Connection Issues
```bash
# Check MySQL service
sudo systemctl status mysql

# Test connection
mysql -u your_user -p your_database
```

#### Redis Connection Issues
```bash
# Check Redis service
sudo systemctl status redis

# Test connection
redis-cli ping  # Should return PONG
```

#### Google OAuth Issues
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Check callback URL matches Google Console settings
- Ensure domain is authorized in Google Console

#### File Upload Issues
- Check `UPLOAD_DIR` permissions
- Verify disk space availability
- Check file size limits in configuration

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :5173  # Frontend
lsof -i :8000  # Backend
lsof -i :6379  # Redis
```

### Development Commands

#### Backend
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run migrate      # Run database migrations
npm run test         # Run tests
```

#### Frontend
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

#### Worker Service
```bash
cd worker-service
npm run dev          # Start worker service
npm run build        # Build for production
```

### Production Deployment

#### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start services
pm2 start backend/dist/index.js --name "tapex-backend"
pm2 start worker-service/dist/index.js --name "tapex-worker"
pm2 start frontend/dist --name "tapex-frontend"

# Monitor services
pm2 status
pm2 logs
```

#### Using Docker (Optional)
```bash
# Build and run with Docker Compose
docker-compose up -d
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper TypeScript types
4. **Test thoroughly** on different screen sizes
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use meaningful commit messages
- Test on 1920x1080 resolution
- Ensure responsive design works
- Add proper error handling
- Include JSDoc comments for functions

### Code Style
- Use Prettier for code formatting
- Follow ESLint rules
- Use meaningful variable names
- Add proper TypeScript interfaces
- Include error boundaries in React components

---

## License

This project is licensed under the **ISC License**.

---

## Support

For support and questions:
- **Email**: Contact developer through the email [shivang.gupta@octrotalk.com](mailto:shivang.gupta@octrotalk.com)
- **Issues**: Create an issue in the repository
- **Documentation**: Check inline code comments

---

## Project Status

✅ **Active Development** - This project is actively maintained and developed.

**Current Version**: 1.0.0  
**Last Updated**: 22th June 2025  
**Maintainer**: Devops Team

---

> For detailed technical information, see the inline comments in the source code and the API documentation above.
