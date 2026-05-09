# Badminton App

Web app for managing badminton teams, events, check-ins, expenses, settlement, notifications, and score tracking.

## Tech Stack

- `React` + `Vite`
- `Supabase` (Auth, Postgres, RLS)
- `Framer Motion`
- `Tailwind CSS`

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create `.env` in project root

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ENABLE_SETTLEMENT_TRANSFER_FEATURE=true
```

3. Run dev server

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - build production bundle
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint

## Database Setup

Run schema in Supabase SQL editor:

- `supabase/schema.sql`
- `supabase/triggers.sql`

See `SUPABASE_SETUP.md` for details.

## Deployment

See `DEPLOYMENT.md`.

## Other Docs

- `QUICKSTART.md`
- `SUPABASE_SETUP.md`
- `DEPLOYMENT.md`
