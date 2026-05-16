# Patient Email Automation

Automates patient email replies using **Next.js**, **Resend** (inbound + outbound), **OpenAI**, and **Supabase** (read-only clinical data).

## Features

- **Appointment lane**: Match sender email → verify name → confirm DOB → return next appointment time
- **Location lane**: Return public clinic locations; nearest match from patient’s place/zip hint
- **SOAP note lane**: Full verification before returning summary from DB (never invented by AI)
- **Dashboard**: Password-protected thread list and conversation log (read-only)

Clinical tables are **never written** by this app. Only `email_*` operational tables are inserted/updated.

## Quick start

### 1. Install

```bash
cd patient-email-automation
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables)).

### 2. Supabase migration

In the Supabase SQL editor, run (in order):

1. [`supabase/migrations/001_email_automation.sql`](supabase/migrations/001_email_automation.sql)
2. [`supabase/migrations/002_email_rls_policies.sql`](supabase/migrations/002_email_rls_policies.sql)

### 3. Schema map

Edit [`lib/supabase/schema-map.ts`](lib/supabase/schema-map.ts) so table and column names match your database.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 (login with `DASHBOARD_PASSWORD`).

### 5. Resend inbound webhook

1. Resend Dashboard → **Domains** → enable receiving on your domain (MX records).
2. **Webhooks** → Add endpoint:
   - URL: `https://<your-app>/api/webhooks/resend`
   - Event: `email.received`
3. Copy the signing secret → `RESEND_WEBHOOK_SECRET` in env.
4. Set `RESEND_FROM_EMAIL` to the same address patients email (e.g. `patients@yourclinic.com`).

For local testing, use [ngrok](https://ngrok.com/) or Resend’s CLI to forward webhooks to `http://localhost:3000/api/webhooks/resend`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret from webhook |
| `RESEND_FROM_EMAIL` | From address for replies |
| `OPENAI_API_KEY` | OpenAI API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (Settings → API) |
| `DASHBOARD_PASSWORD` | Dashboard login password |
| `NEXT_PUBLIC_APP_URL` | Public app URL |
| `APP_TIMEZONE` | Optional, e.g. `America/New_York` |
| `EMAIL_USE_QUEUE` | Optional `true` to queue processing |
| `CRON_SECRET` | Optional Bearer token for `/api/cron/process-queue` |

## Deploy (Railway)

1. Push this repo to GitHub (if not already).
2. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub** → select this repo.
3. **Variables** — copy every key from `.env.example` (use production values). Set:
   - `NEXT_PUBLIC_APP_URL` = your Railway URL (e.g. `https://your-app.up.railway.app`) or custom domain
   - `SEED_SAMPLE_LOGS=false`
4. **Settings → Networking → Generate domain** (or add a custom domain).
5. Redeploy after setting `NEXT_PUBLIC_APP_URL` to match the public URL.
6. **Resend → Webhooks** → URL: `https://<your-railway-domain>/api/webhooks/resend`, event `email.received`.
7. No tunnel needed in production — webhooks hit Railway directly.

## Deploy (Vercel)

1. Import repo → set all env vars from `.env.example`.
2. Deploy. Note production URL.
3. Update Resend webhook URL to `https://<vercel-app>/api/webhooks/resend`.
4. Optional: Vercel Cron hitting `/api/cron/process-queue` with `Authorization: Bearer <CRON_SECRET>` when `EMAIL_USE_QUEUE=true`.

## Smoke test checklist

- [ ] Migration applied; `email_threads` exists in Supabase
- [ ] `schema-map.ts` matches your `patients`, `appointments`, `locations`, `soap_notes` tables
- [ ] Patient row exists with email matching test sender
- [ ] Send email to `RESEND_FROM_EMAIL` from that patient address
- [ ] Webhook returns 200; thread appears on dashboard
- [ ] Auto-reply received (may ask for name/DOB first)
- [ ] Reply with DOB → appointment time returned (if appointment exists)
- [ ] Ask “hours and address” → public locations returned
- [ ] Ask for SOAP note after verification → DB summary or “call clinic” message
- [ ] Unknown sender email → generic help, no PHI leaked

## Architecture

```
Patient → Resend inbound → POST /api/webhooks/resend
  → fetch full email (Receiving API)
  → log thread + message (Supabase email_*)
  → OpenAI classify + Supabase read clinical data
  → OpenAI draft reply from facts only
  → Resend send reply
```

## Security notes

- PHI (appointments, SOAP) requires email + name + DOB verification
- Webhook signatures verified via Svix (`RESEND_WEBHOOK_SECRET`)
- Inbound `resend_email_id` is unique (idempotent)
- Dashboard masks DOB patterns in displayed messages
- Production healthcare may require vendor BAAs (Resend, OpenAI, Vercel)

## License

Private / internal use.
