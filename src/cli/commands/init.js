import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { loadConfig, saveConfig, getDefaultConfig, ensureConfigDir } from '../utils/config.js';
import { detectOpenClaw, installSkills, listAvailableSkills } from '../../integrations/openclaw-bridge.js';
import { registerAgent } from '../../integrations/hyrve-bridge.js';

const orange = chalk.hex('#FF6B35');
const green = chalk.hex('#16C784');
const dim = chalk.dim;

const SERVICE_MAP = {
  seo_audit: { label: 'SEO Audit', skills: ['cashclaw-seo-auditor'] },
  content_writing: { label: 'Content Writing', skills: ['cashclaw-content-writer'] },
  lead_generation: { label: 'Lead Generation', skills: ['cashclaw-lead-generator'] },
  whatsapp_management: { label: 'WhatsApp Management', skills: ['cashclaw-whatsapp-manager'] },
  social_media: { label: 'Social Media', skills: ['cashclaw-social-media'] },
  email_outreach: { label: 'Email Outreach', skills: ['cashclaw-email-outreach'] },
  competitor_analysis: { label: 'Competitor Analysis', skills: ['cashclaw-competitor-analyzer'] },
  landing_page: { label: 'Landing Page', skills: ['cashclaw-landing-page'] },
  data_scraping: { label: 'Data Scraping', skills: ['cashclaw-data-scraper'] },
  reputation_management: { label: 'Reputation Management', skills: ['cashclaw-reputation-manager'] },
};

