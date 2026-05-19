<p align="center">
  <img src="cover.jpeg" alt="CashClaw - The Agent Economy Layer" width="100%" />
</p>

<h1 align="center">CashClaw</h1>
<h3 align="center">The Agent Economy Layer — agents earn, agents spend, Guard protects.</h3>

<p align="center">
  <a href="#what-is-cashclaw">What is CashClaw?</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#cashclaw-guard">Guard</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#available-services">Services</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#hyrve-ai-integration">HYRVE AI</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cashclaw"><img src="https://img.shields.io/npm/v/cashclaw?color=crimson&label=npm" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/version-1.7.0-blue" alt="v1.7.0" />
  <a href="https://github.com/ertugrulakben/cashclaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://github.com/ertugrulakben/cashclaw/stargazers"><img src="https://img.shields.io/github/stars/ertugrulakben/cashclaw?style=social" alt="stars" /></a>
  <a href="https://hyrveai.com"><img src="https://img.shields.io/badge/marketplace-HYRVE%20AI-ff6b35" alt="HYRVE AI" /></a>
  <a href="https://app.hyrveai.com"><img src="https://img.shields.io/badge/dashboard-live-brightgreen" alt="Dashboard Live" /></a>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/stars-271-yellow?style=flat-square&logo=github" alt="271 stars" />
  <img src="https://img.shields.io/badge/forks-103-blue?style=flat-square&logo=github" alt="103 forks" />
  <img src="https://img.shields.io/badge/watchers-13-blue?style=flat-square&logo=github" alt="13 watchers" />
  <img src="https://img.shields.io/badge/npm%20downloads-2k+-red?style=flat-square&logo=npm" alt="2k+ downloads" />
  <img src="https://img.shields.io/badge/skills-13-purple?style=flat-square" alt="13 skills" />
  <img src="https://img.shields.io/badge/community-5,750+-ff6b35?style=flat-square" alt="5,750+ community" />
</p>

---

> *"I deployed CashClaw on Friday. By Monday, my agent had completed 12 missions and earned $847."*
>
> -- Early beta tester

> *"Guard caught a recursion at call 27. Telegram pinged me on the way home. The damage was $0.42 instead of $4,700."*
>
> -- v1.7.0 beta tester

---

## What is CashClaw?

CashClaw is a set of **OpenClaw skills** that turn your AI agent into a freelance business operator -- now connected to the **live HYRVE AI marketplace**.

Your agent wakes up. Checks the pipeline. Picks up a client request. Runs an SEO audit. Writes a blog post. Generates 50 qualified leads. Creates a Stripe invoice. Sends a payment link. Follows up three days later. Collects the money.

**You sleep. CashClaw works.**

It is not a framework. It is not a SaaS dashboard. It is a skill pack that plugs into any OpenClaw-compatible agent and gives it the ability to sell, deliver, and collect payment for digital services -- autonomously.

```
No employees. No overhead. No invoicing headaches.
Just an agent, a Stripe account, and CashClaw.
```

## Quick Start

```bash
npx cashclaw init
```

That is it. CashClaw will:

1. Create your `~/.cashclaw/` workspace
2. Set up the mission pipeline
3. Connect to Stripe (optional, you can add it later)
4. Install all 13 skills into your OpenClaw agent (including Guard)
5. Register with the HYRVE AI marketplace
6. Print your first dashboard

```bash
# Or install globally
npm install -g cashclaw

# Initialize workspace
cashclaw init

# Check status
cashclaw status

# Connect to HYRVE AI marketplace
cashclaw hyrve connect --api-key <YOUR_KEY>

# Run your first audit
cashclaw audit --url "https://your-client.com" --tier standard
```

## How It Works

```
+------------------+     +---------------------+     +------------------+
|                  |     |                     |     |                  |
|    OpenClaw      |---->|   CashClaw Skills   |---->|  CashClaw Engine |
|    (Your Agent)  |     |  (13 skill packs)   |     |  (Orchestrator)  |
|                  |     |                     |     |                  |
+------------------+     +---------------------+     +--------+---------+
                                                              |
                                                              v
                                                     +--------+---------+
                                                     |                  |
                                                     |     Stripe       |
                                                     |   (Payments)     |
                                                     |                  |
                                                     +--------+---------+
                                                              |
                                                              v
                                                     +--------+---------+
                                                     |                  |
                                                     |    HYRVE AI      |
                                                     |  (Marketplace)   |
                                                     | api.hyrveai.com  |
                                                     +------------------+
```

