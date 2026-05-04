# Payments Launch Checklist

## Credentials and webhooks
- Configure `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET`, `STITCH_API_BASE`, `STITCH_REDIRECT_URL`, and `STITCH_WEBHOOK_SECRET`.
- Set webhook URL to `/api/payments/webhooks/stitch`.
- Verify webhook sends `payment.succeeded` events with `reference`.

## Database and backfills
- Run `npx prisma migrate deploy`.
- Run `npm run db:backfill:wallets`.
- Run `npm run payments:reconcile` and confirm `mismatches=0`.

## Runtime configuration
- Keep `STITCH_PAYOUTS_ENABLED=false` until Stitch payout activation is approved.
- Confirm S3 credentials are set for KYC document upload/signing flows.
- Ensure `NEXTAUTH_SECRET` and production callback URLs are valid.

## Functional smoke tests
- Viewer subscription creates checkout URL and pending payment status.
- Marketplace pay routes create escrow holds after checkout init.
- Admin can view `/admin/payments` and inspect payment/payout/escrow records.
- Funder/non-viewer roles can open `/wallet`; viewers are blocked.

## Risk and monitoring
- Alert on webhook 401/500 rates and payout failures.
- Alert on unreconciled wallets (`payments:reconcile` mismatches > 0).
- Review `GatewayEvent` duplicates and failed processing daily.
