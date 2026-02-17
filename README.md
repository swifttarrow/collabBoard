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
