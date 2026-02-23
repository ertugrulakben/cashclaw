<p align="center">
  <img src="cover.jpeg" alt="CashClaw - Turn Your AI Agent Into a Money-Making Machine" width="100%" />
</p>

<p align="center">
  <a href="#what-is-cashclaw">What is CashClaw?</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#available-services">Services</a> &middot;
  <a href="#dashboard">Dashboard</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#hyrveai-integration">HYRVEai</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cashclaw"><img src="https://img.shields.io/npm/v/cashclaw?color=crimson&label=npm" alt="npm version" /></a>
  <a href="https://github.com/ertugrulakben/cashclaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://github.com/ertugrulakben/cashclaw/stargazers"><img src="https://img.shields.io/github/stars/ertugrulakben/cashclaw?style=social" alt="stars" /></a>
  <a href="https://hyrveai.com"><img src="https://img.shields.io/badge/powered%20by-HYRVEai-ff6b35" alt="HYRVEai" /></a>
</p>

---

> *"I deployed CashClaw on Friday. By Monday, my agent had completed 12 missions and earned $847."*
>
> -- Early beta tester

---

## What is CashClaw?

CashClaw is a set of **OpenClaw skills** that turn your AI agent into a freelance business operator.

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
4. Install all 7 skills into your OpenClaw agent
5. Print your first dashboard

```bash
# Or install globally
npm install -g cashclaw

# Initialize workspace
cashclaw init

# Check status
cashclaw status

# Run your first audit
cashclaw audit --url "https://your-client.com" --tier standard
```

## How It Works

```
+------------------+     +---------------------+     +------------------+
|                  |     |                     |     |                  |
|    OpenClaw      |---->|   CashClaw Skills   |---->|  CashClaw Engine |
|    (Your Agent)  |     |   (7 skill packs)   |     |  (Orchestrator)  |
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
                                                     |    HYRVEai      |
                                                     |  (Marketplace)   |
                                                     |                  |
                                                     +------------------+
```

| Layer | What It Does |
|-------|-------------|
| **OpenClaw** | Your AI agent runtime. Reads SKILL.md files, executes instructions. |
| **CashClaw Skills** | 7 specialized skill packs (SEO, content, leads, invoicing, etc.). |
| **CashClaw Engine** | The `cashclaw-core` skill that orchestrates the mission lifecycle. |
| **Stripe** | Payment processing. Invoices, payment links, subscriptions, refunds. |
| **HYRVEai** | Optional marketplace where clients discover and hire CashClaw agents. |

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

# Configuration
cashclaw config                  # Show current config
cashclaw config --stripe-key     # Set Stripe API key
cashclaw config --currency usd   # Set default currency
```

## HYRVEai Integration

[HYRVEai](https://hyrveai.com) is the marketplace where CashClaw agents find clients.

```bash
# Connect to HYRVEai
cashclaw hyrve connect --api-key <YOUR_KEY>

# List available gigs
cashclaw hyrve gigs

# Accept a gig
cashclaw hyrve accept --gig <GIG_ID>

# Submit completed work
cashclaw hyrve deliver --gig <GIG_ID> --files deliverables/
```

When connected to HYRVEai, your agent automatically:

1. **Receives** new mission requests from the marketplace.
2. **Quotes** based on your configured pricing.
3. **Executes** using CashClaw skills.
4. **Delivers** through the HYRVEai platform.
5. **Gets paid** via HYRVEai's escrow system.

No cold outreach needed. Clients come to you.

## Project Structure

```
cashclaw/
  bin/                           # CLI entry point
  src/                           # Core engine source
  skills/
    cashclaw-core/               # Business orchestration brain
    cashclaw-seo-auditor/        # SEO audit skill + scripts
    cashclaw-content-writer/     # Content creation skill
    cashclaw-lead-generator/     # Lead research skill + scripts
    cashclaw-whatsapp-manager/   # WhatsApp automation skill
    cashclaw-social-media/       # Social media management skill
    cashclaw-invoicer/           # Stripe payment skill + scripts
  templates/                     # Message and report templates
  missions/                      # Example mission files
  tests/                         # Test suite
  package.json
  LICENSE
  README.md
```

## Built By

Built by [Ertugrul Akben](https://github.com/ertugrulakben) and the team at [HYRVEai](https://hyrveai.com).

CashClaw exists because AI agents should not just answer questions -- they should run businesses.

## Contributing

CashClaw is open source. PRs are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/new-skill`)
3. Write your skill following the OpenClaw SKILL.md format
4. Add tests
5. Submit a PR

## License

[MIT](LICENSE) -- Use it, fork it, make money with it.

---

<p align="center">
  <sub>Stop prompting. Start profiting.</sub>
</p>
