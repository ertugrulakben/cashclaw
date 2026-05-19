/**
 * CashClaw Guard - Exception types
 * v1.7.0
 *
 * Custom error classes that the Guard module throws when a policy
 * boundary is crossed. SDK consumers can catch by class name and
 * react accordingly (logging, alerting, fallbacks).
 */

export class GuardError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GuardError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class BudgetExceeded extends GuardError {
  constructor({ spent, limit, agentId, scope, currency = 'USD' }) {
    super(
      `Budget exceeded: spent ${spent} ${currency}, limit ${limit} ${currency} (scope: ${scope})`,
      'BUDGET_EXCEEDED',
      { spent, limit, agentId, scope, currency }
    );
    this.name = 'BudgetExceeded';
  }
}

export class RecursionKilled extends GuardError {
  constructor({ fingerprint, repeats, windowSeconds, agentId }) {
    super(
      `Recursion kill: fingerprint ${fingerprint} repeated ${repeats} times within ${windowSeconds}s`,
      'RECURSION_KILLED',
      { fingerprint, repeats, windowSeconds, agentId }
    );
    this.name = 'RecursionKilled';
  }
}

export class ToolDenied extends GuardError {
  constructor({ tool, reason, agentId }) {
    super(
      `Tool denied: ${tool} (${reason})`,
      'TOOL_DENIED',
      { tool, reason, agentId }
    );
    this.name = 'ToolDenied';
  }
}

export class RateLimitExceeded extends GuardError {
  constructor({ tool, current, max, windowLabel, agentId }) {
    super(
      `Rate limit: ${tool} ${current}/${max} per ${windowLabel}`,
      'RATE_LIMIT_EXCEEDED',
      { tool, current, max, windowLabel, agentId }
    );
    this.name = 'RateLimitExceeded';
  }
}

export class TokenLimitExceeded extends GuardError {
  constructor({ tokens, limit, agentId }) {
    super(
      `Token limit exceeded: ${tokens} > ${limit}`,
      'TOKEN_LIMIT_EXCEEDED',
      { tokens, limit, agentId }
    );
    this.name = 'TokenLimitExceeded';
  }
}

export default {
  GuardError,
  BudgetExceeded,
  RecursionKilled,
  ToolDenied,
  RateLimitExceeded,
  TokenLimitExceeded,
};
