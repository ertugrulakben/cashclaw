/**
 * CashClaw Guard unit tests
 * v1.7.0
 *
 * Run with: node --test tests/guard.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Policy } from '../src/guard/policy.js';
import { CostTracker } from '../src/guard/cost-tracker.js';
import { RecursionDetector } from '../src/guard/recursion-detector.js';
import { ToolFirewall } from '../src/guard/tool-firewall.js';
import { WebhookDispatcher } from '../src/guard/webhook.js';
import { llm, tool, wrap, GuardRuntime, setRuntime, resetRuntime } from '../src/guard/decorator.js';
const guard = { llm, tool, wrap };
import {
  BudgetExceeded,
  RecursionKilled,
  ToolDenied,
  RateLimitExceeded,
} from '../src/guard/exceptions.js';

// ---------------------------------------------------------------------
// 1. Per-call cost cap fires BudgetExceeded
// ---------------------------------------------------------------------
test('cost cap fires BudgetExceeded when call exceeds per-call limit', async () => {
  const rt = new GuardRuntime({ policy: Policy.default() });
  setRuntime(rt);
  const fn = guard.llm({
    maxCostUsd: 0.01,
    maxTokens: 5_000_000, // big enough that cost cap hits first, not token cap
    model: 'gpt-5.5',
    agentId: 'a',
  })(async () => ({ usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 } }));

  await assert.rejects(() => fn('big call'), (err) => {
    return err instanceof BudgetExceeded && err.code === 'BUDGET_EXCEEDED';
  });
  resetRuntime();
});

// ---------------------------------------------------------------------
// 2. Recursion: same fingerprint 5x in window kills
// ---------------------------------------------------------------------
test('recursion kills after kill_after_repeats hits', async () => {
  const policy = Policy.default();
  policy.data.recursion.kill_after_repeats = 3;
  const rt = new GuardRuntime({ policy });
  setRuntime(rt);

  const fn = guard.llm({ label: 'same', scope: 'rec', model: 'gpt-5-mini' })(
    async () => ({ usage: { prompt_tokens: 1, completion_tokens: 1 } })
  );

  await fn('the-same-prompt');
  await fn('the-same-prompt');
  await assert.rejects(() => fn('the-same-prompt'), (err) => err instanceof RecursionKilled);
  resetRuntime();
});

// ---------------------------------------------------------------------
// 3. Tool denylist
// ---------------------------------------------------------------------
test('tool firewall denies shell when on denylist', () => {
  const fw = new ToolFirewall({ denylist: ['shell'] });
  assert.throws(() => fw.check('shell', { agentId: 'a' }), ToolDenied);
});

// ---------------------------------------------------------------------
// 4. Tool allowlist enforcement
// ---------------------------------------------------------------------
test('tool firewall denies anything outside allowlist when allowlist set', () => {
  const fw = new ToolFirewall({ allowlist: ['openai.chat.completions.create'] });
  assert.throws(() => fw.check('weather.api', { agentId: 'a' }), ToolDenied);
  assert.doesNotThrow(() => fw.check('openai.chat.completions.create', { agentId: 'a' }));
});

// ---------------------------------------------------------------------
// 5. Rate limit per minute
// ---------------------------------------------------------------------
test('rate limit fires after threshold within a minute', () => {
  let t = 1_700_000_000_000;
  const fw = new ToolFirewall({
    rateLimits: { 'slack.send': { max_per_minute: 2 } },
    now: () => t,
  });
  fw.check('slack.send', { agentId: 'a' });
  fw.check('slack.send', { agentId: 'a' });
  assert.throws(() => fw.check('slack.send', { agentId: 'a' }), RateLimitExceeded);
});

// ---------------------------------------------------------------------
// 6. Webhook dispatch fires on subscribed type only
// ---------------------------------------------------------------------
test('webhook dispatch routes by type subscription', async () => {
  let posted = null;
  const wd = new WebhookDispatcher({
    config: {
      telegram: {
        enabled: true,
        on: ['budget_exceeded'],
        bot_token: 'TOK', chat_id: 'CHAT',
      },
    },
    fetchFn: async (url, opts) => {
      posted = { url, body: JSON.parse(opts.body) };
      return { ok: true, status: 200 };
    },
  });
  await wd.dispatch({
    type: 'budget_exceeded',
    error: { message: 'over', details: {} },
    scope: 's',
    agentId: 'a',
  });
  assert.ok(posted);
  assert.ok(posted.url.includes('api.telegram.org'));
  assert.equal(posted.body.chat_id, 'CHAT');

  // Type not subscribed → no post
  posted = null;
  await wd.dispatch({
    type: 'recursion_killed',
    error: { message: 'rec' },
    scope: 's',
    agentId: 'a',
  });
  assert.equal(posted, null);
});

// ---------------------------------------------------------------------
// 7. YAML policy parse round-trips
// ---------------------------------------------------------------------
test('YAML policy parse + override defaults', () => {
  const yamlText = `
version: 1
limits:
  cost_usd_per_day: 7
  cost_usd_per_call: 0.5
tools:
  denylist: [rm]
`;
  const p = Policy.fromYaml(yamlText);
  assert.equal(p.limits.cost_usd_per_day, 7);
  assert.equal(p.limits.cost_usd_per_call, 0.5);
  assert.equal(p.limits.max_tokens_per_call, 50000); // default preserved
  assert.deepEqual(p.tools.denylist, ['rm']);
});

// ---------------------------------------------------------------------
// 8. Cost tracker daily aggregation + reset
// ---------------------------------------------------------------------
test('cost tracker aggregates per scope and uses pricing fallback', () => {
  const ct = new CostTracker();
  const a = ct.record({
    scope: 'agent-1',
    usage: { model: 'gpt-5.5', inputTokens: 1_000_000, outputTokens: 0 },
    limits: { costUsdPerDay: 1000, costUsdPerCall: 1000 },
  });
  assert.ok(a.usd > 0, 'usd should be positive');
  const b = ct.record({
    scope: 'agent-1',
    usage: { model: 'unknown-xyz', inputTokens: 1_000_000, outputTokens: 0 },
    limits: { costUsdPerDay: 1000, costUsdPerCall: 1000 },
  });
  // unknown model -> default pricing kicks in (input=2.00 per 1M)
  assert.equal(b.usd, 2.0);

  // Reset clears state
  ct.reset();
  assert.deepEqual(ct.counters, {});
});
