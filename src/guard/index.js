/**
 * CashClaw Guard - Public entry point
 * v1.7.0
 *
 *   import { guard } from 'cashclaw/guard';
 *   const safe = guard.llm({ maxCostUsd: 5 })(myLlmCall);
 *
 * The module re-exports everything an SDK consumer needs while
 * keeping the surface area tight.
 */

import * as deco from './decorator.js';
import { Policy } from './policy.js';
import { CostTracker, DEFAULT_PRICING } from './cost-tracker.js';
import { RecursionDetector } from './recursion-detector.js';
import { ToolFirewall } from './tool-firewall.js';
import { WebhookDispatcher } from './webhook.js';
import * as errors from './exceptions.js';

export const guard = {
  llm: deco.llm,
  tool: deco.tool,
  wrap: deco.wrap,
  GuardRuntime: deco.GuardRuntime,
  getRuntime: deco.getRuntime,
  setRuntime: deco.setRuntime,
  resetRuntime: deco.resetRuntime,
  Policy,
  CostTracker,
  RecursionDetector,
  ToolFirewall,
  WebhookDispatcher,
  DEFAULT_PRICING,
  errors,
};

export {
  Policy,
  CostTracker,
  DEFAULT_PRICING,
  RecursionDetector,
  ToolFirewall,
  WebhookDispatcher,
  errors,
};
export const {
  BudgetExceeded,
  RecursionKilled,
  ToolDenied,
  RateLimitExceeded,
  TokenLimitExceeded,
  GuardError,
} = errors;

export default guard;
