
# BrainGuard AI - Comprehensive Medical Platform

A full-stack medical platform with AI-powered brain disease detection, appointment booking, real-time chat, payment processing, and comprehensive patient management system.

## 🎥 Demo Video

[![Watch Demo](https://img.youtube.com/vi/Lp5poZQzjXs/0.jpg)](https://youtu.be/Lp5poZQzjXs)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Database Setup](#database-setup)
- [Key Modules](#key-modules)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

BrainGuard AI is a comprehensive medical platform that combines:
- **AI-Powered Disease Detection**: Brain tumor, Alzheimer's, and Multiple Sclerosis detection using deep learning models
- **Patient Management**: Complete patient portal with appointments, medications, reports, and chat
- **Doctor Dashboard**: Full-featured doctor interface for managing patients, appointments, and consultations
- **Real-time Communication**: Secure chat system between patients and doctors
- **Payment Processing**: Integrated Stripe payment system
- **Report Generation**: AI-generated medical reports with PDF export

## ✨ Features

### Patient Features
- 🧠 **AI Disease Detection**
  - Brain Tumor Detection (U-Net model)
  - Alzheimer's Disease Detection (Swin Transformer)
  - Multiple Sclerosis Detection
  - Real-time analysis with detailed reports
  - PDF report generation and download

- 📅 **Appointment Management**
  - Browse and search verified doctors
  - Book appointments with time slot selection
  - View appointment history
  - Reschedule missed appointments
  - Delete missed appointments
  - Real-time appointment notifications

- 💬 **Patient-Doctor Chat**
  - Real-time messaging with doctors
  - File and image sharing
  - Voice message recording and playback
  - Message read receipts
  - Delete own messages

- 💊 **Medication Management**
  - Add and manage medications
  - Set medication reminders
  - Track medication schedules

- 📄 **Report Management**
  - View all AI-generated reports
  - Download reports as PDF
  - Share reports with doctors

- 💳 **Payment Processing**
  - Secure Stripe integration
  - Payment history
  - Invoice management

### Doctor Features
- 📊 **Doctor Dashboard**
  - View all patient appointments
  - Manage appointment status
  - Cancel appointments
  - View patient information

- 💬 **Patient Chat Management**
  - Chat with multiple patients
  - Real-time messaging
  - File sharing capabilities

- 💰 **Payment Management**
  - View payment records
  - Track payment status

- 📋 **Patient Management**
  - View patient profiles
  - Access patient medical history

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **React Router** - Navigation
- **Supabase Client** - Database and authentication
- **Stripe.js** - Payment processing

### Backend
- **FastAPI** - Python web framework
- **PyTorch** - Deep learning framework
- **TensorFlow/Keras** - Model loading and inference
- **U-Net Model** - Brain tumor segmentation
- **Swin Transformer** - Alzheimer's detection
- **Pillow** - Image processing

### Database & Services
- **Supabase** - PostgreSQL database, authentication, real-time subscriptions, storage
- **Stripe** - Payment processing
- **Supabase Edge Functions** - Serverless functions

## 📁 Project Structure

```
BrainGuard/
├── src/                          # Frontend source code
│   ├── components/              # React components
│   │   ├── AppointmentBooking.tsx    # Patient appointment booking
│   │   ├── Chat.tsx                  # Real-time chat component
│   │   ├── DoctorDashboard.tsx       # Doctor dashboard
│   │   ├── DoctorSidebar.tsx         # Doctor navigation sidebar
│   │   ├── Medication.tsx            # Medication management
│   │   ├── Payment.tsx               # Payment processing
│   │   ├── ReportGeneration.tsx      # Report generation
│   │   ├── Sidebar.tsx               # Patient navigation sidebar
│   │   └── UserProfileModal.tsx      # User profile modal
│   ├── contexts/                 # React contexts
│   │   └── AuthContext.tsx       # Authentication context
│   ├── hooks/                    # Custom React hooks
│   │   ├── useRealtime.ts        # Real-time subscriptions
│   │   └── ...
│   ├── lib/                      # Services and utilities
│   │   ├── brainAnalysisService.ts   # AI analysis service
│   │   ├── chatService.ts            # Chat functionality
│   │   ├── supabase-operations.ts    # Database operations
│   │   └── supabase.ts               # Supabase client
│   ├── pages/                    # Page components
│   │   ├── LoginPage.tsx
│   │   └── SignupPage.tsx
│   ├── App.tsx                   # Main app component
│   └── main.tsx                  # Entry point
│
├── backend/                       # Python backend
│   ├── app/
│   │   ├── api/                  # API routes
│   │   │   ├── routes/
│   │   │   │   ├── analysis.py   # AI analysis endpoints
│   │   │   │   └── email.py      # Email endpoints
│   │   ├── core/                 # Core configuration
│   │   │   └── config.py         # App configuration
│   │   ├── services/             # Business logic
│   │   │   ├── alzheimer_service.py      # Alzheimer detection
│   │   │   ├── model_service.py          # Model management
│   │   │   └── unified_model_service.py  # Unified model service
│   │   └── main.py               # FastAPI application
│   ├── models/                   # AI model files
│   │   ├── best_swin_alzheimer.pt    # Alzheimer model
│   │   └── unet_model.h5             # Brain tumor model
│   ├── requirements.txt          # Python dependencies
│   └── run.py                    # Backend entry point
│
├── supabase/                     # Supabase configuration
│   └── functions/                # Edge functions
│       ├── create-payment-intent/
│       └── notify-upcoming-appointments/
│
├── supabase-setup.sql            # Main database setup
├── supabase-add-chat-messages-delete-policy.sql  # Chat delete policies
├── package.json                  # Frontend dependencies
├── vite.config.ts               # Vite configuration
├── tailwind.config.js            # Tailwind configuration
└── tsconfig.json                 # TypeScript configuration
```

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.8+
- **Supabase Account** (free tier works)
- **Stripe Account** (for payments)

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
pip install -r requirements.txt
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-setup.sql`
3. Run `supabase-add-chat-messages-delete-policy.sql` for chat delete functionality
4. Get your Supabase URL and anon key from Project Settings > API

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

Update `src/lib/supabase.ts` with your Supabase credentials (or use environment variables).

### 4. Backend Setup

1. Place your AI models in `backend/models/`:
   - `unet_model.h5` - Brain tumor detection model
   - `best_swin_alzheimer.pt` - Alzheimer detection model

2. Start the backend:
```bash
cd backend
python run.py
```
Or use `start.bat` on Windows.

The backend will run on `http://localhost:8000`

### 5. Start Frontend

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🗄 Database Setup

### Main Tables
- **users** - User accounts (patients and doctors)
- **patients** - Patient profiles
- **doctors** - Doctor profiles
- **appointments** - Appointment records
- **chats** - Chat conversations
- **chat_messages** - Chat messages
- **payments** - Payment records
- **scans** - Medical scan records
- **reports** - Generated reports
- **medications** - Medication records
- **appointment_notifications** - Appointment notifications

### Row Level Security (RLS)
All tables have RLS policies enabled for security:
- Patients can only access their own data
- Doctors can access their patients' data
- Proper authentication checks on all operations

Run `supabase-setup.sql` to set up all tables, policies, and functions.

## 🔑 Key Modules

### Authentication
- Email/password authentication via Supabase Auth
- Role-based access (patient/doctor)
- Session management
- Protected routes

### AI Analysis Module
- **Brain Tumor Detection**: U-Net segmentation model
- **Alzheimer's Detection**: Swin Transformer classification
- **Multiple Sclerosis Detection**: Advanced lesion detection
- Real-time processing with progress indicators
- Comprehensive report generation

### Appointment System
- Doctor availability management
- Time slot booking
- Appointment status tracking (pending, confirmed, completed, missed, cancelled)
- Automatic missed appointment detection
- Reschedule and delete functionality

### Chat System
- Real-time messaging via Supabase Realtime
- File and image uploads to Supabase Storage
- Voice message recording and playback
- Message read receipts
- Message deletion (own messages only)

### Payment System
- Stripe integration for secure payments
- Payment intent creation
- Payment history tracking
- Invoice generation

## 📡 API Endpoints

### Backend (FastAPI)

**Analysis Endpoints:**
- `POST /api/analyze/brain-tumor` - Brain tumor detection
- `POST /api/analyze/alzheimer` - Alzheimer's detection
- `POST /api/analyze/comprehensive` - Comprehensive analysis

**Email Endpoints:**
- `POST /api/email/send-report` - Send report via email

### Supabase
- All database operations via Supabase client
- Real-time subscriptions for chat and notifications
- Storage for file uploads (chat files, scan images)

## 🔐 Environment Variables

Required environment variables (can be hardcoded in `src/lib/supabase.ts`):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 🐛 Troubleshooting

### Backend Issues
- **Model not loading**: Ensure model files are in `backend/models/` with correct names
- **Port already in use**: Change port in `backend/app/core/config.py`
- **Import errors**: Ensure all dependencies are installed: `pip install -r requirements.txt`

### Frontend Issues
- **Supabase connection errors**: Check your Supabase URL and key in `src/lib/supabase.ts`
- **Build errors**: Clear cache: `rm -rf .vite node_modules/.vite` (or delete `.vite` folder on Windows)
- **Module not found**: Run `npm install` again

### Database Issues
- **RLS policy errors**: Ensure all policies are created by running `supabase-setup.sql`
- **Permission denied**: Check that RLS policies allow the operation for the user's role
- **Chat messages not sending**: Run `supabase-add-chat-messages-delete-policy.sql` for INSERT policies

### Common Fixes
1. **Clear build cache**: Delete `.vite` folder and restart dev server
2. **Reinstall dependencies**: Delete `node_modules` and `package-lock.json`, then `npm install`
3. **Check Supabase connection**: Verify credentials in browser console
4. **Check backend logs**: Look for errors in backend terminal

## 📝 Additional Documentation

- `QUICK_START.md` - Quick setup guide
- `SUPABASE_RLS_POLICIES.md` - Detailed RLS policy documentation
- `STRIPE_SETUP.md` - Stripe integration guide
- `STRIPE_TEST_CARDS.md` - Test card numbers for development
- `DEPLOY_EDGE_FUNCTION.md` - Edge function deployment guide

## 🎯 Development Commands

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Backend
cd backend
python run.py        # Start FastAPI server
```

## 📦 Key Dependencies

### Frontend
- `react` & `react-dom` - UI framework
- `@supabase/supabase-js` - Database and auth
- `@stripe/stripe-js` - Payment processing
- `framer-motion` - Animations
- `lucide-react` - Icons
- `react-router-dom` - Routing

### Backend
- `fastapi` - Web framework
- `torch` - PyTorch for deep learning
- `tensorflow` - TensorFlow for model loading
- `pillow` - Image processing
- `uvicorn` - ASGI server

## 🔒 Security Features

- Row Level Security (RLS) on all database tables
- Authentication required for all operations
- Role-based access control (patient/doctor)
- Secure file uploads to Supabase Storage
- Encrypted payment processing via Stripe
- Input validation and sanitization

## 🚀 Deployment

### Frontend
- Build: `npm run build`
- Deploy `dist/` folder to Vercel, Netlify, or any static host
- Set environment variables in hosting platform

### Backend
- Deploy to Heroku, Railway, or any Python hosting
- Set environment variables
- Ensure models are accessible

### Database
- Supabase handles database hosting
- Edge functions deploy via Supabase CLI

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs in dashboard
3. Check browser console for frontend errors
4. Check backend terminal for API errors

## 📄 License

This project is for educational purposes (FYP - Final Year Project).

---

**Built with ❤️ for better healthcare**

# BrainGuard-AI
A web based app for detecting brain diseases like Brain Tumor, Alzheimer and Multiple Sclorosis