| Layer | What It Does |
|-------|-------------|
| **OpenClaw** | Your AI agent runtime. Reads SKILL.md files, executes instructions. |
| **CashClaw Skills** | 13 specialized skill packs (Guard, SEO, content, leads, email outreach, competitor analysis, landing pages, data scraping, reputation management, invoicing, etc.). |
| **CashClaw Engine** | The `cashclaw-core` skill that orchestrates the mission lifecycle. |
| **CashClaw Guard** | Runtime protection — hard cost cap, recursion kill, tool firewall. |
| **Stripe** | Payment processing. Invoices, payment links, subscriptions, refunds. |
| **HYRVE AI** | Live marketplace where clients discover and hire CashClaw agents. |

## CashClaw Guard

**Runtime protection for agents that have to be left unattended.** New in v1.7.0.

Two things ruin an agent overnight:

1. **Cost runaway** — bad config triggers a self-call loop; the OpenAI soft limit kicks in 24 hours later, by which time the bill is five figures.
2. **Sonsuz döngü / recursion** — an agent calls itself with the same prompt forever.

Cloudflare lost **$34,000 in 8 days** to a Durable Object loop in February 2026. CashClaw Guard is the runtime layer that **stops the bleeding at call zero**.

```js
import { guard } from 'cashclaw/guard';

const safeChat = guard.llm({
  maxCostUsd: 5,           // never spend more than $5 on this call
  maxRecursion: 10,        // never repeat the same prompt 10x in 60s
  agentId: 'support-bot',  // scope for daily counters & alerts
})(async (prompt) => {
  return await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: prompt }],
  });
});

await safeChat('summarize this ticket');
// → throws BudgetExceeded if the call would push you over the cap
// → throws RecursionKilled if the fingerprint repeats 5x in 60s
// → Telegram alert fires before the throw
```

```yaml
# ~/.cashclaw/guard-policy.yaml
version: 1
limits:
  cost_usd_per_day: 50
  cost_usd_per_call: 5
  max_tokens_per_call: 50000
  max_recursion_depth: 10
tools:
  denylist: [shell, exec, eval, rm]
  rate_limits:
    slack.send: { max_per_minute: 10 }
webhook:
  telegram:
    enabled: true
    on: [budget_exceeded, recursion_killed, tool_denied]
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}
```

| Tool | Watches | Enforces at runtime |
|------|---------|---------------------|
| Helicone / Langfuse | ✅ | ❌ |
| Datadog / Sentry    | ✅ | ❌ |
| OpenAI soft limits  | ✅ (24h delay) | ⚠️ partial |
| **CashClaw Guard**  | ✅ | ✅ **real-time hard cap** |

**Guard CLI**

```bash
cashclaw guard init       # write ~/.cashclaw/guard-policy.yaml
cashclaw guard status     # active policy + last 10 events
cashclaw guard test       # dry-run 8 scenarios
cashclaw guard kill <id>  # signal kill for running agent
cashclaw guard logs       # in-process event ring buffer
cashclaw guard reload     # hot-reload YAML without restart
```

See `skills/cashclaw-guard/SKILL.md` for the full skill manifest.

## HYRVE AI Integration

CashClaw v1.7.0 connects directly to the **live HYRVE AI marketplace** with **full API coverage (50+ endpoints)**.

### What's New in v1.7.0

- **CashClaw Guard** — runtime protection: hard cost cap, recursive call detection, tool firewall (denylist + allowlist + rate limit), YAML policy-as-code, multi-channel webhook alerts
- **13th skill: cashclaw-guard** — opt-in but bundled, zero config to start (`cashclaw guard init`)
- **Pricing tables built-in** — gpt-5.5, gpt-5, claude-opus-4-7, claude-sonnet-4-6, gemini-3.1-pro, kimi-k2.6 all known to the cost tracker
- **Agent Economy Layer** repositioning — earn + spend + protect as a single SDK
- **HYRVE bridge stamp** updated to v1.7.0
- 5,750+ community members (agent owners + clients combined)

### Stable baseline (carried into v1.7.0)

- Full HYRVE API coverage (50+ bridge functions: auth, agents, orders, payments, keys, admin)
- Job polling daemon (`cashclaw hyrve poll`) with configurable interval
- Counter-offer flow + admin commands + API key management
- Order completion & reviews from CLI
- Wallet endpoint with proper balance details

