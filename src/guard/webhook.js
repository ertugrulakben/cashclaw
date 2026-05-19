/**
 * CashClaw Guard - Webhook dispatcher
 * v1.7.0
 *
 * Sends alerts to Slack / Telegram / Discord / generic POST when
 * Guard fires an event. Pure fetch, no external SDKs.
 *
 * Each handler is best-effort: failures are swallowed and logged
 * through the optional `logger` callback so a webhook outage cannot
 * crash the agent it is supposed to protect.
 */

const DEFAULT_FETCH = globalThis.fetch?.bind(globalThis);

export class WebhookDispatcher {
  constructor({ config = {}, fetchFn = DEFAULT_FETCH, logger = null, timeoutMs = 5000 } = {}) {
    this.config = config; // { telegram: { enabled, on: [], bot_token, chat_id }, slack: {...}, discord: {...}, generic: {...} }
    this.fetch = fetchFn;
    this.logger = logger || (() => {});
    this.timeoutMs = timeoutMs;
  }

  update(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Build a uniform payload from a Guard event.
   * @param {object} event { type, error, scope, agentId, metadata }
   */
  _formatMessage(event) {
    const lines = [
      `[CashClaw Guard] ${event.type.toUpperCase()}`,
      `agent: ${event.agentId || 'n/a'}`,
      `scope: ${event.scope || 'n/a'}`,
    ];
    if (event.error?.message) lines.push(`reason: ${event.error.message}`);
    if (event.error?.details) {
      for (const [k, v] of Object.entries(event.error.details)) {
        lines.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
      }
    }
    lines.push(`time: ${new Date().toISOString()}`);
    return lines.join('\n');
  }

  _shouldFire(channel, type) {
    const ch = this.config[channel];
    if (!ch || !ch.enabled) return false;
    if (!Array.isArray(ch.on) || ch.on.length === 0) return true;
    return ch.on.includes(type);
  }

  async _post(url, body, headers = {}) {
    if (!this.fetch) {
      this.logger({ level: 'warn', msg: 'no fetch available, webhook skipped', url });
      return { ok: false, status: 0 };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      this.logger({ level: 'error', msg: 'webhook failed', url, err: err.message });
      return { ok: false, status: 0, error: err.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async telegram(event) {
    const cfg = this.config.telegram;
    if (!cfg?.bot_token || !cfg?.chat_id) return { ok: false, reason: 'missing-config' };
    const text = this._formatMessage(event);
    return this._post(
      `https://api.telegram.org/bot${cfg.bot_token}/sendMessage`,
      { chat_id: cfg.chat_id, text }
    );
  }

  async slack(event) {
    const cfg = this.config.slack;
    if (!cfg?.webhook_url) return { ok: false, reason: 'missing-config' };
    return this._post(cfg.webhook_url, { text: this._formatMessage(event) });
  }

  async discord(event) {
    const cfg = this.config.discord;
    if (!cfg?.webhook_url) return { ok: false, reason: 'missing-config' };
    return this._post(cfg.webhook_url, { content: this._formatMessage(event) });
  }

  async generic(event) {
    const cfg = this.config.generic;
    if (!cfg?.url) return { ok: false, reason: 'missing-config' };
    return this._post(cfg.url, { event, message: this._formatMessage(event) }, cfg.headers || {});
  }

  /**
   * Dispatch an event to every enabled channel that subscribes to it.
   * @returns {Array<{channel, result}>}
   */
  async dispatch(event) {
    const channels = ['telegram', 'slack', 'discord', 'generic'];
    const out = [];
    for (const ch of channels) {
      if (!this._shouldFire(ch, event.type)) continue;
      const result = await this[ch](event);
      out.push({ channel: ch, result });
    }
    return out;
  }
}

export default WebhookDispatcher;
