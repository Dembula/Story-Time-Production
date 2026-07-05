# Payments Launch Checklist

## Credentials and webhooks
- Configure PayFast: `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`
- Set `PAYMENTS_DEMO_MODE=false` on production
- Set `NEXTAUTH_URL=https://story-time.online`
- ITN notify URL (sent per checkout + can register in PayFast): `https://story-time.online/api/payments/webhooks/payfast`
- Return/cancel URLs are sent per checkout to `https://story-time.online/payments/return`
- Optional cron: `CRON_SECRET` (Vercel Cron Bearer token), `SUBSCRIPTION_BILLING_CRON_TOKEN`

## Production smoke (automated)
```bash
npm run payments:smoke:production
# Optional: PAYFAST_SMOKE_PROBE_NOTIFY=true to POST-probe ITN reachability
```

Checks: gateway mode=payfast, demo off, merchant credentials, passphrase, notify URL origin, checkout signature.

## Manual live charge smoke
1. Run automated smoke above (exit 0).
2. Create a R1 viewer subscription checkout on production with a real card.
3. Confirm ITN webhook updates `PaymentRecord` to `COMPLETED`.
4. Run `npm run payments:reconcile` — confirm `mismatches=0`.
5. Cancel/refund test charge in PayFast dashboard if needed.

## Database and backfills
- Run `npx prisma migrate deploy`.
- Run `npm run db:backfill:wallets`.
- Run `npm run payments:reconcile` and confirm `mismatches=0`.

## Runtime configuration
- Confirm S3 credentials are set for KYC document upload/signing flows.
- Ensure `NEXTAUTH_SECRET` and production callback URLs are valid.
- Set `REDIS_URL` for distributed rate limits across serverless instances.
- Set `SENTRY_DSN` (+ optional `SENTRY_ORG`, `SENTRY_PROJECT`) for error monitoring.

## Functional smoke tests
- Viewer subscription creates checkout URL and pending payment status.
- Marketplace pay routes create escrow holds (`HELD`) after checkout — buyer confirms delivery to release.
- Admin can view `/admin/payments` escrow tab and resolve disputes.
- Funder/non-viewer roles can open `/wallet`; viewers are blocked.
- Scanned screenplay PDFs import via vision OCR when `OPENROUTER_API_KEY` is set.

## E2E and load tests
```bash
npm run test:e2e                    # Playwright golden paths + device QA
npm run test:load:tools             # Large tool page latency (set LOAD_TEST_PROJECT_ID)
```

## Risk and monitoring
- Sentry alerts on unhandled exceptions and API 5xx spikes.
- Alert on webhook 401/500 rates and payout failures.
- Alert on unreconciled wallets (`payments:reconcile` mismatches > 0).
- Review `GatewayEvent` duplicates and failed processing daily.
