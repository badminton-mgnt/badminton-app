# Quickstart

## 1) Prerequisites

- Node.js 18+
- npm
- Supabase project

## 2) Install

```bash
npm install
```

## 3) Environment

Create `.env` at project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ENABLE_SETTLEMENT_TRANSFER_FEATURE=true
```

## 4) Database

In Supabase SQL editor, run:

1. `supabase/schema.sql`
2. `supabase/triggers.sql`

## 5) Run App

```bash
npm run dev
```

Open: `http://localhost:5173`

## 6) Build Check

```bash
npm run build
npm run preview
```

## 7) Useful Links

- `README.md`
- `SUPABASE_SETUP.md`
- `DEPLOYMENT.md`
