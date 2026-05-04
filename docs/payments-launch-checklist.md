# Payments Launch Checklist

## Credentials and webhooks
- Configure `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET`, `STITCH_API_BASE`, `STITCH_REDIRECT_URL`, and `STITCH_WEBHOOK_SECRET` (Svix signing secret, usually `whsec_...` from Stitch Express webhook registration).
- Register HTTPS webhook URL: `https://<your-domain>/api/payments/webhooks/stitch`.
- Production webhooks are signed with **Svix** (`svix-id`, `svix-timestamp`, `svix-signature` headers). Local scripts may use legacy `x-stitch-signature` HMAC for testing.
- Successful pay-in events must include your **merchant reference** (the `st-...` value we send as `merchantReference`) under `merchantReference` or `reference` in the payload so we can match `GatewayReference`.
- Redirect URL registered in Stitch must match `STITCH_REDIRECT_URL` (or app-built return URLs). After checkout we append `?pr=<paymentRecordId>` for status polling on `/payments/return`.
- Run `npm run payments:stitch:smoke` against test credentials; use `npm run payments:stitch:bootstrap` to register redirect + webhook if needed.

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
