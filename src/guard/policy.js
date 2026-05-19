/**
 * CashClaw Guard - YAML policy loader
 * v1.7.0
 *
 * Loads `guard-policy.yaml` from disk (or accepts a parsed object)
 * and exposes a strongly-typed Policy object the other Guard modules
 * read from.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const DEFAULT_POLICY = {
  version: 1,
  limits: {
    cost_usd_per_day: 50,
    cost_usd_per_call: 5,
    max_tokens_per_call: 50000,
    max_recursion_depth: 10,
  },
  recursion: {
    fingerprint_window_seconds: 60,
    kill_after_repeats: 5,
  },
  tools: {
    allowlist: [],
    denylist: ['shell', 'exec', 'eval', 'rm', 'fs.unlink'],
    rate_limits: {
      'slack.send': { max_per_minute: 10 },
      'email.send': { max_per_hour: 50 },
    },
  },
  webhook: {
    telegram: { enabled: false, on: ['budget_exceeded', 'recursion_killed', 'tool_denied'] },
    slack:    { enabled: false, on: ['budget_exceeded', 'recursion_killed'] },
    discord:  { enabled: false, on: ['budget_exceeded'] },
    generic:  { enabled: false, on: [] },
  },
  pricing: {},
};

function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const k of Object.keys(value)) out[k] = deepClone(value[k]);
  return out;
}

function deepMerge(base, over) {
  if (over === null || typeof over !== 'object') {
    return over === undefined ? deepClone(base) : over;
  }
  if (Array.isArray(base) || Array.isArray(over)) {
    return over !== undefined ? deepClone(over) : deepClone(base);
  }
  const out = deepClone(base);
  for (const key of Object.keys(over)) {
    out[key] = key in base ? deepMerge(base[key], over[key]) : deepClone(over[key]);
  }
  return out;
}

export class Policy {
  constructor(raw = {}) {
    this.data = deepMerge(DEFAULT_POLICY, raw || {});
    this.sourcePath = null;
  }

  static fromYaml(yamlString) {
    const parsed = yaml.load(yamlString) || {};
    return new Policy(parsed);
  }

  static fromFile(filePath) {
    const abs = path.resolve(filePath);
    const text = fs.readFileSync(abs, 'utf-8');
    const p = Policy.fromYaml(text);
    p.sourcePath = abs;
    return p;
  }

  static default() {
    return new Policy({});
  }

  get limits()   { return this.data.limits; }
  get tools()    { return this.data.tools; }
  get recursion(){ return this.data.recursion; }
  get webhook()  { return this.data.webhook; }
  get pricing()  { return this.data.pricing; }

  toYaml() {
    return yaml.dump(this.data, { lineWidth: 120, noRefs: true });
  }

  toJSON() {
    return this.data;
  }
}

export default Policy;
