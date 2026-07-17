# 🔒 Security Policy — Rescatto

## Supported Versions

| Version | Supported |
|:-------:|:---------:|
| 0.2.x   | ✅ Active development |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

Instead, report them directly to the project maintainer:
- **Email:** Alexander Sandoval (via GitHub)
- **Telegram:** @TorchHermes_bot (RescattoBot)

You should receive a response within 48 hours. If not, please follow up.

## Security Architecture

### Layer 1 — Firestore Rules (Zero Trust)
Every Firestore collection has explicit rules per role. No user can read/write data belonging to another role. Rules are deployed automatically with every deploy.

### Layer 2 — Rate Limiting (Búnker)
All write operations are rate-limited per user. Excessive requests trigger temporary blocks. Rate limits are enforced at the Firestore rules level and the application level.

### Layer 3 — AI Chat Security (5 Layers)
The AI Chat system has 5 security layers:
- **L1 — Input Validation**: Sanitizes HTML, limits length
- **L2 — Role Enforcement**: Admin data only for admins
- **L3 — Rate Limiting**: 10 writes/min per user
- **L4 — Destructive Action Guard**: Confirmation required
- **L5 — Prompt Injection Detection**: 40+ patterns blocked

### Layer 4 — Strike System
- **Strike 1**: User warned, admin notified, audit logged
- **Strike 2**: Account blocked, all admins notified

### Layer 5 — Audit Logs
Every security event is logged with: userId, action, input, pattern matched, timestamp, user agent, location. Logs are immutable and admin-only.

## Security Headers (CSP)

All responses include:
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000` (preload ready)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- `Content-Security-Policy` with strict allowlist

## Known Security Considerations

1. **AI Chat API Key**: `VITE_DEEPSEEK_API_KEY` is exposed client-side (required by DeepSeek's frontend SDK). The key only authorizes chat completions. Rotate keys monthly.
2. **Wompi Webhook**: Signed with HMAC using `WOMPI_INTEGRITY_KEY`. Verify signature before processing.
3. **FCM Tokens**: Stored per user. Use only for push notifications. Rotate on re-auth.

## Dependencies Security

Dependencies are audited via `npm audit` and Dependabot. Known vulnerabilities are patched immediately. See `.github/dependabot.yml` for auto-update config.
