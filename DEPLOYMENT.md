# Hướng dẫn Deployment

## 1. Deploy Frontend trên GitHub Pages

### Setup GitHub Pages

1. Push code lên GitHub
2. Repository Settings → Pages
3. Build and deployment → Source: GitHub Actions

### Tạo GitHub Actions Workflow

Tạo file `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Add Secrets

1. Repository Settings → Secrets and variables → Actions
2. Add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## 2. Supabase Backend

Supabase tự động host backend:

- Database
- Authentication
- Storage (tùy chọn)
- Real-time subscriptions

Không cần additional deployment.

## 3. Build & Test Locally

```bash
npm run build
npm run preview
```

## 4. Post-Deployment Checks

- [ ] Login/Signup working
- [ ] Events load correctly
- [ ] Payments calculate correctly
- [ ] Animations smooth
- [ ] Mobile responsive
- [ ] Supabase connection stable

## 5. Production Considerations

- [ ] Setup custom domain (GitHub Pages)
- [ ] Enable HTTPS
- [ ] Setup error tracking (Sentry, etc.)
- [ ] Monitor Supabase usage
- [ ] Setup backup strategy
- [ ] Configure CORS if needed
