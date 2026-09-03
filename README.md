# Casa Nostra

Mobile-first web app for transparently managing household expenses between two cohabiting partners. Every expense entered is shared by definition: 50/50 for rent, 60/40 for everything else (the partner with the higher income pays 60%). The app always shows the current balance and lets you settle it in one tap.

For a full guide to the architecture, domain models, and patterns used in the project, see the **[Developer Wiki](docs/wiki/00-index.md)** (in Italian).

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- [Google Gemini](https://ai.google.dev) (`@google/genai`) for the AI assistant
- [Telegram Bot API](https://core.telegram.org/bots/api) for group notifications and the in-chat assistant (optional)
- TypeScript

## Prerequisites

- Node.js 20 or later
- A [Supabase](https://supabase.com) project (free tier works) with access to the admin dashboard
- A [Google AI Studio](https://aistudio.google.com/apikey) API key for the AI assistant (Gemini)

## Project setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the Supabase database

The database schema (tables, views, RPCs, RLS) is defined in [`docs/casa_nostra_schema.sql`](docs/casa_nostra_schema.sql), which is the authoritative source of truth for the applied schema.

1. Create a new project on [supabase.com](https://supabase.com).
2. Open the project's **SQL Editor** and run the entire contents of `docs/casa_nostra_schema.sql`.
3. The app is designed for exactly two fixed users, created manually (there is no public signup page):
   - Go to **Authentication → Users → Add user** and create the two accounts (email + password).
   - Copy the generated UUIDs and insert the two corresponding rows into `public.profiles`, following the example in section 9 (`BOOTSTRAP dei due profili`) at the end of the SQL script.
4. Retrieve the project's **URL** and **anon key** from **Project Settings → API**: you'll need them in the next step.

### 3. Environment variables

Create a `.env.local` file in the project root (ignored by Git) with the following variables. Each one is documented in detail in [`docs/wiki/06-configuration.md`](docs/wiki/06-configuration.md).

```bash
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-project-anon-key>

# Google Gemini — AI assistant (route /api/assistant)
GEMINI_API_KEY=<your-google-ai-studio-api-key>
# Optional — default: gemini-flash-lite-latest
GEMINI_MODEL=gemini-flash-lite-latest

# Telegram — optional: group notifications and in-chat assistant
# Full walkthrough: docs/telegram-setup.md
TELEGRAM_BOT_TOKEN=<token-from-botfather>
TELEGRAM_CHAT_ID=<group-chat-id>
TELEGRAM_WEBHOOK_SECRET=<random-string>
TELEGRAM_BOT_USERNAME=<bot-username-without-@>
SUPABASE_SERVICE_ROLE_KEY=<your-project-service-role-key>
NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app
```

| Variable | Required | Scope | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | API endpoint of the Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase public "anon" key, enables RLS |
| `GEMINI_API_KEY` | Yes | Server (secret) | Credential for calls to the Google Gemini API |
| `GEMINI_MODEL` | No | Server | Gemini model to use (fallback: `gemini-flash-lite-latest`) |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Server (secret) | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | For Telegram | Server | Id of the group the bot posts to |
| `TELEGRAM_WEBHOOK_SECRET` | For Telegram | Server (secret) | Shared secret verifying that updates really come from Telegram |
| `TELEGRAM_BOT_USERNAME` | Recommended | Server | Bot username without `@`, used to detect mentions |
| `TELEGRAM_REPLY_MODE` | No | Server | `mention` (default) or `all` — when the bot replies in the group |
| `SUPABASE_SERVICE_ROLE_KEY` | For Telegram | Server (secret) | Lets the webhook read/write without a user session (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Client + Server | Public app URL, used for links inside Telegram messages |

Leaving the Telegram variables unset simply keeps the integration off: the app behaves exactly as before.

### 4. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`: sign in with one of the two accounts created in step 2.

## Available scripts

```bash
npm run dev     # development server (Turbopack)
npm run build   # production build
npm run start   # start the production build
npm run lint    # lint the code (ESLint)

npm run telegram:setup -- set https://<your-app>.vercel.app   # register the bot webhook
npm run telegram:setup -- info                                 # inspect webhook status
npm run telegram:setup -- delete                               # remove the webhook
```

## Deployment

The reference deployment target is [Vercel](https://vercel.com):

1. Import the repository into Vercel.
2. Configure the same environment variables from step 3 under **Project Settings → Environment Variables** in Vercel.
3. Deployment runs automatically on every push to the production branch.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for further details.

## Documentation

- [`docs/wiki/00-index.md`](docs/wiki/00-index.md) — Developer Wiki (architecture, models, services, API, patterns) — in Italian
- [`docs/casa_nostra_schema.sql`](docs/casa_nostra_schema.sql) — applied Supabase schema
- [`docs/telegram-setup.md`](docs/telegram-setup.md) — Telegram bot setup (notifications + in-chat assistant)
- [`docs/Casa_Nostra_Requisiti_MVP.docx`](docs/Casa_Nostra_Requisiti_MVP.docx) — full functional requirements — in Italian
- [`AGENTS.md`](AGENTS.md) — project conventions and development briefing — in Italian
