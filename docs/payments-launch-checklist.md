# Payments Launch Checklist

## Credentials and webhooks
- Configure PayFast merchant credentials (`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`) once integration is complete.
- Register HTTPS ITN/webhook URL: `https://<your-domain>/api/payments/webhooks/payfast`.
- Return URL after checkout should land on `/payments/return` with `?pr=<paymentRecordId>` for status polling.

## Database and backfills
- Run `npx prisma migrate deploy`.
- Run `npm run db:backfill:wallets`.
- Run `npm run payments:reconcile` and confirm `mismatches=0`.

## Runtime configuration
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
