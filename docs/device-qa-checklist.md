# Device QA Checklist (Web + Native Shell)

Use this before promoting a release to production or shipping a Capacitor/Tauri wrapper.

## Automated (Playwright)
```bash
npm run test:e2e -- e2e/device-qa.spec.ts
```

Covers: iPhone SE, iPhone 14 Pro, Pixel 7, iPad Mini — horizontal overflow and sign-in touch targets.

## Manual matrix

| Area | iPhone Safari | Android Chrome | iPad | Desktop |
|------|---------------|----------------|------|---------|
| Sign in / sign up | | | | |
| Creator project hub | | | | |
| Script Writing Studio keyboard | | | | |
| Wallet + escrow actions | | | | |
| PayFast return URL | | | | |
| Video playback (HLS) | | | | |
| File upload (KYC, media) | | | | |
| Modoc chat panel | | | | |

## Native shell specifics
- **Safe areas**: notch/home indicator padding on wallet and bottom nav.
- **Deep links**: `/payments/return`, `/payout-verification` open in-app browser or system browser as designed.
- **Keyboard**: script studio Enter/Tab formatting on mobile soft keyboard.
- **Background**: WebSocket/SSE chat reconnect after app resume.
- **Storage**: large PDF script import (<15MB) without OOM on mid-tier devices.

## Performance budgets (large tool pages)
- First meaningful paint < 3s on 4G
- Pre-production tool route p95 < 8s (`npm run test:load:tools`)
- No layout shift on sidebar collapse (tablet)

## Sign-off
- [ ] Automated device QA green
- [ ] PayFast production smoke green
- [ ] Sentry receiving test event
- [ ] Escrow dispute flow exercised on staging
