'use strict';

import { loadConfig } from '../cli/utils/config.js';

const MPP_SPEC_URL = 'https://mpp.dev';
const STRIPE_MPP_DOCS = 'https://docs.stripe.com/payments/machine';

export class MppBridge {
  constructor(config = null) {
    this.config = config || null;
    this.apiUrl = config?.hyrve?.api_url || 'https://api.hyrveai.com/v1';
    this.apiKey = config?.hyrve?.api_key || null;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'CashClaw/1.6.1' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    return headers;
  }

  async createChallenge(agentId, amountUsd, currency = 'usdc') {
    const res = await fetch(`${this.apiUrl}/payments/mpp/challenge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ agent_id: agentId, amount_usd: amountUsd, currency }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'MPP challenge failed' }));
      throw new Error(err.error?.message || err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async verifyCredential(credential) {
    const res = await fetch(`${this.apiUrl}/payments/mpp/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'MPP verify failed' }));
      throw new Error(err.error?.message || err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getStatus() {
    try {
      const res = await fetch(`${this.apiUrl}/health`, { headers: this.getHeaders() });
      const data = await res.json();
      return {
        connected: res.ok,
        api_status: data.status,
        mpp_enabled: true,
        mpp_spec: MPP_SPEC_URL,
        stripe_docs: STRIPE_MPP_DOCS,
        supported_currencies: ['usdc'],
        supported_networks: ['tempo', 'base', 'solana'],
        fee_rate: '1.5%',
      };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }
}

export default MppBridge;
