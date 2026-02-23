import { Command } from 'commander';
import chalk from 'chalk';
import { showBanner, showMiniBanner } from './utils/banner.js';
import { loadConfig, saveConfig } from './utils/config.js';
import { runInit } from './commands/init.js';
import { runStatus } from './commands/status.js';
import { runDashboard } from './commands/dashboard.js';
import { listMissions, createMission, startMission, completeMission, cancelMission, getMission } from '../engine/mission-runner.js';
import { getTotal, getMonthly, getWeekly, getToday, getHistory, getByService } from '../engine/earnings-tracker.js';
import { listInstalledSkills, listAvailableSkills, installSkills } from '../integrations/openclaw-bridge.js';
import Table from 'cli-table3';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const orange = chalk.hex('#FF6B35');
const green = chalk.hex('#16C784');
const dim = chalk.dim;

const program = new Command();

program
  .name('cashclaw')
  .description('Turn your OpenClaw AI agent into a freelance business')
  .version(pkg.version, '-v, --version');

// ─── cashclaw init ─────────────────────────────────────────────────────
program
  .command('init')
  .description('Interactive setup wizard to configure your CashClaw agent')
  .action(async () => {
    showBanner();
    await runInit();
  });

// ─── cashclaw status ───────────────────────────────────────────────────
program
  .command('status')
  .description('Show agent status, services, earnings, and skills')
  .action(async () => {
    await runStatus();
  });

// ─── cashclaw dashboard ────────────────────────────────────────────────
program
  .command('dashboard')
  .description('Launch the web dashboard')
  .option('-p, --port <number>', 'Port number', parseInt)
  .option('--no-open', 'Don\'t auto-open browser')
  .action(async (options) => {
    await runDashboard(options);
  });

// ─── cashclaw missions ────────────────────────────────────────────────
const missionsCmd = program
  .command('missions')
  .description('Manage client missions');

missionsCmd
  .command('list')
  .description('List all missions')
  .option('-s, --status <status>', 'Filter by status (created|in_progress|completed|cancelled)')
  .action(async (options) => {
    showMiniBanner();
    const missions = await listMissions(options.status || null);

    if (missions.length === 0) {
      console.log(dim('  No missions found.\n'));
      return;
    }

    const table = new Table({
      head: [dim('ID'), dim('Name'), dim('Status'), dim('Price'), dim('Client'), dim('Created')],
      colWidths: [10, 22, 14, 10, 16, 14],
      style: { head: [] },
    });

    for (const m of missions) {
      const statusColor = {
        created: chalk.blue,
        in_progress: chalk.yellow,
        completed: green,
        cancelled: chalk.red,
        paid: green.bold,
      }[m.status] || dim;

      table.push([
        m.id.slice(0, 8),
        m.name,
        statusColor(m.status),
        `$${m.price_usd}`,
        m.client?.name || '-',
        new Date(m.created_at).toLocaleDateString(),
      ]);
    }

    console.log(table.toString());
    console.log(dim(`\n  Total: ${missions.length} mission(s)\n`));
  });

missionsCmd
  .command('create <template>')
  .description('Create a new mission from a template')
  .option('-c, --client <name>', 'Client name')
  .option('-e, --email <email>', 'Client email')
  .action(async (templateName, options) => {
    showMiniBanner();

    // Load template from missions/ directory
    const templatesDir = path.resolve(__dirname, '../../missions');
    const templateFile = path.join(templatesDir, `${templateName}.json`);

    try {
      const exists = await fs.pathExists(templateFile);
      if (!exists) {
        // List available templates
        const files = await fs.readdir(templatesDir);
        const templates = files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
        console.log(chalk.red(`  Template "${templateName}" not found.\n`));
        console.log(dim('  Available templates:'));
        for (const t of templates) {
          console.log(`    - ${t}`);
        }
        console.log();
        return;
      }

      const template = await fs.readJson(templateFile);
      const mission = await createMission(template, {
        name: options.client || 'Walk-in Client',
        email: options.email || '',
      });

      console.log(green.bold('  Mission created!\n'));
      console.log(`  ${orange('ID:')}      ${mission.id}`);
      console.log(`  ${orange('Name:')}    ${mission.name}`);
      console.log(`  ${orange('Price:')}   $${mission.price_usd}`);
      console.log(`  ${orange('Client:')}  ${mission.client.name}`);
      console.log(`  ${orange('Status:')}  ${mission.status}\n`);
    } catch (err) {
      console.error(chalk.red(`  Error: ${err.message}\n`));
    }
  });

missionsCmd
  .command('start <id>')
  .description('Start a mission')
  .action(async (id) => {
    showMiniBanner();
    try {
      // Support short IDs by finding the full ID
      const fullId = await resolveShortId(id);
      const mission = await startMission(fullId);
      console.log(green(`  Mission "${mission.name}" started.\n`));
    } catch (err) {
      console.error(chalk.red(`  Error: ${err.message}\n`));
    }
  });

