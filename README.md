# CollabBoard

## Getting Started

1) Copy environment variables:

```bash
cp .env.example .env.local
```

2) Fill in values for Supabase and OpenAI.

3) Run the SQL migration in `supabase/migrations/0001_init.sql` in your Supabase project.

4) Install dependencies and run:

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
