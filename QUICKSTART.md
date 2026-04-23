# Getting Started - Quick Start Guide

## 📋 Prerequisites

- Node.js 16+ installed
- Supabase account (free tier available)
- GitHub account (optional, for deployment)

## 🚀 Step 1: Setup Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up or login
3. Click "New Project"
4. Choose a name and password
5. Wait for project to initialize

### 1.2 Get Your Credentials

1. Project Settings → API
2. Copy your Project URL and Anon Key
3. Save them somewhere safe

### 1.3 Setup Database

1. Go to SQL Editor
2. New Query
3. Copy entire content from `supabase/schema.sql`
4. Execute
5. Wait for success
6. New Query
7. Copy entire content from `supabase/triggers.sql`
8. Execute

## 🔧 Step 2: Setup Local Project

### 2.1 Clone & Install

```bash
cd badminton-app
npm install
```

### 2.2 Setup Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2.3 Run Locally

```bash
npm run dev
```

Open http://localhost:5173

## ✅ Test the App

1. **Sign Up**: Create account (email verified)
2. **Create Team**: Go to Me → Create Team
3. **Create Event**: Go to Events → Create Event
4. **Add Expense**: Go to Event → Add Expense
5. **Check Payment**: Go to Home → Payment Status

## 📱 Mobile Testing

Use Chrome DevTools:

1. Press F12
2. Click device icon (top-left)
3. Select iPhone or Android
4. Refresh page

## 🎯 Features to Test

- [x] Email verification
- [x] Login/Logout
- [x] Create team
- [x] Add events
- [x] Check-in participants
- [x] Add expenses
- [x] Payment settlement
- [x] Update payment info
- [x] Smooth animations
- [x] Mobile responsive

## 🐛 Troubleshooting

### Email not sending
- Check Supabase email settings
- Check spam folder
- Email provider might have limits on free tier

### Can't login
- Make sure email is verified
- Check password requirements
- Check .env credentials

### Database errors
- Make sure schema.sql was executed
- Check RLS policies
- Check user is in correct team

### Styling issues
- Run `npm install tailwindcss -D`
- Restart dev server

## 📦 Build for Production

```bash
npm run build
npm run preview
```

Output will be in `dist/` folder

## 🌐 Deploy on GitHub Pages

1. Push to GitHub
2. Settings → Pages
3. Source: GitHub Actions
4. Add secrets: SUPABASE_URL, SUPABASE_ANON_KEY

See `DEPLOYMENT.md` for details.

## 📞 Need Help?

Check:
- `README.md` - Feature overview
- `SUPABASE_SETUP.md` - Database setup
- `DEPLOYMENT.md` - Production deployment
- `app-requirements.md` - Full requirements

---

Happy coding! 🏸
