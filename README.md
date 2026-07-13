# lowhangingfruits

This repo hosts two independent Next.js apps sharing one codebase:

- **YouTube Performance Reporter** (`src/app/yt/*`, `src/app/api/yt/*`) — internal Wemul tool to
  turn YouTube Studio CSV exports into branded performance reports. See below for setup.
- **Cross-border Editorial Opportunity Dashboard** (`src/app/page.tsx`) — the original
  create-next-app project (topic/trend discovery via RSS ingestion). Unrelated to the YT reporter;
  not covered here.

## YouTube Performance Reporter — setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env template and fill in real values:

   ```bash
   cp .env.example .env
   ```

3. Run migrations and seed the first internal user + a sample client/channel:

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Log in at [http://localhost:3000/yt/login](http://localhost:3000/yt/login) with the
   `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` from your `.env`.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |
| `npm test` | Vitest — parsing, metrics, insights, and full-import-flow tests |
| `npx prisma migrate dev` | Create/apply a new migration after editing `prisma/schema.prisma` |
| `npx prisma studio` | Browse the local SQLite database |

### Architecture at a glance

- **Data model**: `prisma/schema.prisma` — SQLite locally (schema stays Postgres-compatible; swap
  `provider`/`DATABASE_URL` in `prisma.config.ts` to move to Postgres).
- **CSV normalization**: `src/lib/yt/parsing/*` — delimiter/number/date/duration parsing, ES/EN
  column mapping, validation. Pure functions, fully unit-tested with real fixture CSVs in
  `src/lib/yt/parsing/__tests__/fixtures/`.
- **Metrics & insights**: `src/lib/yt/metrics/*` (aggregation) and `src/lib/yt/insights/*`
  (period comparison, milestone detection, auto-generated conclusions) — also pure/tested;
  `buildPeriodInsights.ts` is the only piece that touches the database.
- **Design system**: `src/components/wemul/*` — ported from the Wemul Design System (Claude
  Design project `f56d87ed-…`); tokens in `src/styles/wemul-tokens.css`.
- **Auth**: `src/middleware.ts` + `src/lib/yt/auth/*` — simple signed-cookie session, no external
  identity provider.

### Status / what's next

Done: login, client/channel/period CRUD, CSV upload wizard (mapping, validation, duplicate
detection), dashboard, period comparison, milestone detection, editable conclusions.

Not yet built: PDF export (Playwright) and upload/report history browsing — planned as the next
phase.

---

## Cross-border Editorial Opportunity Dashboard (original create-next-app content)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result (same
`npm run dev` as above — both apps run on the same server, different routes).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
