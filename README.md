# Lists

A shared household list app for couples, roommates, and families. Real-time sync, offline-first, installable as a PWA on iPhone or Android.

## Features

- **Multiple shared lists** — groceries, household, party, packing, anything
- **Real-time sync** between everyone signed in
- **Smart autocomplete** from item history, with recurring items ranked first
- **Auto-categorization** of items (Produce, Dairy, Meat, Frozen, Household, etc.)
- **Shopping mode** — items grouped by category, progress bar, optimized for in-store one-handed use
- **Swipe gestures** — swipe right to check, left to delete
- **Long-press for actions** — rename, change category, star, delete
- **Recurring items** — star your regulars, one tap to add them all
- **Offline-first** — works without signal, syncs when back online with timestamp-based conflict resolution
- **Bulk paste** — paste a list from Apple Notes, Notion, anywhere, items are split and parsed automatically
- **Search inside a list**
- **Undo for destructive actions** (delete, clear all)

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (Postgres + Auth + Realtime)
- [Vercel](https://vercel.com) for hosting

## Setup for your own deployment

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a free account and a new project.

### 2. Run the database schema
In your Supabase project, open the **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql). This creates the tables, triggers, RLS policies, and realtime publications.

For existing deployments, use the files in [`supabase/migrations`](supabase/migrations) instead of pasting the full schema. Test migrations against a Supabase branch or disposable project before production. Supabase branching requires a Pro plan; if branching is unavailable, take a database backup before applying migrations.

### 3. Disable email confirmation (optional, recommended for personal use)
In Supabase: **Authentication → Providers → Email → toggle off "Confirm email"**. This way you can sign in immediately after creating an account without a confirmation email.

### 4. Clone and install

```bash
git clone https://github.com/<your-username>/lists.git
cd lists
npm install
```

### 5. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key (find them in Supabase → Settings → API):

```bash
cp .env.example .env.local
# then edit .env.local
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start adding items.

### 7. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, set the same env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.

### 8. Install on your phone

Open the deployed URL in Safari (iOS) or Chrome (Android), then **Share → Add to Home Screen**. The app runs full-screen like a native app.

## Authorization model

The current schema uses a household membership model. Users must be present in `household_members` before they can read or write household lists, items, or item history. The first migration backfills all existing Supabase Auth users into the default `NK Household`.

## Personalization

The app name and tagline are configurable via environment variables, so you can rebrand for your household without committing personal info:

```bash
NEXT_PUBLIC_APP_NAME="Smith Family Lists"
NEXT_PUBLIC_APP_TAGLINE="Our shared everything"
```

For deeper customization:

- Change the logo in `public/icon.svg`, then run `node scripts/generate-icons.mjs` to regenerate the PNGs (requires `npm install --no-save sharp`)
- Change the theme color in `app/layout.tsx` (`viewport.themeColor`) and `public/manifest.json` (`theme_color`)
- Add new categories or tweak the auto-categorization in `lib/categories.ts`

## License

MIT, see [LICENSE](LICENSE).

## Built with help from

[Claude Code](https://claude.com/claude-code) — pair-built one prompt at a time.
