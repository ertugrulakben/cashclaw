/**
 * CashClaw Guard - Recursion detection
 * v1.7.0
 *
 * Detects runaway loops by fingerprinting each call (model + prompt
 * hash + caller-supplied label). If the same fingerprint repeats more
 * than `killAfterRepeats` times within `fingerprintWindowSeconds`,
 * RecursionKilled is thrown.
 *
 * Pure in-memory; resets on process restart. For multi-process
 * deployments, share state via the optional `store` interface.
 */

import crypto from 'node:crypto';
import { RecursionKilled } from './exceptions.js';

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
}

export class RecursionDetector {
  constructor({
    fingerprintWindowSeconds = 60,
    killAfterRepeats = 5,
    maxRecursionDepth = 10,
    now = () => Date.now(),
  } = {}) {
    this.windowMs = fingerprintWindowSeconds * 1000;
    this.killAfter = killAfterRepeats;
    this.maxDepth = maxRecursionDepth;
    this.now = now;
    // fingerprint -> [timestamps]
    this.history = new Map();
    // callStackId -> depth
    this.stacks = new Map();
  }

  /**
   * Build a stable fingerprint from a call signature.
   * @param {object} sig { model, prompt, label }
   * @returns {string}
   */
  fingerprint(sig = {}) {
    const parts = [
      sig.model || '',
      sig.label || '',
      typeof sig.prompt === 'string'
        ? sha1(sig.prompt)
        : (sig.prompt ? sha1(JSON.stringify(sig.prompt)) : ''),
    ];
    return sha1(parts.join('|'));
  }

  /**
   * Track a call and throw if recursion threshold is exceeded.
   * @param {object} sig signature for fingerprint
   * @param {string} agentId for error reporting
   */
  track(sig, agentId = 'global') {
    const fp = this.fingerprint(sig);
    const now = this.now();
    const cutoff = now - this.windowMs;

    const arr = this.history.get(fp) || [];
    // Drop entries outside the window
    const recent = arr.filter(t => t > cutoff);
    recent.push(now);
    this.history.set(fp, recent);

    if (recent.length >= this.killAfter) {
      throw new RecursionKilled({
        fingerprint: fp,
        repeats: recent.length,
        windowSeconds: this.windowMs / 1000,
        agentId,
      });
    }
    return { fingerprint: fp, repeats: recent.length };
  }

  /**
   * Push/pop call stack tracking for explicit depth enforcement.
   */
  enter(stackId, agentId = 'global') {
    const depth = (this.stacks.get(stackId) || 0) + 1;
    this.stacks.set(stackId, depth);
    if (depth > this.maxDepth) {
      throw new RecursionKilled({
        fingerprint: stackId,
        repeats: depth,
        windowSeconds: 0,
        agentId,
      });
    }
    return depth;
  }

  exit(stackId) {
    const depth = (this.stacks.get(stackId) || 0) - 1;
    if (depth <= 0) this.stacks.delete(stackId);
    else this.stacks.set(stackId, depth);
    return Math.max(0, depth);
  }

  reset() {
    this.history.clear();
    this.stacks.clear();
  }
}

export default RecursionDetector;
