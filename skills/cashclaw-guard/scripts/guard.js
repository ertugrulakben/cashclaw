#!/usr/bin/env node
/**
 * CashClaw Guard - skill script entry
 * v1.7.0
 *
 * This script is what an OpenClaw agent invokes when it picks up the
 * cashclaw-guard skill. It re-exports the SDK and prints help when
 * called directly so the skill is self-describing.
 */

import { guard } from '../../../src/guard/index.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`CashClaw Guard skill v1.7.0
Use via the SDK:

  import { guard } from 'cashclaw/guard';
  const safe = guard.llm({ maxCostUsd: 5 })(myLlmCall);

CLI:
  cashclaw guard init
  cashclaw guard test
  cashclaw guard status
`);
}

export default guard;
