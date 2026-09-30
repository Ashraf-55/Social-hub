# Deployment

## Frontend/Backend

Next.js app → Vercel (recommended) or any Node.js host that supports the
Next.js runtime (e.g. a container running `npm run build && npm start`).

## Database

Use a managed PostgreSQL (e.g. Supabase, Neon, RDS, Railway) — do not point
production at the `postgres` service in `docker-compose.yml`, which is for
local/dev convenience only. Run migrations against it:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

## n8n

Use n8n Cloud, or self-host (the `docker-compose.yml` service is a valid
starting point — put it behind HTTPS and change the default basic-auth
credentials before exposing it).

## Environment variables

Set every variable from `.env.example` in your hosting platform's secret
manager (Vercel Project Settings → Environment Variables, etc.). Never
commit real values.

## Before going live checklist

- [ ] `APP_MODE=live`
- [ ] Real PostgreSQL `DATABASE_URL`, migrations applied
- [ ] `AUTH_SECRET` set to a long random value (not the dev default)
- [ ] Meta App credentials + webhook URLs pointed at your production domain
- [ ] WhatsApp/Messenger/Instagram tokens are System User / long-lived
      tokens, not short-lived test tokens
- [ ] TikTok adapter completed against confirmed docs, or left disabled
- [ ] Rate limiting added in front of `/api/webhooks/*` (see SECURITY.md)
- [ ] `npm run build` passes with no errors in CI
