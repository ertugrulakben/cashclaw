/**
 * CashClaw Guard - Cost tracking
 * v1.7.0
 *
 * Tracks token usage and converts to USD using a pricing table.
 * Holds per-agent/per-scope counters in memory and persists them
 * via the optional `persistFn` callback (typically writes to disk).
 *
 * Daily counters reset at UTC midnight.
 */

import { BudgetExceeded, TokenLimitExceeded } from './exceptions.js';

// USD per 1M tokens. Prices reflect public 2026-05 list rates and are
// editable via policy.pricing override.
export const DEFAULT_PRICING = {
  // OpenAI
  'gpt-5.5':          { input: 5.00,  output: 15.00 },
  'gpt-5.5-pro':      { input: 30.00, output: 90.00 },
  'gpt-5':            { input: 2.50,  output: 10.00 },
  'gpt-5-mini':       { input: 0.30,  output: 1.20 },
  'gpt-5-nano':       { input: 0.10,  output: 0.40 },
  'gpt-4o':           { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':      { input: 0.15,  output: 0.60 },
  // Anthropic
  'claude-opus-4-7':  { input: 15.00, output: 75.00 },
  'claude-opus-4-6':  { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':{ input: 3.00,  output: 15.00 },
  'claude-haiku-4-5': { input: 0.80,  output: 4.00 },
  // Google
  'gemini-3.1-pro':   { input: 1.25,  output: 5.00 },
  'gemini-3-flash':   { input: 0.075, output: 0.30 },
  // Moonshot Kimi
  'kimi-k2.6':        { input: 0.60,  output: 2.50 },
  'kimi-k2.5':        { input: 0.60,  output: 2.50 },
  // Fallback
  'default':          { input: 2.00,  output: 8.00 },
};

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export class CostTracker {
  constructor({ pricing = DEFAULT_PRICING, persistFn = null, now = () => new Date() } = {}) {
    this.pricing = { ...DEFAULT_PRICING, ...pricing };
    this.persistFn = persistFn;
    this.now = now;
    // counters[scope][day] = { usd, tokens, calls }
    this.counters = {};
  }

  _bucket(scope) {
    const day = utcDayKey(this.now());
    if (!this.counters[scope]) this.counters[scope] = {};
    if (!this.counters[scope][day]) {
      this.counters[scope][day] = { usd: 0, tokens: 0, calls: 0 };
    }
    return this.counters[scope][day];
  }

  /**
   * Estimate cost of a single LLM call.
   * @param {object} usage { model, inputTokens, outputTokens }
   * @returns {number} USD
   */
  estimate({ model = 'default', inputTokens = 0, outputTokens = 0 }) {
    const price = this.pricing[model] || this.pricing.default;
    const inUsd = (inputTokens / 1_000_000) * price.input;
    const outUsd = (outputTokens / 1_000_000) * price.output;
    return inUsd + outUsd;
  }

  /**
   * Record an LLM call and enforce caps.
   * Throws BudgetExceeded or TokenLimitExceeded when limits hit.
   * @param {object} opts
   *   - scope: counter key (agentId, workflowId, "global", etc.)
   *   - usage: { model, inputTokens, outputTokens }
   *   - limits: { costUsdPerDay, costUsdPerCall, maxTokensPerCall }
   *   - agentId: for error reporting
   * @returns {{ usd, tokens, scopeTotal }}
   */
  record({ scope, usage, limits = {}, agentId = scope }) {
    const usd = this.estimate(usage);
    const tokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);

    if (limits.maxTokensPerCall && tokens > limits.maxTokensPerCall) {
      throw new TokenLimitExceeded({ tokens, limit: limits.maxTokensPerCall, agentId });
    }
    if (limits.costUsdPerCall && usd > limits.costUsdPerCall) {
      throw new BudgetExceeded({
        spent: usd.toFixed(4),
        limit: limits.costUsdPerCall,
        agentId,
        scope: 'per-call',
      });
    }

    const bucket = this._bucket(scope);
    const projected = bucket.usd + usd;

    if (limits.costUsdPerDay && projected > limits.costUsdPerDay) {
      throw new BudgetExceeded({
        spent: projected.toFixed(4),
        limit: limits.costUsdPerDay,
        agentId,
        scope: `daily:${scope}`,
      });
    }

    bucket.usd = projected;
    bucket.tokens += tokens;
    bucket.calls += 1;

    if (this.persistFn) {
      try { this.persistFn(this.counters); } catch { /* ignore persistence errors */ }
    }

    return { usd, tokens, scopeTotal: bucket };
  }

  /**
   * Get current spend snapshot.
   */
  snapshot(scope) {
    return this._bucket(scope);
  }

  /**
   * Reset all counters (useful for tests).
   */
  reset() {
    this.counters = {};
  }
}

export default CostTracker;