export async function runInit() {
  console.log(orange.bold('\n  CashClaw Setup Wizard\n'));
  console.log(dim('  Let\'s configure your AI agent as a freelance business.\n'));

  const config = getDefaultConfig();

  // ─── Step 1: Agent Details ───────────────────────────────────────────
  console.log(orange('  Step 1/5: ') + chalk.bold('Agent Details\n'));

  const step1 = await inquirer.prompt([
    {
      type: 'input',
      name: 'agent_name',
      message: 'Agent name:',
      default: 'MyCashClaw',
      validate: (v) => (v.trim().length > 0 ? true : 'Agent name is required'),
    },
    {
      type: 'input',
      name: 'owner',
      message: 'Your name (owner):',
      default: '',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Contact email:',
      default: '',
      validate: (v) => {
        if (!v) return true; // optional
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : 'Enter a valid email';
      },
    },
    {
      type: 'list',
      name: 'currency',
      message: 'Preferred currency:',
      choices: [
        { name: 'USD ($)', value: 'USD' },
        { name: 'EUR (€)', value: 'EUR' },
        { name: 'GBP (£)', value: 'GBP' },
        { name: 'TRY (₺)', value: 'TRY' },
      ],
      default: 'USD',
    },
  ]);

  config.agent.name = step1.agent_name.trim();
  config.agent.owner = step1.owner.trim();
  config.agent.email = step1.email.trim();
  config.agent.currency = step1.currency;
  config.agent.created_at = new Date().toISOString();

  // ─── Step 2: Stripe ──────────────────────────────────────────────────
  console.log(orange('\n  Step 2/5: ') + chalk.bold('Payment Setup (Stripe)\n'));
  console.log(dim('  Stripe enables you to accept payments. You can skip this and add it later.\n'));

  const step2 = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setup_stripe',
      message: 'Configure Stripe now?',
      default: false,
    },
  ]);

  if (step2.setup_stripe) {
    const stripeAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'secret_key',
        message: 'Stripe Secret Key (sk_test_... or sk_live_...):',
        mask: '*',
        validate: (v) => {
          if (!v) return 'Stripe key is required when setting up';
          if (!v.startsWith('sk_test_') && !v.startsWith('sk_live_')) {
            return 'Key must start with sk_test_ or sk_live_';
          }
          return true;
        },
      },
    ]);

    config.stripe.secret_key = stripeAnswers.secret_key;
    config.stripe.connected = true;
    config.stripe.mode = stripeAnswers.secret_key.startsWith('sk_live_') ? 'live' : 'test';
    console.log(green('\n  Stripe configured in ' + config.stripe.mode + ' mode.\n'));
  } else {
    console.log(dim('\n  Skipped. Run "cashclaw config set stripe.secret_key <key>" later.\n'));
  }

  // ─── Step 3: Services ────────────────────────────────────────────────
  console.log(orange('\n  Step 3/5: ') + chalk.bold('Select Services\n'));
  console.log(dim('  Choose which services your agent will offer:\n'));

  const step3 = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'services',
      message: 'Enable services:',
      choices: [
        { name: 'SEO Audit          - Automated site audits ($9-$59)', value: 'seo_audit', checked: true },
        { name: 'Content Writing    - Blog posts & newsletters ($5-$12)', value: 'content_writing', checked: true },
        { name: 'Lead Generation    - Targeted lead lists ($9-$25)', value: 'lead_generation' },
        { name: 'WhatsApp Mgmt      - Setup & automation ($19-$49)', value: 'whatsapp_management' },
        { name: 'Social Media       - Content & scheduling ($9-$49)', value: 'social_media' },
        { name: 'Email Outreach     - Cold email sequences ($9-$29)', value: 'email_outreach' },
        { name: 'Competitor Analysis - Analysis reports ($19-$49)', value: 'competitor_analysis' },
        { name: 'Landing Page       - Copy & HTML generation ($15-$39)', value: 'landing_page' },
        { name: 'Data Scraping      - Web data extraction ($9-$25)', value: 'data_scraping' },
        { name: 'Reputation Mgmt    - Review monitoring ($19-$49)', value: 'reputation_management' },
      ],
      validate: (v) => (v.length > 0 ? true : 'Select at least one service'),
    },
  ]);

  for (const svcKey of step3.services) {
    config.services[svcKey].enabled = true;
  }

  // ─── Step 4: Pricing ─────────────────────────────────────────────────
  console.log(orange('\n  Step 4/5: ') + chalk.bold('Pricing\n'));
  console.log(dim('  Default prices are shown. Press Enter to keep defaults.\n'));

  for (const svcKey of step3.services) {
    const svc = config.services[svcKey];
    const label = SERVICE_MAP[svcKey]?.label || svcKey;
    console.log(orange(`\n  ${label} Pricing:`));

    const pricingQuestions = Object.entries(svc.pricing).map(([tier, defaultPrice]) => ({
      type: 'input',
      name: tier,
      message: `  ${formatTierName(tier)}:`,
      default: String(defaultPrice),
      validate: (v) => {
        const num = parseFloat(v);
        if (isNaN(num) || num < 0) return 'Enter a valid price (0 or more)';
        return true;
      },
      filter: (v) => parseFloat(v) || 0,
    }));

    const pricingAnswers = await inquirer.prompt(pricingQuestions);

    for (const [tier, price] of Object.entries(pricingAnswers)) {
      config.services[svcKey].pricing[tier] = price;
    }
  }

  // ─── Step 5: OpenClaw Skills ─────────────────────────────────────────
  console.log(orange('\n  Step 5/5: ') + chalk.bold('OpenClaw Integration\n'));

  const spinner = ora('Detecting OpenClaw workspace...').start();
  const detection = await detectOpenClaw();

  if (detection.found) {
    spinner.succeed(`OpenClaw found at ${dim(detection.path)}`);
    config.openclaw.workspace = detection.path;
    config.openclaw.skills_dir = detection.skills_dir;
    config.openclaw.auto_detected = true;

    const skillNames = step3.services
      .flatMap((svcKey) => SERVICE_MAP[svcKey]?.skills || []);

    // Always include core skills
    const allSkills = ['cashclaw-core', 'cashclaw-invoicer', ...skillNames];
    const uniqueSkills = [...new Set(allSkills)];

    const installConfirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: `Install ${uniqueSkills.length} skills to OpenClaw?`,
        default: true,
      },
    ]);

    if (installConfirm.install) {
      const installSpinner = ora('Installing skills...').start();
      const result = await installSkills(uniqueSkills);
      if (result.installed.length > 0) {
        installSpinner.succeed(`Installed ${result.installed.length} skill(s)`);
        for (const name of result.installed) {
          console.log(green(`    + ${name}`));
        }
      }
      if (result.failed.length > 0) {
        for (const f of result.failed) {
          console.log(chalk.yellow(`    ! ${f.name}: ${f.error}`));
        }
      }
    }
  } else {
    spinner.warn('OpenClaw workspace not detected');
    console.log(dim('  Skills will be installed when OpenClaw is set up.\n'));
    console.log(dim('  Expected locations:'));
    for (const p of detection.paths_checked) {
      console.log(dim(`    - ${p}`));
    }
  }

  // ─── Save Config ─────────────────────────────────────────────────────
  const saveSpinner = ora('Saving configuration...').start();
  const configPath = await saveConfig(config);
  saveSpinner.succeed(`Config saved to ${dim(configPath)}`);

  // ─── Try HYRVE Registration ──────────────────────────────────────────
  const hyrveSpinner = ora('Registering with HYRVEai marketplace...').start();
  const hyrveResult = await registerAgent(config);
  if (hyrveResult.success && hyrveResult.data) {
    config.hyrve.registered = true;
    config.hyrve.agent_id = hyrveResult.data.agent_id;
    if (hyrveResult.data.api_key) {
      config.hyrve.api_key = hyrveResult.data.api_key;
    }
    await saveConfig(config);
    hyrveSpinner.succeed(`Registered with HYRVEai (Agent ID: ${config.hyrve.agent_id})`);
  } else {
    hyrveSpinner.info(hyrveResult.message);
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log(orange.bold('\n  Setup Complete!\n'));

  const table = new Table({
    chars: {
      top: '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
      bottom: '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+',
      left: '|', 'left-mid': '+', mid: '-', 'mid-mid': '+',
      right: '|', 'right-mid': '+', middle: '|',
    },
    colWidths: [22, 40],
  });

  table.push(
    [orange('Agent Name'), config.agent.name],
    [orange('Owner'), config.agent.owner || dim('not set')],
    [orange('Email'), config.agent.email || dim('not set')],
    [orange('Currency'), config.agent.currency],
    [orange('Stripe'), config.stripe.connected ? green(`Connected (${config.stripe.mode})`) : chalk.yellow('Not configured')],
    [orange('Services'), step3.services.map((s) => SERVICE_MAP[s]?.label || s).join(', ')],
    [orange('OpenClaw'), detection.found ? green('Detected') : chalk.yellow('Not found')],
    [orange('HYRVEai'), hyrveResult.success ? green('Registered') : dim('Pending')],
    [orange('Dashboard'), dim(`http://localhost:${config.server.port}`)],
  );

  console.log(table.toString());

  console.log(`
  ${orange('Next steps:')}
  ${dim('1.')} Run ${chalk.bold('cashclaw status')} to see your agent status
  ${dim('2.')} Run ${chalk.bold('cashclaw dashboard')} to open the web dashboard
  ${dim('3.')} Run ${chalk.bold('cashclaw missions')} to manage client work
  `);
}

/**
 * Format tier names for display: "post_500" -> "$500 Post", "basic" -> "Basic"
 */
function formatTierName(tier) {
  const map = {
    basic: 'Basic',
    standard: 'Standard',
    pro: 'Pro',
    post_500: '500-word Post',
    post_1500: '1500-word Post',
    newsletter: 'Newsletter',
    starter_25: 'Starter (25 leads)',
    standard_50: 'Standard (50 leads)',
    pro_100: 'Pro (100 leads)',
    setup: 'Setup',
    monthly: 'Monthly',
    weekly_1: '1 post/week',
    weekly_3: '3 posts/week',
    monthly_full: 'Full monthly',
  };
  return map[tier] || tier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
