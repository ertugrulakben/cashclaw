# Changelog

All notable changes to CashClaw will be documented in this file.

## [1.3.0] - 2026-03-19

### Added
- Live HYRVE AI marketplace integration (api.hyrveai.com)
- API key authentication (X-API-Key header) for agent-platform communication
- New bridge functions: `deliverJob()`, `getAgentProfile()`, `listOrders()`
- Config fields: `hyrve.api_key`, `hyrve.agent_id`, `hyrve.dashboard_url`, `hyrve.enabled`
- Error response parsing for real API error bodies (JSON and plain text)
- Bridge config validation helper (`checkBridgeConfig`)

### Changed
- `hyrve-bridge.js` now connects to live production API at api.hyrveai.com/v1
- Improved error handling with real API response parsing (`parseErrorResponse`)
- All bridge functions include X-API-Key header when configured
- Updated README with live marketplace links (app.hyrveai.com, api.hyrveai.com)
- Updated README with HYRVE AI Integration section documenting all bridge functions

### Fixed
- Bridge connection timeout handling with better error messages
- Config migration for existing installations (new hyrve fields merge with defaults)

## [1.2.1] - 2026-03-16

### Fixed
- Minor bug fixes and stability improvements

## [1.2.0] - 2026-03-15

### Added
- **5 New Skills** -- Email Outreach ($9-$29), Competitor Analyzer ($19-$49), Landing Page ($15-$39), Data Scraper ($9-$25), Reputation Manager ($19-$49). CashClaw now ships with 12 revenue-generating skills.
- 10 new mission templates for the new skills (basic + pro tiers each).
- Environment variable support: `CASHCLAW_STRIPE_SECRET_KEY` as alternative to config file.
- Corrupted mission file warnings (previously silently skipped).
- Shared version helper (`src/utils/version.js`) for consistent version display.

### Fixed
- **Cancel status log bug** -- Mission cancel audit trail now correctly shows the previous status instead of always logging "was: cancelled".
- **Short ID collision** -- Multiple missions sharing the same ID prefix now show an ambiguous match warning instead of silently picking the first match.
- **Hardcoded versions** -- All hardcoded version strings throughout the codebase now dynamically read from `package.json`.

### Security
- **CORS restriction** -- Dashboard API now restricts CORS to localhost origins. Agents and curl still work (no Origin header = no restriction).
- **Config API protection** -- `POST /api/config` now blocks modification of sensitive keys (`stripe.secret_key`, `stripe.webhook_secret`).
- **Prototype pollution guard** -- Config key traversal (both CLI and API) now rejects `__proto__`, `constructor`, and `prototype` keys.

### Changed
- Default config now includes 10 service types (up from 5).
- Init wizard now offers 10 services for selection.
- Dashboard HTML version updated to v1.2.0 with dynamic version from health API.
- HYRVEai User-Agent header now reads version from package.json.
- Test suite expanded with version, security, and new skill tests.

## [1.1.0] - 2026-03-14

### Added
- **Mission Audit Trail** -- Every mission step is now logged with timestamps. What was requested, what was delivered, and the full output trail. No invoice goes out without proof.
- `cashclaw missions trail <id>` -- View the formatted audit trail for any mission in the terminal.
- `cashclaw missions export <id>` -- Export mission proof as a markdown file for client disputes or record-keeping.
- `GET /api/missions/:id/trail` -- Dashboard API endpoint returning the audit trail as JSON.

### Changed
- Mission objects now include an `audit_trail` array tracking all state changes.
- All mission lifecycle functions (create, start, complete, cancel, step update) log trail entries automatically.
- Dashboard health endpoint now reports version `1.1.0`.
- Updated package description to mention audit trails.

## [1.0.2] - 2026-03-10

### Fixed
- CLI minor fixes and dependency updates.

## [1.0.1] - 2026-03-07

### Fixed
- Init wizard improvements and error handling.

## [1.0.0] - 2026-03-01

### Added
- Initial release with 7 built-in skills.
- Stripe payment integration.
- HYRVEai marketplace support.
- Web dashboard on port 3847.
- Mission lifecycle management.
