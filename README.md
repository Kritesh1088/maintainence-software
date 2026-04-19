# 🏨 Hotel Arya Pro Ultra - Maintenance Management System

A modern, real-time **hotel maintenance tracking web application** built with Firebase. Designed to help hotel staff and administrators efficiently manage room issues, assign tasks, and track repairs across multiple floors.

![Version](https://img.shields.io/badge/version-3.0-blue)
![Status](https://img.shields.io/badge/status-production-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## ✨ Features

### 🔐 Authentication & Roles
- **Firebase Authentication** with email/password
- **Role-based access control** (Admin / Staff)
- **Persistent login** (stays logged in across sessions)
- **Active/Inactive user status** management

### 🏠 Room Management
- Add, edit, and delete rooms (floor-wise)
- Organize rooms by floor
- Visual room blocks with issue counts

### 🛠️ Issue Tracking
- **Multi-issue add** (add multiple issues at once)
- **6 Categories**: Civil, Electrical, Furniture, Plumbing, Missing, Other
- **3 Priority levels**: High, Medium, Low
- **3 Status types**: Pending, Fixed, Closed
- **Photo attachments** for issues
- **Assign to staff** members
- **Full status history** tracking

### 📊 Dashboard & Analytics
- Real-time statistics (Total, Pending, Fixed, Closed, High priority, Today's issues)
- Interactive **doughnut chart** (Chart.js)
- **Professional report view** with print support

### 🔍 Smart Features
- **Smart search** with keywords (e.g., "high pending electrical")
- **Category filters** (pills-based)
- **Staff filter** for assigned issues
- **Swipe gestures** on mobile (swipe right = status change, swipe left = delete)

### 🗑️ Bin System
- Deleted items move to Bin (not permanently deleted)
- **Auto-delete after 10 days**
- **Restore** capability for admins

### 🎨 UX/UI
- **Dark mode** toggle
- **Fully responsive** (mobile + desktop)
- **Offline support** via localStorage fallback
- Modern design with DM Sans font

### 💾 Data Management
- **Dual sync**: Firestore (cloud) + localStorage (offline)
- **Export/Import** JSON backup (Admin only)
- **Real-time cloud sync** across devices

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **HTML5** | Structure |
| **CSS3** | Styling (custom design system) |
| **Vanilla JavaScript** | Logic (no framework) |
| **Firebase Auth** | User authentication |
| **Firestore** | Cloud database |
| **Chart.js** | Data visualization |
| **Google Fonts** | DM Sans + DM Mono |

---

## 📁 Project Structure