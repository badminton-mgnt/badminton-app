#!/bin/bash
# Quick Setup Script - Copy & Paste Commands

# ============================================================================
# BADMINTON APP - QUICK SETUP
# ============================================================================

echo "🏸 Badminton Attendance & Expense App"
echo "=================================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install

# Step 2: Setup environment
echo "📝 Step 2: Setting up environment..."
cp .env.example .env
echo ""
echo "⚠️  IMPORTANT: Edit .env file with your Supabase credentials!"
echo "   VITE_SUPABASE_URL=your-url"
echo "   VITE_SUPABASE_ANON_KEY=your-key"
echo ""

# Step 3: Database setup
echo "💾 Step 3: Setup Database"
echo "Go to Supabase Dashboard → SQL Editor"
echo "Run these SQL files in order:"
echo "1. supabase/schema.sql"
echo "2. supabase/triggers.sql"
echo ""

# Step 4: Start dev server
echo "🚀 Step 4: Starting development server..."
echo "Press Ctrl+C to stop"
npm run dev

echo ""
echo "✅ Done! Open http://localhost:5173"
