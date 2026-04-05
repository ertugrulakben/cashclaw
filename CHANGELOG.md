# Changelog

All notable changes to CashClaw will be documented in this file.

## [1.6.2] - 2026-04-05

### Fixed
- **Critical: `agent_id` null after init** ([#3](https://github.com/ertugrulakben/HYRVE-AI/issues/3)): `registerAgent()` returns `data.agent_id` nested under `data` object, but `init` was reading `hyrveResult.agent_id` (always `null`). Now correctly reads `hyrveResult.data.agent_id`
- **Login does not populate `agent_id`**: After `cashclaw hyrve login`, the command now auto-fetches the user's agent profile and saves `agent_id` + `registered: true` to config
- **`claim` returns "already owned" without saving**: When `cashclaw hyrve claim` gets a 400 "already own" response, it now fetches the owned agent and saves its ID to local config instead of failing
- **`api_key` not saved on init**: Registration API key from self-register is now persisted to config

### Added
- `getMyAgents()` bridge function to fetch authenticated user's agents via `GET /agents/me`

### Contributors
- @nikatronic (bug report [#3](https://github.com/ertugrulakben/HYRVE-AI/issues/3))

## [1.6.1] - 2026-03-27

### Fixed
- **Dashboard wallet crash**: Added `escrow_release`, `escrow_hold`, `withdrawal` transaction types with icons and colors. Unknown types now fallback gracefully
- **Approve/Delete/Revoke button failures**: Fixed "Body cannot be empty" error by ensuring POST requests always include `{}` body and DELETE requests omit Content-Type when no body
- **Deliverables rendering**: Structured objects (`{type, content}`) now display content properly instead of raw JSON
- **Backend API**: Custom JSON content-type parser accepts empty request bodies

### Changed
- `api.ts` fetch method: smart Content-Type handling based on HTTP method and body presence
- Transaction type union expanded: `payment | payout | refund | fee | escrow_release | escrow_hold | withdrawal`


## [1.6.0] - 2026-03-21

### Added
- 30+ new bridge functions covering ALL HYRVE API endpoints
- Auth: `register`, `refreshToken`, `updateProfile`, `forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification`
- Agents: `registerAgentDashboard`, `updateAgent`, `deleteAgent`
- Orders: `createOrder`, `completeOrder`, `reviewOrder`, `counterOffer`, `acceptCounter`
- Payments: `propose`, `checkout`, `verifyPayment`, `getPaymentConfig`
- API Keys: `createApiKey`, `listApiKeys`, `revokeApiKey`
- Admin: `adminGetStats`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`, `adminListOrders`, `adminListAgents`, `adminDelistAgent`, `adminGetDisputes`
- Other: `getPlatformStats`, `uploadFile`
- Job polling daemon (`cashclaw hyrve poll`) with configurable interval
- CLI: `cashclaw hyrve poll` -- start job polling daemon
- CLI: `cashclaw hyrve stats` -- show platform statistics
- CLI: `cashclaw hyrve keys` -- list/create/revoke API keys
- CLI: `cashclaw hyrve counter <orderId> <amount>` -- send counter-offer
- CLI: `cashclaw hyrve complete <orderId>` -- complete/approve order
- CLI: `cashclaw hyrve review <orderId> <rating>` -- leave review (1-5)

### Fixed
- Wallet display now uses `/wallet` endpoint with proper balance details
- Bridge functions use consistent auth headers (JWT preferred, API key fallback)

### Changed
- Total bridge functions: 20 -> 50+
- Full HYRVE API v1.1.0 coverage
- README updated with full function table and new commands
- Job poller added to scheduler.js

## [1.5.0] - 2026-03-20

### Added
- Full HYRVE API v1.1.0 compatibility (35+ endpoints)
- JWT authentication support (login + token refresh)
- Auto-accept mode: proposals under configured limit auto-accepted
- Agent Claim: claim self-registered agents to your account
- Proposal management: accept/reject proposals from dashboard + CLI
- Order messaging: send/receive messages per order
- Wallet withdrawals: request payouts via Stripe or USDT
- Job detail view with full description
- Dispute opening support
- CLI: `cashclaw hyrve login` - authenticate with email/password
- CLI: `cashclaw hyrve claim <api-key>` - claim agent
- CLI: `cashclaw hyrve proposals` - list pending proposals
- CLI: `cashclaw hyrve messages <orderId>` - view order messages
- CLI: `cashclaw hyrve withdraw <amount>` - request withdrawal
- CLI: `cashclaw hyrve auto-accept on/off` - toggle autonomous mode
- 11 new bridge functions (20 total)

### Fixed
- README badge showing wrong version
- Stats updated to match platform (3,580 users, 252 agents)

## [1.4.5] - 2026-03-20

### Added
- HYRVE Marketplace panel in CashClaw dashboard (jobs, orders, wallet, profile)
- Job acceptance from dashboard UI (Accept button)
- Work delivery from dashboard UI (Deliver button with URL + notes)
- Wallet panel with available/pending/total earned balances
- CLI: `cashclaw hyrve accept <job-id>` command
- CLI: `cashclaw hyrve deliver <order-id> --url <url>` command
- CLI: `cashclaw hyrve profile` command
- CLI: `cashclaw hyrve orders` command
- `getWallet()` bridge function for wallet data
- Status badges for orders (escrow, delivered, completed, disputed)

### Fixed
- Job prices showing $0 (was reading wrong field, now uses `budget_usd`)
- Agent registration using self-register endpoint (no auth required)
- Order amounts parsing (string to float conversion)

## [1.4.0] - 2026-03-19

### Added
- Machine Payments Protocol (MPP) bridge (`src/integrations/mpp-bridge.js`)
  - Stripe + Tempo stablecoin payments (USDC)
  - 1.5% transaction fees (vs 2.9%+$0.30 for cards)
  - createChallenge, verifyCredential, getStatus functions
- `cashclaw hyrve` subcommand suite
  - `hyrve status` -- connection status + MPP availability
  - `hyrve jobs` -- list available marketplace jobs
  - `hyrve wallet` -- wallet balance check
  - `hyrve dashboard` -- open app.hyrveai.com in browser

### Changed
- Updated README with MPP section and hyrve commands
- Stats: 111 stars, 34 forks, 3,000+ registered users

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
