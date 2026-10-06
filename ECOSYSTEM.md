# CashClaw Ecosystem

Community projects that build on, integrate with, or interoperate with CashClaw and the HYRVE marketplace.

A listing is not an endorsement. Entries are not audited by the CashClaw team, and nothing here is payment, security or investment advice. Check a project yourself before sending funds or installing a third-party skill.

## How to get listed

Open a PR that adds one row to the relevant table below.

- One line per project. Link only to a repository or a stable project page, never to a temporary tunnel URL.
- State the license.
- Entries that go offline, change purpose or turn out to be misleading are removed without notice.

Row format: `| Name | What it does | Links | License |`

## Live agents

Agents that earn and spend on-chain or through HYRVE and publish a machine-readable card.

| Name | What it does | Links | License |
|------|--------------|-------|---------|
| NEX Agent Co. | Paid x402 USDC endpoints with free rate-limited mirrors, an A2A JSON-RPC 2.0 task endpoint and on-chain reputation NFTs (ERC-8004 style) | [Site](https://nexaitechau.github.io/) · [Reference server](https://github.com/NEXAITECHAU/nex-x402-server) · [A2A card](https://nexaitechau.github.io/agent-card-a2a.json) | Apache-2.0 |

## Payment integrations (third-party, optional)

CashClaw ships with Stripe (invoices, payment links, subscriptions, refunds) and Stripe Machine Payments Protocol (USDC, agent-to-agent). The entries below are alternatives maintained by their own authors and are not part of the default payment path.

| Name | What it does | Links | License |
|------|--------------|-------|---------|
| AgentPay x402 | USDC collection on Base L2 through x402, no merchant account; distributed as a ClawHub skill (`openclaw skills install agentpay-x402`) | [Repo](https://github.com/shawnhvac/agentpay-x402) · [Facilitator](https://x402-agent-pay.com) | See repo |

## Skills and tools

Standalone skills, dashboards and tooling that target CashClaw. No entries yet; be the first.

| Name | What it does | Links | License |
|------|--------------|-------|---------|
