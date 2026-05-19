/**
 * CashClaw Guard - Tool firewall
 * v1.7.0
 *
 * Enforces tool authorization policy:
 *   - allowlist: empty array = allow all; non-empty = deny by default
 *   - denylist: explicit deny entries beat allowlist
 *   - rate_limits: per-tool max_per_minute / max_per_hour
 *
 * Throws ToolDenied or RateLimitExceeded.
 */

import { ToolDenied, RateLimitExceeded } from './exceptions.js';

function nowMs() { return Date.now(); }

export class ToolFirewall {
  constructor({
    allowlist = [],
    denylist = [],
    rateLimits = {},
    now = nowMs,
  } = {}) {
    this.allowlist = new Set(allowlist);
    this.denylist = new Set(denylist);
    this.rateLimits = rateLimits; // { tool: { max_per_minute, max_per_hour } }
    this.now = now;
    // tool -> [timestamps]
    this.history = new Map();
  }

  /**
   * Update policy at runtime (e.g. after YAML hot reload).
   */
  update({ allowlist, denylist, rateLimits } = {}) {
    if (allowlist !== undefined) this.allowlist = new Set(allowlist);
    if (denylist !== undefined) this.denylist = new Set(denylist);
    if (rateLimits !== undefined) this.rateLimits = rateLimits;
  }

  /**
   * Check whether `tool` is allowed to be invoked right now.
   * Throws on denial, records a tick on success.
   * @param {string} tool e.g. "shell", "openai.chat.completions.create"
   * @param {object} ctx { agentId, args }
   * @returns {{ tool, ok: true, currentMinute, currentHour }}
   */
  check(tool, ctx = {}) {
    const agentId = ctx.agentId || 'global';

    // Explicit deny beats anything
    if (this.denylist.has(tool)) {
      throw new ToolDenied({ tool, reason: 'denylist', agentId });
    }

    // If allowlist is non-empty, tool must be in it
    if (this.allowlist.size > 0 && !this.allowlist.has(tool)) {
      throw new ToolDenied({ tool, reason: 'not-in-allowlist', agentId });
    }

    // Rate limits
    const limits = this.rateLimits[tool];
    if (limits) {
      const t = this.now();
      const arr = this.history.get(tool) || [];
      const minuteCutoff = t - 60 * 1000;
      const hourCutoff = t - 60 * 60 * 1000;
      const minuteWindow = arr.filter(x => x > minuteCutoff);
      const hourWindow = arr.filter(x => x > hourCutoff);

      if (limits.max_per_minute && minuteWindow.length >= limits.max_per_minute) {
        throw new RateLimitExceeded({
          tool,
          current: minuteWindow.length,
          max: limits.max_per_minute,
          windowLabel: 'minute',
          agentId,
        });
      }
      if (limits.max_per_hour && hourWindow.length >= limits.max_per_hour) {
        throw new RateLimitExceeded({
          tool,
          current: hourWindow.length,
          max: limits.max_per_hour,
          windowLabel: 'hour',
          agentId,
        });
      }

      hourWindow.push(t);
      this.history.set(tool, hourWindow);
      return { tool, ok: true, currentMinute: minuteWindow.length + 1, currentHour: hourWindow.length };
    }

    return { tool, ok: true, currentMinute: 0, currentHour: 0 };
  }

  reset() {
    this.history.clear();
  }
}

export default ToolFirewall;