missionsCmd
  .command('complete <id>')
  .description('Mark a mission as completed')
  .action(async (id) => {
    showMiniBanner();
    try {
      const fullId = await resolveShortId(id);
      const mission = await completeMission(fullId);
      console.log(green(`  Mission "${mission.name}" completed!\n`));
    } catch (err) {
      console.error(chalk.red(`  Error: ${err.message}\n`));
    }
  });

missionsCmd
  .command('cancel <id>')
  .description('Cancel a mission')
  .action(async (id) => {
    showMiniBanner();
    try {
      const fullId = await resolveShortId(id);
      const mission = await cancelMission(fullId);
      console.log(chalk.yellow(`  Mission "${mission.name}" cancelled.\n`));
    } catch (err) {
      console.error(chalk.red(`  Error: ${err.message}\n`));
    }
  });

missionsCmd
  .command('show <id>')
  .description('Show mission details')
  .action(async (id) => {
    showMiniBanner();
    try {
      const fullId = await resolveShortId(id);
      const mission = await getMission(fullId);
      if (!mission) {
        console.log(chalk.red(`  Mission not found: ${id}\n`));
        return;
      }

      console.log(orange.bold(`  ${mission.name}\n`));
      console.log(`  ${dim('ID:')}        ${mission.id}`);
      console.log(`  ${dim('Template:')}  ${mission.template}`);
      console.log(`  ${dim('Service:')}   ${mission.service_type}`);
      console.log(`  ${dim('Tier:')}      ${mission.tier}`);
      console.log(`  ${dim('Price:')}     $${mission.price_usd}`);
      console.log(`  ${dim('Status:')}    ${mission.status}`);
      console.log(`  ${dim('Client:')}    ${mission.client?.name || '-'} (${mission.client?.email || '-'})`);
      console.log(`  ${dim('Created:')}   ${mission.created_at}`);
      if (mission.started_at) console.log(`  ${dim('Started:')}   ${mission.started_at}`);
      if (mission.completed_at) console.log(`  ${dim('Completed:')} ${mission.completed_at}`);

      if (mission.steps?.length > 0) {
        console.log(`\n  ${dim('Steps:')}`);
        for (const step of mission.steps) {
          const icon = step.status === 'completed' ? green('done') : dim('pending');
          console.log(`    ${step.index + 1}. ${step.description} [${icon}]`);
        }
      }

      if (mission.deliverables?.length > 0) {
        console.log(`\n  ${dim('Deliverables:')}`);
        for (const d of mission.deliverables) {
          console.log(`    - ${d}`);
        }
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`  Error: ${err.message}\n`));
    }
  });

// Default action for missions (no subcommand) = list
missionsCmd.action(async () => {
  showMiniBanner();
  const missions = await listMissions();
  if (missions.length === 0) {
    console.log(dim('  No missions yet. Create one with:\n'));
    console.log(`  ${chalk.bold('cashclaw missions create seo-audit-basic --client "John Doe"')}\n`);
    return;
  }

  const table = new Table({
    head: [dim('ID'), dim('Name'), dim('Status'), dim('Price'), dim('Client')],
    colWidths: [10, 24, 14, 10, 18],
    style: { head: [] },
  });

  for (const m of missions.slice(0, 10)) {
    const statusColor = {
      created: chalk.blue,
      in_progress: chalk.yellow,
      completed: green,
      cancelled: chalk.red,
      paid: green.bold,
    }[m.status] || dim;

    table.push([
      m.id.slice(0, 8),
      m.name,
      statusColor(m.status),
      `$${m.price_usd}`,
      m.client?.name || '-',
    ]);
  }

  console.log(table.toString());
  if (missions.length > 10) {
    console.log(dim(`\n  ... and ${missions.length - 10} more. Use "cashclaw missions list" for all.\n`));
  }
  console.log();
});

// ─── cashclaw earnings ─────────────────────────────────────────────────
program
  .command('earnings')
  .description('Show earnings summary and history')
  .option('-n, --limit <number>', 'Number of recent entries to show', parseInt, 10)
  .action(async (options) => {
    showMiniBanner();

    const config = await loadConfig();
    const currencySymbol = { USD: '$', EUR: '€', GBP: '£', TRY: '₺' }[config.agent?.currency] || '$';

    const [total, monthly, weekly, today, history, byService] = await Promise.all([
      getTotal(),
      getMonthly(),
      getWeekly(),
      getToday(),
      getHistory(options.limit),
      getByService(),
    ]);

    console.log(orange.bold('  Earnings Summary\n'));

    const summaryTable = new Table({
      chars: { top: '', 'top-mid': '', 'top-left': '  ', 'top-right': '',
        bottom: '', 'bottom-mid': '', 'bottom-left': '  ', 'bottom-right': '',
        left: '  ', 'left-mid': '  ', mid: '', 'mid-mid': '',
        right: '', 'right-mid': '', middle: '  ' },
      colWidths: [18, 22],
      style: { 'padding-left': 0, 'padding-right': 0 },
    });

    summaryTable.push(
      [dim('All Time'), green.bold(`${currencySymbol}${total.toFixed(2)}`)],
      [dim('This Month'), `${currencySymbol}${monthly.total.toFixed(2)} (${monthly.count} jobs)`],
      [dim('This Week'), `${currencySymbol}${weekly.total.toFixed(2)} (${weekly.count} jobs)`],
      [dim('Today'), `${currencySymbol}${today.total.toFixed(2)} (${today.count} jobs)`],
    );

    console.log(summaryTable.toString());

    // By service breakdown
    const serviceKeys = Object.keys(byService);
    if (serviceKeys.length > 0) {
      console.log(orange('\n  By Service\n'));
      for (const [svc, data] of Object.entries(byService)) {
        console.log(`  ${dim(svc.padEnd(22))} ${currencySymbol}${data.total.toFixed(2)}  (${data.count} jobs)`);
      }
    }

    // Recent history
    if (history.length > 0) {
      console.log(orange('\n  Recent Earnings\n'));

      const histTable = new Table({
        head: [dim('Date'), dim('Service'), dim('Amount'), dim('Client')],
        colWidths: [14, 20, 12, 18],
        style: { head: [] },
      });

      for (const e of history) {
        histTable.push([
          new Date(e.recorded_at).toLocaleDateString(),
          e.service_type,
          green(`${currencySymbol}${e.amount.toFixed(2)}`),
          e.client_name || '-',
        ]);
      }

      console.log(histTable.toString());
    } else {
      console.log(dim('\n  No earnings recorded yet.\n'));
    }
    console.log();
  });

