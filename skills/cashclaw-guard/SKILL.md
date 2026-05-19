---
name: cashclaw-guard
description: Runtime protection layer for AI agents. Enforces hard cost caps, recursive call detection, and tool firewall to prevent cost runaway and infinite loops. Throws BudgetExceeded / RecursionKilled / ToolDenied exceptions and dispatches Slack/Telegram/Discord alerts.
metadata:
  {
    "openclaw":
      {
        "emoji": "\U0001F6E1",
        "requires": { "bins": ["node"] },
        "install":
          [
            {
              "id": "npm",
              "kind": "node",
              "package": "cashclaw",
              "bins": ["cashclaw"],
              "label": "Install CashClaw via npm"
            }
          ]
      }
  }
---

# CashClaw Guard

Agent runtime protection. **Stop $34K incidents in 12 lines of code.**

When an AI agent runs unattended, two things can break the bank in one night:

1. **Cost runaway** — a misconfigured loop calls the LLM API thousands of times before the soft limit kicks in 24 hours later.
2. **Sonsuz döngü** — agent calls itself, or two agents call each other, with no exit condition.

Cloudflare lost **$34,000 in 8 days** to a Durable Object loop in February 2026. The fix wasn't a smarter agent — it was a runtime layer that says **"no, you've spent enough."**

CashClaw Guard is that layer. It plugs into any OpenClaw-compatible agent and enforces a YAML policy at every LLM call and tool invocation.

## Why this skill?

| Tool | Watches | Enforces |
|------|---------|----------|
| Helicone, Langfuse | ✅ | ❌ |
| Datadog, Sentry    | ✅ | ❌ |
| OpenAI soft limits | ✅ (24h delay) | ⚠️ partial |
| **CashClaw Guard** | ✅ | ✅ **real-time, hard cap** |

## Pricing Tiers

| Tier | Scope | Price | Delivery |
|------|-------|-------|----------|
| Audit | Policy review + recommended config for 1 agent | $19 | 24h |
| Setup | Full deploy: install, YAML policy, webhook hookup, dashboard | $49 | 48h |
| Hardening | Audit + custom rate limits + multi-agent + on-call runbook | $99 | 5d |

## Quick Start

```bash
npm install cashclaw
cashclaw guard init
# edit ~/.cashclaw/guard-policy.yaml
cashclaw guard test
```

## SDK

```js
import { guard } from 'cashclaw/guard';

// Wrap any LLM call
const safeChat = guard.llm({
  maxCostUsd: 5,
  maxTokens: 50000,
  model: 'gpt-5.5',
  agentId: 'support-bot',
})(async (prompt) => {
  return await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: prompt }],
  });
});

await safeChat('summarize this ticket');
// → throws BudgetExceeded if the call would push you over the cap
// → throws RecursionKilled if the same fingerprint repeats 5x in 60s
// → fires Telegram alert before throwing
```

```js
// Tool firewall (called before any shell / api / mcp invocation)
import { guard } from 'cashclaw/guard';

guard.tool('slack.send', { agentId: 'support-bot' });
// throws ToolDenied if slack.send isn't in the allowlist
// throws RateLimitExceeded if rate per minute/hour is hit
```

## CLI

| Command | Purpose |
|---------|---------|
| `cashclaw guard init`    | Write `~/.cashclaw/guard-policy.yaml` from template |
| `cashclaw guard status`  | Show active policy + last 10 events |
| `cashclaw guard test`    | Dry-run 8 scenarios (cost, recursion, deny, rate) |
| `cashclaw guard kill <id>` | Emit kill flag for a running agent |
| `cashclaw guard logs`    | Print recent Guard event ring buffer |
| `cashclaw guard reload`  | Reload YAML policy without restart |

## YAML Policy

```yaml
version: 1
limits:
  cost_usd_per_day: 50
  cost_usd_per_call: 5
  max_tokens_per_call: 50000
  max_recursion_depth: 10
recursion:
  fingerprint_window_seconds: 60
  kill_after_repeats: 5
tools:
  allowlist: []        # empty = allow all not denied
  denylist: [shell, exec, eval, rm, fs.unlink]
  rate_limits:
    slack.send: { max_per_minute: 10 }
    email.send: { max_per_hour: 50 }
webhook:
  telegram:
    enabled: true
    on: [budget_exceeded, recursion_killed, tool_denied]
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}
```

## Exception Types

| Exception | When | Caught by |
|-----------|------|-----------|
| `BudgetExceeded`     | Per-call or daily USD limit | `error.code === 'BUDGET_EXCEEDED'` |
| `TokenLimitExceeded` | Per-call token limit         | `error.code === 'TOKEN_LIMIT_EXCEEDED'` |
| `RecursionKilled`    | Same fingerprint repeats     | `error.code === 'RECURSION_KILLED'` |
| `ToolDenied`         | Tool blocked by policy       | `error.code === 'TOOL_DENIED'` |
| `RateLimitExceeded`  | Tool rate cap                | `error.code === 'RATE_LIMIT_EXCEEDED'` |

## Demo: stop a $4,700 incident

```js
// Agent runs every 5 minutes via Vercel Cron.
// One bad config later: agent calls itself once per second at 02:00.
// Without Guard: by 08:00 your OpenAI bill is $4,700.
// With Guard:

import { guard } from 'cashclaw/guard';
import { guard as G } from 'cashclaw/guard';

const myAgent = guard.llm({
  maxCostUsd: 0.50,        // never spend more than 50¢ per call
  maxRecursion: 5,         // never repeat the same prompt 5x in 60s
  agentId: 'cron-agent',
})(actualAgentLogic);

// 27 calls in, RecursionKilled fires, Telegram alerts your phone,
// the cron is poisoned but only $0.42 has been spent.
```

## Integration with HYRVE AI

When CashClaw Guard catches a `BudgetExceeded` on a HYRVE order, the
order is automatically paused (not delivered) and the client is notified
through the HYRVE message thread. The agent's reputation score is
protected because the platform sees "paused for protection" rather than
"failed delivery."

## License

MIT. Same as the rest of CashClaw.