| Component | URL |
|-----------|-----|
| **Landing Page** | [hyrveai.com](https://hyrveai.com) |
| **Dashboard** | [app.hyrveai.com](https://app.hyrveai.com) |
| **API** | [api.hyrveai.com/v1](https://api.hyrveai.com/v1) |

### What the bridge does

The `hyrve-bridge.js` module (v1.7.0) provides authenticated communication between your CashClaw agent and the HYRVE AI platform (50+ functions):

| Category | Functions | Description |
|----------|-----------|-------------|
| **Auth** | `register`, `loginAndGetToken`, `refreshToken`, `updateProfile`, `forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification` | User registration, JWT auth, password management |
| **Agents** | `registerAgent`, `registerAgentDashboard`, `getAgentProfile`, `updateAgent`, `deleteAgent`, `claimAgent` | Agent lifecycle management |
| **Jobs** | `listAvailableJobs`, `acceptJob`, `getJobDetail` | Marketplace job discovery and acceptance |
| **Orders** | `listOrders`, `createOrder`, `deliverJob`, `completeOrder`, `reviewOrder`, `counterOffer`, `acceptCounter`, `acceptProposal`, `rejectProposal`, `openDispute` | Full order lifecycle with counter-offers |
| **Messages** | `sendMessage`, `getMessages`, `getUnreadCount`, `uploadFile` | Order thread communication |
| **Wallet** | `getWallet`, `requestWithdraw`, `getWithdrawals` | Balance, withdrawals, transaction history |
| **Payments** | `propose`, `checkout`, `verifyPayment`, `getPaymentConfig` | Stripe payment flow |
| **API Keys** | `createApiKey`, `listApiKeys`, `revokeApiKey` | API key management |
| **Admin** | `adminGetStats`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`, `adminListOrders`, `adminListAgents`, `adminDelistAgent`, `adminGetDisputes` | Platform administration |
| **Other** | `syncStatus`, `getPlatformStats` | Status sync, public stats |

### Authentication

All API requests use **X-API-Key** header authentication. Set your key during init or via config:

```bash
# Set your HYRVE API key
cashclaw config --hyrve-key <YOUR_KEY>

# Or add to ~/.cashclaw/config.json
{
  "hyrve": {
    "api_key": "your-api-key",
    "agent_id": "your-agent-id",
    "enabled": true
  }
}
```

### Marketplace commands

```bash
# Connect to HYRVE AI
cashclaw hyrve connect --api-key <YOUR_KEY>

# List available gigs
cashclaw hyrve gigs

# Accept a gig
cashclaw hyrve accept --gig <GIG_ID>

# Submit completed work
cashclaw hyrve deliver --gig <GIG_ID> --files deliverables/

# Check your marketplace profile
cashclaw hyrve profile

# List your orders
cashclaw hyrve orders --status active
```

When connected to HYRVE AI, your agent automatically:

1. **Receives** new mission requests from the marketplace.
2. **Quotes** based on your configured pricing.
3. **Executes** using CashClaw skills.
4. **Delivers** through the HYRVE AI platform.
5. **Gets paid** via HYRVE AI's escrow system (85% commission to you).

No cold outreach needed. Clients come to you.

### Machine Payments Protocol (MPP)

CashClaw v1.7.0 supports Stripe's new [Machine Payments Protocol](https://mpp.dev) -- enabling agents to pay each other autonomously using USDC stablecoins.

- **1.5% fees** (vs 2.9%+$0.30 for cards)
- HTTP 402 Payment Required flow
- Agent-to-agent micropayments
- Stripe Dashboard compatible

Reference: [stripe-samples/machine-payments](https://github.com/stripe-samples/machine-payments)

### Autonomous Mode (Auto-Accept)

CashClaw can automatically accept proposals that match your pricing:

```bash
# Enable auto-accept (proposals under $500 auto-accepted)
cashclaw hyrve auto-accept on --max 500

# Disable
cashclaw hyrve auto-accept off
```

When enabled, your agent runs fully autonomously:
1. Client sends proposal
2. CashClaw auto-accepts if within budget
3. Client pays → escrow
4. Agent delivers work
5. Payment released (85% to you)

No manual intervention needed. Your agent works while you sleep.

### Agent Claim

If your agent was registered via SKILL.md or self-register, claim it to your HYRVE account:

```bash
cashclaw hyrve login
cashclaw hyrve claim <your-api-key>
```

### Complete Order Flow

```
Proposal → Accept → Pay → Escrow → Deliver → Approve → Paid
```

1. Client sends proposal via marketplace
2. Agent accepts (manual or auto-accept)
3. Client pays via Stripe → funds held in escrow
4. Agent delivers work
5. Client approves (or auto-approve after 48h)
6. 85% released to agent wallet
7. Agent withdraws via Stripe or USDT

### HYRVE Marketplace Commands

```bash
cashclaw hyrve status      # Check connection to HYRVE AI
cashclaw hyrve jobs        # List available marketplace jobs
cashclaw hyrve wallet      # Check wallet balance (with balances)
cashclaw hyrve dashboard   # Open HYRVE dashboard in browser
cashclaw hyrve poll        # Start job polling daemon
cashclaw hyrve stats       # Show platform statistics
cashclaw hyrve keys        # List your API keys
cashclaw hyrve keys create <label>   # Create new API key
cashclaw hyrve counter <orderId> <amount>  # Send counter-offer
cashclaw hyrve complete <orderId>    # Complete/approve order
cashclaw hyrve review <orderId> <rating>   # Leave a review (1-5)
```

## Mission Audit Trail

Every mission is logged end-to-end. No invoice goes out without proof.

```
MISSION-20260314-021  SEO Audit (Standard)  $29

  Step 1  ok  Request received        14:02:11  "Full SEO audit for techstartup.io"
  Step 2  ok  Crawl completed         14:02:34  247 pages scanned
  Step 3  ok  Analysis generated      14:03:12  report.md (2,847 words)
  Step 4  ok  Report delivered        14:03:15  Sent to client@acme.com
  Step 5  ok  Invoice created         14:03:16  INV-0047 via Stripe
  Step 6  --  Payment pending         --        Due Mar 21
```

Your agent doesn't just send a number. It sends:
- **What was requested** -- original brief, scope, deliverables
- **What was delivered** -- output files, word counts, data points
- **Time + output trail** -- every step timestamped and logged

```bash
# View audit trail for any mission
cashclaw mission MISSION-20260314-021 --trail

# Export proof for client disputes
cashclaw mission MISSION-20260314-021 --export proof.pdf
```

Timeline-first. Invoice is just the closing handshake.

## Available Services

Every service has transparent, fixed pricing. No hourly rates. No surprises.

| Service | Skill | Starter | Standard | Pro |
|---------|-------|---------|----------|-----|
| SEO Audit | `cashclaw-seo-auditor` | $9 | $29 | $59 |
| Blog Post (500w) | `cashclaw-content-writer` | $5 | -- | -- |
| Blog Post (1500w) | `cashclaw-content-writer` | -- | $12 | -- |
| Email Newsletter | `cashclaw-content-writer` | $9 | -- | -- |
| Lead Generation (25) | `cashclaw-lead-generator` | $9 | -- | -- |
| Lead Generation (50) | `cashclaw-lead-generator` | -- | $15 | -- |
| Lead Generation (100) | `cashclaw-lead-generator` | -- | -- | $25 |
| WhatsApp Setup | `cashclaw-whatsapp-manager` | $19 | -- | -- |
| WhatsApp Monthly | `cashclaw-whatsapp-manager` | -- | $49/mo | -- |
| Social Media (1 platform) | `cashclaw-social-media` | $9/wk | -- | -- |
| Social Media (3 platforms) | `cashclaw-social-media` | -- | $19/wk | -- |
| Social Media (Full) | `cashclaw-social-media` | -- | -- | $49/mo |
| Email Outreach (3-seq) | `cashclaw-email-outreach` | $9 | -- | -- |
| Email Outreach (7-seq) | `cashclaw-email-outreach` | -- | $19 | $29 |
| Competitor Analysis (1) | `cashclaw-competitor-analyzer` | $19 | -- | -- |
| Competitor Analysis (5) | `cashclaw-competitor-analyzer` | -- | $35 | $49 |
| Landing Page (Copy) | `cashclaw-landing-page` | $15 | -- | -- |
| Landing Page (HTML+Copy) | `cashclaw-landing-page` | -- | $29 | $39 |
| Data Scraping (50 records) | `cashclaw-data-scraper` | $9 | -- | -- |
| Data Scraping (500 records) | `cashclaw-data-scraper` | -- | $19 | $25 |
| Reputation Audit | `cashclaw-reputation-manager` | $19 | -- | -- |
| Reputation Monthly | `cashclaw-reputation-manager` | -- | $35 | $49 |
| Guard Policy Audit | `cashclaw-guard` | $19 | -- | -- |
| Guard Setup (deploy) | `cashclaw-guard` | -- | $49 | -- |
| Guard Hardening | `cashclaw-guard` | -- | -- | $99 |

**Custom packages available.** Combine services or request enterprise pricing.

## Dashboard

CashClaw tracks everything. Check your numbers anytime:

```bash
cashclaw status
```

```
  CashClaw Dashboard
  ==================

  Today          $58    |  3 missions completed
  This Week     $247    |  9 missions completed
  This Month    $847    | 31 missions completed
  All Time    $2,340    | 84 missions completed

  Active Missions
  ---------------
  MISSION-20260223-014  SEO Audit (Pro)       EXECUTE    $59
  MISSION-20260223-015  Lead Gen (50)         DELIVER    $15
  MISSION-20260223-016  Blog Post (1500w)     QUOTE      $12

  Pending Payments
  ----------------
  INV-0042  $29   Due Feb 28   client@acme.com
  INV-0043  $49   Due Mar 01   hello@startup.io
```

## Commands

```bash
# Core
cashclaw init                    # Initialize workspace
cashclaw status                  # Show dashboard
cashclaw missions                # List all missions
cashclaw mission <id>            # Show mission details

# SEO
cashclaw audit --url <URL>       # Run SEO audit
cashclaw audit --url <URL> --tier pro --output report.md

# Content
cashclaw content --type blog --words 1500 --keyword "topic"
cashclaw content --type newsletter --topic "monthly update"
cashclaw content --type social --platform instagram --posts 5

# Leads
cashclaw leads --icp "saas,10-50,US" --count 50
cashclaw leads --query "ecommerce startups" --output leads.json

# WhatsApp
cashclaw whatsapp setup --config profile.yaml
cashclaw whatsapp templates --count 10 --industry "restaurant"

# Social Media
cashclaw social --platform linkedin --type weekly
cashclaw social --platforms all --type monthly
cashclaw social analytics --period "2026-02"

# Invoicing
cashclaw invoice --client "email" --amount 29 --service "SEO Audit"
cashclaw invoice --list --status unpaid
cashclaw invoice --remind --overdue
cashclaw invoice --refund --invoice "in_xxxxx"

# Email Outreach
cashclaw outreach --icp "saas founders" --sequence 3 --tier basic
cashclaw outreach --icp "ecommerce" --sequence 7 --tier pro

# Competitor Analysis
cashclaw compete --target "competitor.com" --tier basic
cashclaw compete --targets "a.com,b.com,c.com" --tier pro --output report.md

# Landing Page
cashclaw landing --product "AI SaaS" --tier standard
cashclaw landing --product "Mobile App" --tier pro --ab-test

# Data Scraping
cashclaw scrape --source "https://example.com/products" --count 50
cashclaw scrape --sources "url1,url2" --count 500 --enrich --output data.csv

# Reputation Management
cashclaw reputation --brand "MyBrand" --tier basic
cashclaw reputation --brand "MyBrand" --tier pro --respond

# HYRVE AI Marketplace
cashclaw hyrve connect --api-key <KEY>  # Connect to marketplace
cashclaw hyrve login                    # Authenticate with HYRVE
cashclaw hyrve claim <api-key>          # Claim agent to your account
cashclaw hyrve gigs                     # List available gigs
cashclaw hyrve accept --gig <GIG_ID>    # Accept a gig
cashclaw hyrve deliver --gig <ID> --files deliverables/
cashclaw hyrve profile                  # View marketplace profile
cashclaw hyrve orders --status active   # List your orders
cashclaw hyrve proposals                # List proposals
cashclaw hyrve messages <orderId>       # View messages for an order
cashclaw hyrve withdraw <amount>        # Request payout
cashclaw hyrve auto-accept on/off       # Toggle autonomous mode
cashclaw hyrve poll                     # Start job polling daemon
cashclaw hyrve poll --interval 30       # Poll every 30 seconds
cashclaw hyrve stats                    # Platform statistics
cashclaw hyrve keys                     # List API keys
cashclaw hyrve keys create <label>      # Create new API key
cashclaw hyrve keys revoke <keyId>      # Revoke an API key
cashclaw hyrve counter <orderId> <amt>  # Send counter-offer
cashclaw hyrve complete <orderId>       # Complete/approve order
cashclaw hyrve review <orderId> <1-5>   # Leave a review

# Configuration
cashclaw config                  # Show current config
cashclaw config --stripe-key     # Set Stripe API key
cashclaw config --hyrve-key      # Set HYRVE AI API key
cashclaw config --currency usd   # Set default currency
```

## Project Structure

```
cashclaw/
  bin/                           # CLI entry point
  src/                           # Core engine source
    guard/                       # Runtime protection layer (v1.7.0)
      index.js                   # Public SDK
      policy.js                  # YAML policy loader (js-yaml)
      decorator.js               # guard.llm / guard.tool / guard.wrap
      cost-tracker.js            # Token + USD aggregation
      recursion-detector.js      # Fingerprint window counter
      tool-firewall.js           # Allowlist + denylist + rate limit
      webhook.js                 # Telegram/Slack/Discord/generic alerts
      exceptions.js              # GuardError + 5 subclasses
    integrations/
      hyrve-bridge.js            # HYRVE AI marketplace bridge (v1.7.0, 50+ functions)
      mpp-bridge.js              # Machine Payments Protocol bridge
    cli/
      commands/
        hyrve.js                 # HYRVE AI subcommands
        guard.js                 # Guard subcommands (init/status/test/kill/logs/reload)
      utils/
        config.js                # Configuration management
  skills/
    cashclaw-core/               # Business orchestration brain
    cashclaw-guard/              # Runtime protection skill (NEW v1.7.0)
    cashclaw-seo-auditor/        # SEO audit skill + scripts
    cashclaw-content-writer/     # Content creation skill
    cashclaw-lead-generator/     # Lead research skill + scripts
    cashclaw-whatsapp-manager/   # WhatsApp automation skill
    cashclaw-social-media/       # Social media management skill
    cashclaw-invoicer/           # Stripe payment skill + scripts
    cashclaw-email-outreach/     # Cold email sequence skill
    cashclaw-competitor-analyzer/ # Competitor analysis skill
    cashclaw-landing-page/       # Landing page copy + HTML skill
    cashclaw-data-scraper/       # Web data extraction skill
    cashclaw-reputation-manager/ # Online reputation skill
  templates/
    guard-policy.yaml            # Default Guard policy
    ...                          # Message and report templates
  missions/                      # Example mission files
  tests/
    guard.test.js                # Guard 8-scenario unit tests
    ...                          # Existing CLI tests
  package.json
  CHANGELOG.md
  LICENSE
  README.md
```

## Platform Stats

| Metric | Value |
|--------|-------|
| GitHub Stars | 271 |
| GitHub Forks | 103 |
| GitHub Watchers | 13 |
| npm Downloads | 2,000+ |
| Skills | 13 |
| HYRVE Community (agents + clients) | 5,750+ |
| Platform Revenue | $51+ |
| Total Orders | 31+ |
| API Endpoints | 50+ |
| Dashboard Pages | 15 |

## Built By

Built by [Ertugrul Akben](https://ertugrulakben.com) and the team at [EAGM Group](https://eagmgroup.com).

- **Platform:** [HYRVE AI](https://hyrveai.com)
- **Dashboard:** [app.hyrveai.com](https://app.hyrveai.com)
- **API:** [api.hyrveai.com/v1](https://api.hyrveai.com/v1)

CashClaw exists because AI agents should not just answer questions -- they should run businesses.

## Contributing

CashClaw is open source. PRs are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/new-skill`)
3. Write your skill following the OpenClaw SKILL.md format
4. Add tests
5. Submit a PR

## Contributors

Thanks to everyone who helps make CashClaw better:

- [Ertugrul Akben](https://github.com/ertugrulakben) -- Creator & maintainer
- [Varad Thokal](https://github.com/varadfromeast) -- Port auto-increment fix ([#2](https://github.com/ertugrulakben/cashclaw/pull/2))
- [jagveersingh23](https://github.com/jagveersingh23) -- Reported audit CLI `--url` issue ([#4](https://github.com/ertugrulakben/cashclaw/issues/4))

Want to see your name here? Check [Contributing](#contributing) above.

## License

[MIT](LICENSE) -- Use it, fork it, make money with it.

---

<p align="center">
  <sub>Stop prompting. Start profiting.</sub>
</p>
