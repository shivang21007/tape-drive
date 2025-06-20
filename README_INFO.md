# TapeX: Tape Management System

A modern full-stack application for secure tape, file, and user management with advanced role-based access control, group management, and real-time notifications.

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Usage](#usage)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features
- **Google OAuth Authentication**
- **Role-based Access Control** (Admin, User, etc.)
- **User & Group Management**
  - Add/delete groups (admin only, with user reassignment checks)
  - Add/delete users (admin only)
  - Change user roles and group assignments
- **Tape Management**
  - View, search, and filter tapes
  - Admin can reassign tapes to groups
  - Users see only tapes for their group
- **File Upload & Download**
  - Upload from PC or through server (with progress, speed, and cancel)
  - Download/upload history
- **Search Functionality**
  - Real-time search with suggestions on Files and History pages
- **Notifications**
  - Toast notifications for all major actions (success, error, info)
  - Automated email notifications (Nodemailer)
- **Modern UI/UX**
  - Responsive, accessible, and visually consistent
  - Animated gradients, badges, and clear action grouping
- **Security**
  - Session-based authentication, secure cookies, CORS, HTTPS

---

## Architecture
- **Frontend:** React + Vite (port 5173)
- **Backend:** Node.js + Express (port 8000)
- **Database:** MySQL

```
Browser <-> Frontend (5173) <-> Backend (8000) <-> MySQL
```

---

## Screenshots
> _Add screenshots here for Home, Admin, Tape Info, etc._

---

## Tech Stack
**Frontend:**
- React 18+
- TypeScript
- Vite
- React Router
- Axios
- Tailwind CSS
- React-Toastify

**Backend:**
- Node.js 16+
- Express.js
- TypeScript
- MySQL2
- Passport.js (Google OAuth)
- Nodemailer

---

## Getting Started

### Prerequisites
- Node.js 16.20.2 (LTS)
- npm 8.x or higher
- MySQL 5.7 or higher
- (Optional) CentOS 7 for production

### Installation
1. **Clone the repository:**
```bash
git clone <repository-url>
cd tape-drive
```
2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   # Create .env file (see .env.example)
   npm run migrate
   npm run dev
   ```
3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   # Create .env file (see .env.example)
   npm run dev
   ```

### Environment Variables
- See `.env.example` in both frontend and backend for required variables (Google OAuth, DB credentials, etc.)

---

## Usage
- **Admin:**
  - Access `/admin` for user, group, and tape management
  - Can add/delete users and groups, reassign tapes, and see all data
- **User:**
  - Can upload/download files, view tape info for their group, and see their own history
- **Search:**
  - Use the search bar on Files and History pages for real-time filtering
- **Notifications:**
  - All major actions show toast notifications (top-right)
- **Mail:**
  - Automated emails for certain actions; "Contact Admin" opens mail client

---

## API Overview
- `POST /api/groups` — Add group (admin)
- `DELETE /api/groups/:groupName` — Delete group (admin, only if no users)
- `GET /api/tapes` — List all tapes (admin)
- `PUT /api/tapes/:id/group` — Change tape group (admin)
- `DELETE /api/users/:id` — Delete user (admin)
- ...and more (see backend/src/routes/api.ts)

---

## Troubleshooting
- **Node.js version mismatch:** Use Node.js 16.20.2 LTS
- **MySQL connection issues:** Check DB credentials and server
- **Google OAuth issues:** Verify credentials and callback URLs
- **Docker:** _Not officially supported; run frontend and backend separately_

---

## License
ISC 

---

> _For more details, see the code and comments in each directory._ 