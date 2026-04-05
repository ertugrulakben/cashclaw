'use strict';

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';
import { showMiniBanner } from '../utils/banner.js';
import { listAvailableJobs, listOrders, acceptJob, deliverJob, getAgentProfile, getWallet, loginAndGetToken, acceptProposal, rejectProposal, sendMessage, getMessages, requestWithdraw, claimAgent, getPlatformStats, createApiKey, listApiKeys, revokeApiKey, counterOffer, completeOrder, reviewOrder, getMyAgents } from '../../integrations/hyrve-bridge.js';
import { saveConfig } from '../utils/config.js';
import MppBridge from '../../integrations/mpp-bridge.js';

export function createHyrveCommand() {
  const hyrve = new Command('hyrve')
    .description('HYRVE AI Marketplace commands');

  hyrve
    .command('status')
    .description('Check HYRVE connection status')
    .action(async () => {
      const config = await loadConfig();
      const spinner = ora('Checking HYRVE connection...').start();
      try {
        const mpp = new MppBridge(config);

        const [apiStatus, mppStatus] = await Promise.all([
          fetch(`${config?.hyrve?.api_url || 'https://api.hyrveai.com/v1'}/health`)
            .then(r => r.json()).catch(() => ({ status: 'error' })),
          mpp.getStatus(),
        ]);

        spinner.stop();
        console.log('');
        console.log(chalk.bold('  HYRVE AI Connection Status'));
        console.log(chalk.dim('  ─────────────────────────'));
        console.log(`  API:        ${apiStatus.status === 'ok' ? chalk.green('● Connected') : chalk.red('● Disconnected')}`);
        console.log(`  API URL:    ${chalk.dim(config?.hyrve?.api_url || 'https://api.hyrveai.com/v1')}`);
        console.log(`  Agent ID:   ${config?.hyrve?.agent_id ? chalk.cyan(config.hyrve.agent_id) : chalk.yellow('Not registered')}`);
        console.log(`  API Key:    ${config?.hyrve?.api_key ? chalk.green('● Set') : chalk.yellow('● Not set')}`);
        console.log(`  MPP:        ${mppStatus.connected ? chalk.green('● Available (USDC, 1.5% fee)') : chalk.yellow('● Pending')}`);
        console.log(`  Dashboard:  ${chalk.dim('https://app.hyrveai.com')}`);
        console.log('');
      } catch (err) {
        spinner.fail('Connection check failed: ' + err.message);
      }
    });

  hyrve
    .command('jobs')
    .description('List available jobs on HYRVE marketplace')
    .action(async () => {
      const spinner = ora('Fetching available jobs...').start();
      try {
        const result = await listAvailableJobs();
        spinner.stop();

        if (!result.jobs || result.jobs.length === 0) {
          console.log(chalk.yellow('\n  No matching jobs found.\n'));
          return;
        }

        console.log(chalk.bold(`\n  Available Jobs (${result.jobs.length})\n`));
        for (const job of result.jobs) {
          console.log(`  ${chalk.cyan(job.title)}`);
          console.log(`  ${chalk.dim(job.description?.substring(0, 80))}...`);
          console.log(`  Budget: ${chalk.green('$' + job.budget_usd)} | Category: ${job.category} | ID: ${chalk.dim(job.id)}`);
          console.log('');
        }
      } catch (err) {
        spinner.fail('Failed: ' + err.message);
      }
    });

  hyrve
    .command('wallet')
    .description('Check HYRVE wallet balance')
    .action(async () => {
      const spinner = ora('Fetching wallet...').start();
      try {
        const result = await getWallet();
        spinner.stop();
        console.log(chalk.bold('\n  HYRVE Wallet'));
        console.log(chalk.dim('  ──────────────'));
        if (result.success && result.wallet) {
          const w = result.wallet;
          console.log(`  Available:    ${chalk.green('$' + parseFloat(w.available || 0).toFixed(2))}`);
          console.log(`  Pending:      ${chalk.yellow('$' + parseFloat(w.pending || 0).toFixed(2))}`);
          console.log(`  Total Earned: ${chalk.cyan('$' + parseFloat(w.total_earned || 0).toFixed(2))}`);
          if (result.transactions && result.transactions.length > 0) {
            console.log(chalk.bold('\n  Recent Transactions'));
            console.log(chalk.dim('  ──────────────'));
            for (const tx of result.transactions.slice(0, 5)) {
              const date = new Date(tx.created_at).toLocaleDateString();
              const sign = tx.type === 'credit' ? '+' : '-';
              const color = tx.type === 'credit' ? 'green' : 'red';
              console.log(`  ${chalk.gray(date)}  ${chalk[color](sign + '$' + parseFloat(tx.amount || 0).toFixed(2))}  ${tx.description || tx.type}`);
            }
          }
        } else {
          console.log(`  ${chalk.yellow(result.message || 'Wallet data not available')}`);
        }
        console.log(`\n  Dashboard: ${chalk.cyan('https://app.hyrveai.com/wallet')}`);
        console.log('');
      } catch (err) {
        spinner.fail('Failed: ' + err.message);
      }
    });

  hyrve
    .command('accept <jobId>')
    .description('Accept a job from the HYRVE marketplace')
    .action(async (jobId) => {
      showMiniBanner();
      console.log(chalk.cyan('  Accepting job...'));
      const result = await acceptJob(jobId);
      if (result.success) {
        console.log(chalk.green(`  ✔ Job accepted! Order created.`));
        if (result.order_id) console.log(chalk.gray(`    Order ID: ${result.order_id}`));
      } else {
        console.log(chalk.red(`  ✖ ${result.message}`));
      }
    });

  hyrve
    .command('deliver <orderId>')
    .description('Deliver work for a HYRVE order')
    .option('--url <url>', 'Deliverables URL')
    .option('--summary <text>', 'Delivery summary/notes')
    .action(async (orderId, opts) => {
      showMiniBanner();
      if (!opts.url) {
        console.log(chalk.red('  ✖ --url is required (deliverables link)'));
        return;
      }
      console.log(chalk.cyan('  Delivering work...'));
      const result = await deliverJob(orderId, { deliverables: opts.url, notes: opts.summary || '' });
      if (result.success) {
        console.log(chalk.green(`  ✔ Work delivered! Waiting for client approval.`));
      } else {
        console.log(chalk.red(`  ✖ ${result.message}`));
      }
    });

  hyrve
    .command('profile')
    .description('View your HYRVE marketplace profile')
    .action(async () => {
      showMiniBanner();
      console.log(chalk.cyan('  Fetching profile...'));
      const result = await getAgentProfile();
      if (result.success || result.agent) {
        const a = result.agent || result;
        console.log(`\n  ${chalk.bold(a.name || 'Unknown')}`);
        console.log(`  ${chalk.gray('ID:')} ${a.id || 'N/A'}`);
        console.log(`  ${chalk.gray('Slug:')} ${a.slug || 'N/A'}`);
        console.log(`  ${chalk.gray('Rating:')} ${a.avg_rating || '0'}/5`);
        console.log(`  ${chalk.gray('Jobs:')} ${a.total_jobs || 0} total, ${a.completed_jobs || 0} completed`);
        console.log(`  ${chalk.gray('Earned:')} $${parseFloat(a.total_earned || 0).toFixed(2)}`);
        console.log(`  ${chalk.gray('Online:')} ${a.is_online ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  ${chalk.gray('URL:')} https://app.hyrveai.com/agents/${a.slug}`);
      } else {
        console.log(chalk.red(`  ✖ ${result.message || 'Profile not available'}`));
      }
    });

  hyrve
    .command('orders')
    .description('List your HYRVE marketplace orders')
    .option('--status <status>', 'Filter by status (all/active/completed)', 'all')
    .action(async (opts) => {
      showMiniBanner();
      console.log(chalk.cyan('  Fetching orders...'));
      const result = await listOrders({ status: opts.status });
      const orders = result.orders || result.data || [];
      if (orders.length === 0) {
        console.log(chalk.gray('  No orders found.'));
        return;
      }
      console.log(`\n  ${chalk.bold('HYRVE Orders')} (${orders.length})\n`);
      for (const o of orders) {
        const statusColor = { completed: 'green', escrow: 'yellow', delivered: 'cyan', disputed: 'red' }[o.status] || 'gray';
        console.log(`  ${chalk.gray(o.id?.slice(0, 8) || '?')}  ${o.task_description?.slice(0, 40) || 'Order'}  $${parseFloat(o.amount_usd || 0).toFixed(2)}  ${chalk[statusColor](o.status)}`);
      }
    });

  hyrve
    .command('dashboard')
    .description('Open HYRVE AI dashboard in browser')
    .action(async () => {
      const url = 'https://app.hyrveai.com';
      console.log(chalk.cyan(`\n  Opening ${url}...\n`));
      const { exec } = await import('child_process');
      const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      exec(cmd);
    });

  hyrve
    .command('login')
    .description('Login to HYRVE AI and get JWT token')
    .action(async () => {
      showMiniBanner();
      const { default: inquirer } = await import('inquirer');
      const answers = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email:' },
        { type: 'password', name: 'password', message: 'Password:' },
      ]);
      console.log(chalk.cyan('  Logging in...'));
      const result = await loginAndGetToken(answers.email, answers.password);
      if (result.success) {
        const config = await loadConfig();
        config.hyrve = config.hyrve || {};
        config.hyrve.jwt_token = result.token;
        config.hyrve.refresh_token = result.refresh_token;
        await saveConfig(config);
        console.log(chalk.green('  ✔ Logged in! Token saved.'));

        // Fetch agent profile to populate agent_id if missing
        if (!config.hyrve.agent_id) {
          const spinner = ora('  Fetching agent profile...').start();
          try {
            const agentsResult = await getMyAgents();
            if (agentsResult.success && agentsResult.agents && agentsResult.agents.length > 0) {
              const agent = agentsResult.agents[0];
              config.hyrve.agent_id = agent.id;
              config.hyrve.registered = true;
              if (agent.api_key && !config.hyrve.api_key) {
                config.hyrve.api_key = agent.api_key;
              }
              await saveConfig(config);
              spinner.succeed(`  Agent linked: ${agent.name || agent.id}`);
            } else {
              spinner.info('  No agents found on your account. Register one with "cashclaw init".');
            }
          } catch {
            spinner.info('  Could not fetch agent profile. Run "cashclaw hyrve profile" later.');
          }
        }
      } else {
        console.log(chalk.red('  ✖ ' + result.message));
      }
    });

  hyrve
    .command('claim <apiKey>')
    .description('Claim an agent registered via SKILL.md or self-register')
    .action(async (apiKey) => {
      showMiniBanner();
      console.log(chalk.cyan('  Claiming agent...'));
      const result = await claimAgent(apiKey);
      if (result.success) {
        const config = await loadConfig();
        config.hyrve = config.hyrve || {};
        if (result.agent) {
          config.hyrve.agent_id = result.agent.id || result.agent.agent_id;
          config.hyrve.registered = true;
          if (!config.hyrve.api_key && apiKey) {
            config.hyrve.api_key = apiKey;
          }
          await saveConfig(config);
        }
        console.log(chalk.green('  ✔ Agent claimed! ' + (result.message || '')));
        if (config.hyrve.agent_id) {
          console.log(chalk.gray(`    Agent ID: ${config.hyrve.agent_id}`));
        }
      } else {
        console.log(chalk.red('  ✖ ' + result.message));
      }
    });

  hyrve
    .command('proposals')
    .description('List pending proposals')
    .action(async () => {
      showMiniBanner();
      console.log(chalk.cyan('  Fetching proposals...'));
      const result = await listOrders({ status: 'proposal' });
      const proposals = result.orders || [];
      if (proposals.length === 0) {
        console.log(chalk.gray('  No pending proposals.'));
        return;
      }
      console.log(`\n  ${chalk.bold('Pending Proposals')} (${proposals.length})\n`);
      for (const p of proposals) {
        console.log(`  ${chalk.gray(p.id?.slice(0,8))}  ${(p.task_description || '').slice(0,40)}  $${parseFloat(p.amount_usd || 0).toFixed(2)}  ${chalk.yellow('proposal')}`);
      }
    });

  hyrve
    .command('messages <orderId>')
    .description('View messages for an order')
    .action(async (orderId) => {
      showMiniBanner();
      const result = await getMessages(orderId);
      if (!result.success) {
        console.log(chalk.red('  ✖ ' + result.message));
        return;
      }
      const msgs = result.messages || [];
      if (msgs.length === 0) {
        console.log(chalk.gray('  No messages yet.'));
        return;
      }
      console.log(`\n  ${chalk.bold('Messages')} (${msgs.length})\n`);
      for (const m of msgs) {
        const time = new Date(m.created_at).toLocaleString();
        console.log(`  ${chalk.gray(time)} ${chalk.cyan(m.sender_name || 'Unknown')}: ${m.content}`);
      }
    });

  hyrve
    .command('withdraw <amount>')
    .description('Request withdrawal from HYRVE wallet')
    .option('--method <method>', 'Payment method (stripe/usdt_trc20/usdt_erc20)', 'stripe')
    .action(async (amount, opts) => {
      showMiniBanner();
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 10) {
        console.log(chalk.red('  ✖ Minimum withdrawal is $10'));
        return;
      }
      console.log(chalk.cyan(`  Requesting $${amountNum.toFixed(2)} withdrawal via ${opts.method}...`));
      const result = await requestWithdraw(amountNum, opts.method);
      if (result.success) {
        console.log(chalk.green('  ✔ Withdrawal requested! Processing time: 1-3 business days.'));
      } else {
        console.log(chalk.red('  ✖ ' + result.message));
      }
    });

  hyrve
    .command('auto-accept <state>')
    .description('Enable or disable auto-accept mode (on/off)')
    .option('--max <usd>', 'Maximum auto-accept amount in USD', '500')
    .action(async (state, opts) => {
      showMiniBanner();
      const config = await loadConfig();
      config.hyrve = config.hyrve || {};
      if (state === 'on') {
        config.hyrve.auto_accept = true;
        config.hyrve.auto_accept_max_usd = parseFloat(opts.max) || 500;
        await saveConfig(config);
        console.log(chalk.green(`  ✔ Auto-accept enabled (max $${config.hyrve.auto_accept_max_usd})`));
        console.log(chalk.gray('    Proposals under this amount will be auto-accepted.'));
      } else {
        config.hyrve.auto_accept = false;
        await saveConfig(config);
        console.log(chalk.yellow('  ✔ Auto-accept disabled. You will review proposals manually.'));
      }
    });

  // ─── v1.6.0: New Commands ────────────────────────────────────────────

  hyrve
    .command('poll')
    .description('Start job polling daemon (checks marketplace for new jobs)')
    .option('--interval <seconds>', 'Polling interval in seconds', '60')
    .action(async (opts) => {
      showMiniBanner();
      const { startJobPoller } = await import('../../engine/scheduler.js');
      const intervalMs = (parseInt(opts.interval) || 60) * 1000;
      console.log(chalk.cyan(`  Starting job poller (every ${intervalMs / 1000}s)...`));
      console.log(chalk.gray('  Press Ctrl+C to stop.\n'));
      await startJobPoller(intervalMs);
      // Keep process alive
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n  Stopping poller...'));
        process.exit(0);
      });
    });

  hyrve
    .command('stats')
    .description('Show HYRVE AI platform statistics')
    .action(async () => {
      const spinner = ora('Fetching platform stats...').start();
      try {
        const result = await getPlatformStats();
        spinner.stop();
        if (result.success) {
          const s = result.stats;
          console.log(chalk.bold('\n  HYRVE AI Platform Stats'));
          console.log(chalk.dim('  ───────────────────────'));
          if (typeof s === 'object') {
            for (const [key, value] of Object.entries(s)) {
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              console.log(`  ${chalk.gray(label + ':')}  ${chalk.cyan(String(value))}`);
            }
          } else {
            console.log(`  ${chalk.cyan(JSON.stringify(s, null, 2))}`);
          }
          console.log('');
        } else {
          console.log(chalk.red(`  ${result.message}`));
        }
      } catch (err) {
        spinner.fail('Failed: ' + err.message);
      }
    });

  hyrve
    .command('keys [action] [label]')
    .description('Manage API keys (list, create <label>, revoke <keyId>)')
    .action(async (action, label) => {
      showMiniBanner();
      if (!action || action === 'list') {
        const spinner = ora('Fetching API keys...').start();
        const result = await listApiKeys();
        spinner.stop();
        if (result.success) {
          const keys = result.keys || [];
          if (keys.length === 0) {
            console.log(chalk.gray('  No API keys found.'));
            return;
          }
          console.log(chalk.bold(`\n  API Keys (${keys.length})\n`));
          for (const k of keys) {
            const masked = k.key ? k.key.slice(0, 8) + '...' + k.key.slice(-4) : 'N/A';
            console.log(`  ${chalk.gray(k.id || '?')}  ${chalk.cyan(k.label || 'Unnamed')}  ${chalk.dim(masked)}  ${k.created_at ? chalk.gray(new Date(k.created_at).toLocaleDateString()) : ''}`);
          }
          console.log('');
        } else {
          console.log(chalk.red('  ' + result.message));
        }
      } else if (action === 'create') {
        if (!label) {
          console.log(chalk.red('  Usage: cashclaw hyrve keys create <label>'));
          return;
        }
        console.log(chalk.cyan(`  Creating API key "${label}"...`));
        const result = await createApiKey(label);
        if (result.success) {
          console.log(chalk.green('  API key created!'));
          if (result.key) {
            console.log(chalk.yellow(`  Key: ${result.key}`));
            console.log(chalk.gray('  Save this key -- it will not be shown again.'));
          }
        } else {
          console.log(chalk.red('  ' + result.message));
        }
      } else if (action === 'revoke') {
        if (!label) {
          console.log(chalk.red('  Usage: cashclaw hyrve keys revoke <keyId>'));
          return;
        }
        console.log(chalk.cyan(`  Revoking API key ${label}...`));
        const result = await revokeApiKey(label);
        if (result.success) {
          console.log(chalk.green('  API key revoked.'));
        } else {
          console.log(chalk.red('  ' + result.message));
        }
      } else {
        console.log(chalk.red('  Unknown action. Use: list, create <label>, revoke <keyId>'));
      }
    });

  hyrve
    .command('counter <orderId> <amount> [message]')
    .description('Send a counter-offer for an order')
    .action(async (orderId, amount, message) => {
      showMiniBanner();
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        console.log(chalk.red('  Amount must be a positive number.'));
        return;
      }
      console.log(chalk.cyan(`  Sending counter-offer: $${amountNum.toFixed(2)}...`));
      const result = await counterOffer(orderId, amountNum, message || '');
      if (result.success) {
        console.log(chalk.green(`  Counter-offer sent ($${amountNum.toFixed(2)})`));
      } else {
        console.log(chalk.red('  ' + result.message));
      }
    });

  hyrve
    .command('complete <orderId>')
    .description('Mark an order as completed/approved')
    .action(async (orderId) => {
      showMiniBanner();
      console.log(chalk.cyan('  Completing order...'));
      const result = await completeOrder(orderId);
      if (result.success) {
        console.log(chalk.green('  Order completed! Payment will be released.'));
      } else {
        console.log(chalk.red('  ' + result.message));
      }
    });

  hyrve
    .command('review <orderId> <rating> [comment]')
    .description('Leave a review for a completed order (1-5 stars)')
    .action(async (orderId, rating, comment) => {
      showMiniBanner();
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        console.log(chalk.red('  Rating must be between 1 and 5.'));
        return;
      }
      console.log(chalk.cyan(`  Submitting review (${ratingNum}/5)...`));
      const result = await reviewOrder(orderId, ratingNum, comment || '');
      if (result.success) {
        console.log(chalk.green(`  Review submitted (${ratingNum}/5 stars)`));
      } else {
        console.log(chalk.red('  ' + result.message));
      }
    });

  return hyrve;
}
