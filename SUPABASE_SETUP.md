# Supabase Setup

## 1) Create Project

1. Go to `https://supabase.com`
2. Create a project
3. Copy project URL + anon key

## 2) Configure Env

Add to project `.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_ENABLE_SETTLEMENT_TRANSFER_FEATURE=true
```

## 3) Apply SQL

In Supabase SQL editor, run these files in order:

1. `supabase/schema.sql`
2. `supabase/triggers.sql`

## 4) Verify

- Auth can sign up / sign in
- Teams/events load
- RLS behaves correctly per role
- Notifications and score history work

## 5) Runtime Config (Admin)

`app_runtime_configs` is used for app-wide runtime settings.
Current managed key in UI:

- `notifications_retention_days`

Admin can update this from `Manage -> App Settings`.
