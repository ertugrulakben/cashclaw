/**
 * CashClaw Guard - SDK surface
 * v1.7.0
 *
 * Higher-order wrappers used by application code:
 *   - guard.llm({ ... })(fn)   → wraps a single LLM call
 *   - guard.tool(name, args)   → tool firewall check
 *   - guard.wrap(fn, options)  → one-shot inline wrap
 *
 * Each helper uses a shared Guard runtime instance so policy
 * counters are aggregated across the whole process.
 */

import { Policy } from './policy.js';
import { CostTracker } from './cost-tracker.js';
import { RecursionDetector } from './recursion-detector.js';
import { ToolFirewall } from './tool-firewall.js';
import { WebhookDispatcher } from './webhook.js';
import { GuardError } from './exceptions.js';

export class GuardRuntime {
  constructor({ policy = Policy.default(), logger = null } = {}) {
    this.policy = policy;
    this.logger = logger || (() => {});
    this.cost = new CostTracker({ pricing: policy.pricing });
    this.recursion = new RecursionDetector({
      fingerprintWindowSeconds: policy.recursion.fingerprint_window_seconds,
      killAfterRepeats: policy.recursion.kill_after_repeats,
      maxRecursionDepth: policy.limits.max_recursion_depth,
    });
    this.firewall = new ToolFirewall({
      allowlist: policy.tools.allowlist,
      denylist: policy.tools.denylist,
      rateLimits: policy.tools.rate_limits,
    });
    this.webhook = new WebhookDispatcher({ config: policy.webhook, logger });
    this.events = []; // recent events ring buffer
  }

  reloadPolicy(policy) {
    this.policy = policy;
    this.cost.pricing = { ...this.cost.pricing, ...(policy.pricing || {}) };
    this.recursion = new RecursionDetector({
      fingerprintWindowSeconds: policy.recursion.fingerprint_window_seconds,
      killAfterRepeats: policy.recursion.kill_after_repeats,
      maxRecursionDepth: policy.limits.max_recursion_depth,
    });
    this.firewall.update({
      allowlist: policy.tools.allowlist,
      denylist: policy.tools.denylist,
      rateLimits: policy.tools.rate_limits,
    });
    this.webhook.update(policy.webhook);
  }

  _eventTypeFromError(err) {
    if (err?.code === 'BUDGET_EXCEEDED') return 'budget_exceeded';
    if (err?.code === 'TOKEN_LIMIT_EXCEEDED') return 'token_limit_exceeded';
    if (err?.code === 'RECURSION_KILLED') return 'recursion_killed';
    if (err?.code === 'TOOL_DENIED') return 'tool_denied';
    if (err?.code === 'RATE_LIMIT_EXCEEDED') return 'rate_limit_exceeded';
    return 'guard_error';
  }

  async _fireEvent(err, { scope, agentId } = {}) {
    const event = {
      type: this._eventTypeFromError(err),
      error: err instanceof GuardError ? err.toJSON() : { message: err?.message, code: err?.code },
      scope,
      agentId,
      metadata: {},
    };
    this.events.push({ ...event, at: new Date().toISOString() });
    if (this.events.length > 500) this.events.shift();
    try { await this.webhook.dispatch(event); }
    catch (e) { this.logger({ level: 'warn', msg: 'webhook dispatch failed', err: e.message }); }
  }
}

let _defaultRuntime = null;
export function getRuntime() {
  if (!_defaultRuntime) _defaultRuntime = new GuardRuntime();
  return _defaultRuntime;
}
export function setRuntime(rt) { _defaultRuntime = rt; }
export function resetRuntime() { _defaultRuntime = null; }

/**
 * Wrap an LLM-calling function with cost/recursion enforcement.
 *
 * @param {object} opts
 *   - maxCostUsd     hard per-call cost cap (overrides policy.cost_usd_per_call)
 *   - maxTokens      hard per-call token cap
 *   - maxRecursion   max times this signature can repeat in window
 *   - agentId        scope/agent id for counters & alerts
 *   - scope          counter scope (defaults to agentId)
 *   - model          model id for cost estimation
 *   - label          extra fingerprint label
 *   - usageOf        function(result) → { inputTokens, outputTokens, model }
 *   - runtime        explicit GuardRuntime (defaults to module singleton)
 */
export function llm(opts = {}) {
  const rt = opts.runtime || getRuntime();

  return function decorate(fn) {
    return async function guardedLlm(...args) {
      const scope = opts.scope || opts.agentId || 'default';
      const sig = {
        model: opts.model,
        label: opts.label || fn.name || 'llm',
        prompt: args[0],
      };

      try {
        rt.recursion.track(sig, opts.agentId || scope);
      } catch (err) {
        await rt._fireEvent(err, { scope, agentId: opts.agentId });
        throw err;
      }

      const result = await fn(...args);

      // Extract usage. The caller can provide a custom extractor; otherwise
      // we assume the result already exposes `.usage` like OpenAI/Anthropic.
      let usage = { model: opts.model || sig.model, inputTokens: 0, outputTokens: 0 };
      if (typeof opts.usageOf === 'function') {
        usage = { ...usage, ...(opts.usageOf(result) || {}) };
      } else if (result && result.usage) {
        usage.inputTokens  = result.usage.prompt_tokens     || result.usage.input_tokens  || 0;
        usage.outputTokens = result.usage.completion_tokens || result.usage.output_tokens || 0;
        if (result.model) usage.model = result.model;
      }

      const limits = {
        costUsdPerDay:  opts.policy?.limits?.cost_usd_per_day  || rt.policy.limits.cost_usd_per_day,
        costUsdPerCall: opts.maxCostUsd ?? rt.policy.limits.cost_usd_per_call,
        maxTokensPerCall: opts.maxTokens ?? rt.policy.limits.max_tokens_per_call,
      };

      try {
        rt.cost.record({ scope, usage, limits, agentId: opts.agentId || scope });
      } catch (err) {
        await rt._fireEvent(err, { scope, agentId: opts.agentId });
        throw err;
      }

      return result;
    };
  };
}

/**
 * One-shot inline wrap: runs `fn`, records usage, throws if limits crossed.
 * Returns the function result on success.
 */
export async function wrap(fn, opts = {}) {
  const wrapped = llm(opts)(fn);
  return wrapped();
}

/**
 * Check a tool invocation against the firewall.
 * Throws ToolDenied or RateLimitExceeded.
 */
export function tool(name, ctx = {}) {
  const rt = ctx.runtime || getRuntime();
  try {
    return rt.firewall.check(name, ctx);
  } catch (err) {
    rt._fireEvent(err, { scope: ctx.scope, agentId: ctx.agentId });
    throw err;
  }
}

export default { llm, wrap, tool, GuardRuntime, getRuntime, setRuntime, resetRuntime };
