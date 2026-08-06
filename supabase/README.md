# Supabase setup

## 1. Auth settings (required for email + password, no verification)

In [Supabase Dashboard](https://supabase.com/dashboard) → your project:

1. **Authentication → Providers → Email**
   - Enable Email
   - Turn **Confirm email** OFF
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173` for local, and your Vercel URL for prod

## 2. Run the schema

Open **SQL Editor** → New query → paste and run everything in [`schema.sql`](./schema.sql).

If you already ran an older version, re-running is safe (uses `if not exists` / `drop policy if exists`).

## 3. Local env

```bash
cp .env.example .env.local
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).

## 4. Vercel

Add the same two env vars in the Vercel project settings, then redeploy.

## Auth UX

- **Sign up:** email + username + password (+ Liz/Ji)
- **Sign in:** username + password (email is resolved server-side)

## How data works

- First signed-in user creates a shared `budget_workspace` row (seeded from current mock data).
- Liz and Ji both sign up; both can read/write the same workspace.
- Profile stores username + preferred Liz/Ji view; Sign out is in the header.