// ─── cashclaw config ───────────────────────────────────────────────────
const configCmd = program
  .command('config')
  .description('View or update configuration');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    showMiniBanner();
    const config = await loadConfig();
    console.log(JSON.stringify(config, null, 2));
    console.log();
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (dot notation: agent.name)')
  .action(async (key, value) => {
    showMiniBanner();
    const config = await loadConfig();

    // Parse dot notation: "stripe.secret_key" -> config.stripe.secret_key
    const keys = key.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }

    // Try to parse as number or boolean
    let parsedValue = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

    obj[keys[keys.length - 1]] = parsedValue;
    await saveConfig(config);

    console.log(green(`  ${key} = ${JSON.stringify(parsedValue)}\n`));
  });

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key) => {
    showMiniBanner();
    const config = await loadConfig();
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      if (value === undefined || value === null) break;
      value = value[k];
    }
    if (value === undefined) {
      console.log(chalk.yellow(`  Key "${key}" not found.\n`));
    } else {
      console.log(`  ${orange(key)} = ${JSON.stringify(value, null, 2)}\n`);
    }
  });

configCmd.action(async () => {
  showMiniBanner();
  const config = await loadConfig();
  console.log(orange.bold('  Configuration\n'));
  console.log(`  ${dim('Agent:')}    ${config.agent.name}`);
  console.log(`  ${dim('Currency:')} ${config.agent.currency}`);
  console.log(`  ${dim('Stripe:')}   ${config.stripe.connected ? green('connected') : chalk.yellow('not set')}`);
  console.log(`  ${dim('Port:')}     ${config.server.port}`);
  console.log();
  console.log(dim('  Use "cashclaw config show" for full config'));
  console.log(dim('  Use "cashclaw config set <key> <value>" to update\n'));
});

// ─── cashclaw skills ───────────────────────────────────────────────────
program
  .command('skills')
  .description('List and manage OpenClaw skills')
  .option('-i, --install', 'Install all available skills')
  .action(async (options) => {
    showMiniBanner();
    const config = await loadConfig();

    const available = await listAvailableSkills();
    const installed = await listInstalledSkills(config.openclaw?.skills_dir);

    console.log(orange.bold('  CashClaw Skills\n'));

    if (available.length === 0) {
      console.log(dim('  No skills found in package.\n'));
      return;
    }

    for (const skill of available) {
      const isInstalled = installed.includes(skill.name);
      const icon = isInstalled ? green('installed') : dim('available');
      console.log(`  ${skill.name.padEnd(30)} [${icon}]`);
    }
    console.log();

    if (options.install) {
      const skillNames = available.map((s) => s.name);
      console.log(dim(`  Installing ${skillNames.length} skills...\n`));

      const result = await installSkills(skillNames, config.openclaw?.skills_dir);

      if (result.installed.length > 0) {
        for (const name of result.installed) {
          console.log(green(`  + ${name}`));
        }
      }
      if (result.failed.length > 0) {
        for (const f of result.failed) {
          console.log(chalk.yellow(`  ! ${f.name}: ${f.error}`));
        }
      }
      console.log(`\n  ${result.message}\n`);
    } else {
      console.log(dim('  Run "cashclaw skills --install" to install all.\n'));
    }
  });

// ─── Default action (no command) ───────────────────────────────────────
program.action(() => {
  showBanner();
  program.outputHelp();
});

/**
 * Resolve a short ID (first 8 chars) to a full mission UUID.
 */
async function resolveShortId(shortId) {
  if (shortId.length >= 32) return shortId; // Already full UUID

  const missions = await listMissions();
  const match = missions.find((m) => m.id.startsWith(shortId));
  if (!match) {
    throw new Error(`No mission found matching "${shortId}"`);
  }
  return match.id;
}

program.parse();
