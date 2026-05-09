# Deployment

## Recommended Flow

1. Push code to `main`
2. Build app with CI (`npm run build`)
3. Deploy static `dist/` to your host (GitHub Pages / Vercel / Netlify)

## Required Environment Variables

Set these in your deployment platform:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_SETTLEMENT_TRANSFER_FEATURE`

## Local Production Check

```bash
npm run build
npm run preview
```

## GitHub Actions Notes

Project already has workflow files under `.github/workflows`.
Ensure deployment pipeline injects the variables above.

## Post-Deploy Checklist

- Login works
- Event detail loads
- Settlement flow works
- Notifications page works
- Scores can be created and shown in Event Detail
