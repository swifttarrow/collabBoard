# CollabBoard

## Getting Started

1) Copy environment variables:

```bash
cp .env.example .env.local
```

2) Fill in values for Supabase and OpenAI.

3) Run the SQL migration in `supabase/migrations/0001_init.sql` in your Supabase project.

4) (Optional) Enable **Anonymous Sign-Ins** for the "Continue as Guest" button:

   - **Hosted Supabase** (URL in .env.local points to supabase.com): Go to your project → **Authentication** → **Providers** → enable "Allow anonymous sign-ins".
   - **Local Supabase** (`supabase start`): `supabase/config.toml` already has `enable_anonymous_sign_ins = true`. After config changes, run `supabase stop` then `supabase start`. Ensure `.env.local` uses the local URL (`http://127.0.0.1:54321`) and anon key from `supabase status`—if you're pointing at a hosted project, config.toml has no effect.

5) Install dependencies and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 to see the app.

## E2E tests (Playwright)

Install Playwright browsers once:

```bash
npx playwright install
```

Run e2e tests:

```bash
npm run test:e2e
```

Notes:
- Tests use the local `/e2e/board` harness route and mock board/AI APIs for deterministic runs.
- For interactive debugging, use `npm run test:e2e:headed` or `npm run test:e2e:ui`.
