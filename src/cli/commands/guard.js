'use strict';

/**
 * CashClaw Guard - CLI commands
 * v1.7.0
 *
 *   cashclaw guard init        # write guard-policy.yaml
 *   cashclaw guard status      # show active policy + recent events
 *   cashclaw guard test        # dry-run 8 enforcement scenarios
 *   cashclaw guard kill <id>   # signal kill for running agent
 *   cashclaw guard logs        # print recent Guard events
 *   cashclaw guard reload      # reload policy from disk
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from '../utils/config.js';
import { Policy } from '../../guard/policy.js';
import { llm as guardLlm, tool as guardTool, wrap as guardWrap, getRuntime, setRuntime, GuardRuntime } from '../../guard/decorator.js';
import { BudgetExceeded, RecursionKilled, ToolDenied, RateLimitExceeded } from '../../guard/exceptions.js';

const guard = { llm: guardLlm, tool: guardTool, wrap: guardWrap };

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const TEMPLATE_PATH = path.resolve(__dirname, '../../../templates/guard-policy.yaml');
const HOME_POLICY_PATH = path.join(os.homedir(), '.cashclaw', 'guard-policy.yaml');

function header() {
  console.log('');
  console.log(chalk.bold.hex('#7B2CBF')('  CashClaw Guard') + chalk.dim('  v1.7.0'));
  console.log(chalk.dim('  ──────────────────────────────'));
}

export function createGuardCommand() {
  const cmd = new Command('guard')
    .description('Agent runtime protection (cost cap, recursion kill, tool firewall)');

  cmd
    .command('init')
    .description('Create guard-policy.yaml in ~/.cashclaw/')
    .option('--force', 'Overwrite existing policy')
    .option('--path <file>', 'Custom output path', HOME_POLICY_PATH)
    .action(async (opts) => {
      header();
      const out = path.resolve(opts.path);
      const dir = path.dirname(out);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(out) && !opts.force) {
        console.log(chalk.yellow(`  ! Already exists: ${out}`));
        console.log(chalk.dim('    Use --force to overwrite, or --path to write elsewhere.'));
        return;
      }
      if (!fs.existsSync(TEMPLATE_PATH)) {
        console.log(chalk.red(`  ! Template missing: ${TEMPLATE_PATH}`));
        process.exitCode = 1;
        return;
      }
      fs.copyFileSync(TEMPLATE_PATH, out);
      const cfg = (await loadConfig()) || {};
      cfg.guard = { ...(cfg.guard || {}), policy_path: out, enabled: true };
      await saveConfig(cfg);
      console.log(chalk.green(`  ✓ Policy written to ${out}`));
      console.log(chalk.dim('    Edit the YAML and run `cashclaw guard reload`.'));
    });

  cmd
    .command('status')
    .description('Show active policy + recent Guard events')
    .action(async () => {
      header();
      const cfg = await loadConfig();
      const policyPath = cfg?.guard?.policy_path || HOME_POLICY_PATH;
      let policy;
      try {
        policy = fs.existsSync(policyPath) ? Policy.fromFile(policyPath) : Policy.default();
      } catch (err) {
        console.log(chalk.red(`  ! Failed to load policy: ${err.message}`));
        return;
      }

      console.log(`  Policy:           ${policy.sourcePath || chalk.dim('built-in default')}`);
      console.log(`  Cost/day:         ${chalk.cyan('$' + policy.limits.cost_usd_per_day)}`);
      console.log(`  Cost/call:        ${chalk.cyan('$' + policy.limits.cost_usd_per_call)}`);
      console.log(`  Max tokens/call:  ${chalk.cyan(policy.limits.max_tokens_per_call)}`);
      console.log(`  Max recursion:    ${chalk.cyan(policy.limits.max_recursion_depth)}`);
      console.log(`  Tool denylist:    ${chalk.yellow(policy.tools.denylist.join(', ') || 'none')}`);
      console.log(`  Allowlist:        ${policy.tools.allowlist.length === 0 ? chalk.dim('(deny-by-denylist mode)') : chalk.green(policy.tools.allowlist.join(', '))}`);

      const enabled = ['telegram', 'slack', 'discord', 'generic']
        .filter(c => policy.webhook[c]?.enabled);
      console.log(`  Webhooks:         ${enabled.length === 0 ? chalk.dim('none') : chalk.green(enabled.join(', '))}`);

      const rt = getRuntime();
      const events = rt.events.slice(-10);
      console.log('');
      console.log(chalk.bold(`  Recent events (last ${events.length}):`));
      if (events.length === 0) {
        console.log(chalk.dim('    (none yet — Guard is quiet)'));
      } else {
        for (const ev of events) {
          console.log(`    [${chalk.dim(ev.at)}] ${chalk.red(ev.type)}  ${ev.error?.message || ''}`);
        }
      }
    });

  cmd
    .command('test')
    .description('Dry-run 8 enforcement scenarios with mock LLM calls')
    .action(async () => {
      header();
      const policy = Policy.default();
      const rt = new GuardRuntime({ policy });
      setRuntime(rt);

      const scenarios = [
        {
          name: 'Per-call cost cap',
          run: async () => {
            const fn = guard.llm({ maxCostUsd: 0.01, maxTokens: 5_000_000, model: 'gpt-5.5', agentId: 'test-1' })(
              async () => ({ usage: { prompt_tokens: 100_000, completion_tokens: 100_000 } })
            );
            await fn('hello world');
          },
          expect: BudgetExceeded,
        },
        {
          name: 'Daily cost cap',
          run: async () => {
            // Daily cap = $1 baseline, single call cost ~$1.50 via gpt-5-mini
            policy.data.limits.cost_usd_per_day = 1;
            rt.reloadPolicy(policy);
            const fn = guard.llm({ scope: 'daily-test', maxCostUsd: 1000, maxTokens: 5_000_000, model: 'gpt-5-mini' })(
              async () => ({ usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 } })
            );
            await fn('hi');
          },
          expect: BudgetExceeded,
        },
        {
          name: 'Recursion kill',
          run: async () => {
            const fn = guard.llm({ scope: 'rec-test', label: 'echo' })(async (p) => ({ usage: { prompt_tokens: 1, completion_tokens: 1 } }));
            for (let i = 0; i < 10; i++) await fn('same-prompt-same-prompt');
          },
          expect: RecursionKilled,
        },
        {
          name: 'Tool denylist',
          run: async () => { guard.tool('shell', { agentId: 'test-tool', args: { command: 'ls' } }); },
          expect: ToolDenied,
        },
        {
          name: 'Tool allowlist miss',
          run: async () => {
            const p = Policy.default();
            p.data.tools.allowlist = ['openai.chat.completions.create'];
            const rt2 = new GuardRuntime({ policy: p });
            guard.tool('weather.lookup', { runtime: rt2, agentId: 'test-aw' });
          },
          expect: ToolDenied,
        },
        {
          name: 'Rate limit',
          run: async () => {
            const p = Policy.default();
            p.data.tools.rate_limits = { 'slack.send': { max_per_minute: 2 } };
            const rt2 = new GuardRuntime({ policy: p });
            guard.tool('slack.send', { runtime: rt2, agentId: 't' });
            guard.tool('slack.send', { runtime: rt2, agentId: 't' });
            guard.tool('slack.send', { runtime: rt2, agentId: 't' });
          },
          expect: RateLimitExceeded,
        },
        {
          name: 'YAML policy load',
          run: async () => {
            const p = Policy.fromYaml('limits:\n  cost_usd_per_call: 0.001\n');
            if (p.limits.cost_usd_per_call !== 0.001) throw new Error('YAML did not parse');
          },
          expect: null, // should succeed
        },
        {
          name: 'Default pricing fallback',
          run: async () => {
            const fn = guard.llm({ scope: 'pricing-test', maxCostUsd: 100, model: 'unknown-model-xyz' })(
              async () => ({ usage: { prompt_tokens: 1, completion_tokens: 1 }, model: 'unknown-model-xyz' })
            );
            const r = await fn('hi');
            if (!r) throw new Error('no result');
          },
          expect: null,
        },
      ];

      let pass = 0, fail = 0;
      for (const s of scenarios) {
        try {
          await s.run();
          if (s.expect) {
            console.log(`  ${chalk.red('✗')} ${s.name} ${chalk.dim('(expected ' + s.expect.name + ')')}`);
            fail++;
          } else {
            console.log(`  ${chalk.green('✓')} ${s.name}`);
            pass++;
          }
        } catch (err) {
          if (s.expect && err instanceof s.expect) {
            console.log(`  ${chalk.green('✓')} ${s.name} ${chalk.dim('(' + err.name + ')')}`);
            pass++;
          } else {
            console.log(`  ${chalk.red('✗')} ${s.name}: ${err.message}`);
            fail++;
          }
        }
      }

      console.log('');
      console.log(`  ${chalk.bold('Summary:')} ${chalk.green(pass + ' pass')} / ${chalk.red(fail + ' fail')}`);
      if (fail > 0) process.exitCode = 1;
    });

  cmd
    .command('kill <agentId>')
    .description('Emit a kill signal for a running agent (writes flag file)')
    .action((agentId) => {
      header();
      const dir = path.join(os.homedir(), '.cashclaw', 'guard');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const flag = path.join(dir, `kill-${agentId}.flag`);
      fs.writeFileSync(flag, JSON.stringify({ agentId, at: new Date().toISOString() }), 'utf-8');
      console.log(chalk.yellow(`  Kill flag written: ${flag}`));
      console.log(chalk.dim('  Agents check this file at the start of each Guard step.'));
    });

  cmd
    .command('logs')
    .description('Print recent Guard events (in-process ring buffer)')
    .option('--limit <n>', 'How many events to show', '50')
    .action((opts) => {
      header();
      const rt = getRuntime();
      const limit = parseInt(opts.limit, 10) || 50;
      const events = rt.events.slice(-limit);
      if (events.length === 0) {
        console.log(chalk.dim('  (no events recorded in this process)'));
        return;
      }
      for (const ev of events) {
        console.log(`  [${chalk.dim(ev.at)}] ${chalk.red(ev.type)}  scope=${ev.scope || '-'}  ${ev.error?.message || ''}`);
      }
    });

  cmd
    .command('reload')
    .description('Reload the YAML policy from disk into the current runtime')
    .action(async () => {
      header();
      const cfg = await loadConfig();
      const policyPath = cfg?.guard?.policy_path || HOME_POLICY_PATH;
      if (!fs.existsSync(policyPath)) {
        console.log(chalk.red(`  ! No policy at ${policyPath}. Run \`cashclaw guard init\` first.`));
        process.exitCode = 1;
        return;
      }
      const policy = Policy.fromFile(policyPath);
      const rt = getRuntime();
      rt.reloadPolicy(policy);
      console.log(chalk.green('  ✓ Policy reloaded into runtime.'));
    });

  return cmd;
}

export default createGuardCommand;
