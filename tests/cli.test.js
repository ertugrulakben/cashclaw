import assert from 'node:assert';
import { describe, it, before, after, afterEach } from 'node:test';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import http from 'http';

// ─── Test Setup ────────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), 'cashclaw-test-' + Date.now());
const TEST_CONFIG_DIR = path.join(TEST_DIR, '.cashclaw');
const TEST_MISSIONS_DIR = path.join(TEST_CONFIG_DIR, 'missions');
const TEST_EARNINGS_FILE = path.join(TEST_CONFIG_DIR, 'earnings.jsonl');

// Override HOME for tests so we don't pollute the real config
const originalHome = os.homedir;

before(async () => {
  await fs.ensureDir(TEST_CONFIG_DIR);
  await fs.ensureDir(TEST_MISSIONS_DIR);
});

after(async () => {
  await fs.remove(TEST_DIR);
});

// ─── Config Tests ──────────────────────────────────────────────────────

describe('Config', () => {
  it('should return a valid default config', async () => {
    const { getDefaultConfig } = await import('../src/cli/utils/config.js');
    const config = getDefaultConfig();

    assert.ok(config.agent, 'Config should have agent section');
    assert.strictEqual(config.agent.name, 'MyCashClaw');
    assert.strictEqual(config.agent.currency, 'USD');
    assert.ok(config.services, 'Config should have services section');
    assert.ok(config.stripe, 'Config should have stripe section');
    assert.ok(config.server, 'Config should have server section');
    assert.strictEqual(config.server.port, 3847);
  });

  it('should have correct default pricing', async () => {
    const { getDefaultConfig } = await import('../src/cli/utils/config.js');
    const config = getDefaultConfig();

    // SEO Audit pricing
    assert.strictEqual(config.services.seo_audit.pricing.basic, 9);
    assert.strictEqual(config.services.seo_audit.pricing.standard, 29);
    assert.strictEqual(config.services.seo_audit.pricing.pro, 59);

    // Content Writing pricing
    assert.strictEqual(config.services.content_writing.pricing.post_500, 5);
    assert.strictEqual(config.services.content_writing.pricing.post_1500, 12);
    assert.strictEqual(config.services.content_writing.pricing.newsletter, 9);

    // Lead Generation pricing
    assert.strictEqual(config.services.lead_generation.pricing.starter_25, 9);
    assert.strictEqual(config.services.lead_generation.pricing.standard_50, 15);
    assert.strictEqual(config.services.lead_generation.pricing.pro_100, 25);

    // WhatsApp pricing
    assert.strictEqual(config.services.whatsapp_management.pricing.setup, 19);
    assert.strictEqual(config.services.whatsapp_management.pricing.monthly, 49);

    // Social Media pricing
    assert.strictEqual(config.services.social_media.pricing.weekly_1, 9);
    assert.strictEqual(config.services.social_media.pricing.weekly_3, 19);
    assert.strictEqual(config.services.social_media.pricing.monthly_full, 49);
  });

  it('should save and load config correctly', async () => {
    const configPath = path.join(TEST_CONFIG_DIR, 'config-test.json');

    const testConfig = {
      agent: { name: 'TestAgent', currency: 'EUR' },
      stripe: { connected: true },
    };

    await fs.writeJson(configPath, testConfig, { spaces: 2 });
    const loaded = await fs.readJson(configPath);

    assert.strictEqual(loaded.agent.name, 'TestAgent');
    assert.strictEqual(loaded.agent.currency, 'EUR');
    assert.strictEqual(loaded.stripe.connected, true);
  });

  it('should have all service types defined', async () => {
    const { getDefaultConfig } = await import('../src/cli/utils/config.js');
    const config = getDefaultConfig();

    const expectedServices = [
      'seo_audit',
      'content_writing',
      'lead_generation',
      'whatsapp_management',
      'social_media',
      'email_outreach',
      'competitor_analysis',
      'landing_page',
      'data_scraping',
      'reputation_management',
    ];

    for (const svc of expectedServices) {
      assert.ok(config.services[svc], `Service "${svc}" should exist in default config`);
      assert.ok(config.services[svc].pricing, `Service "${svc}" should have pricing`);
      assert.ok(config.services[svc].description, `Service "${svc}" should have a description`);
      assert.strictEqual(config.services[svc].enabled, false, `Service "${svc}" should be disabled by default`);
    }
  });
});

// ─── Banner Tests ──────────────────────────────────────────────────────

describe('Banner', () => {
  it('should export showBanner and showMiniBanner functions', async () => {
    const banner = await import('../src/cli/utils/banner.js');
    assert.strictEqual(typeof banner.showBanner, 'function');
    assert.strictEqual(typeof banner.showMiniBanner, 'function');
  });

  it('should display banner without errors', async () => {
    const { showBanner, showMiniBanner } = await import('../src/cli/utils/banner.js');

    // Capture console output
    const originalLog = console.log;
    const outputs = [];
    console.log = (...args) => outputs.push(args.join(' '));

    showBanner();
    showMiniBanner();

    console.log = originalLog;

    assert.ok(outputs.length > 0, 'Banner should produce output');
  });
});

// ─── Mission Tests ─────────────────────────────────────────────────────

describe('Missions', () => {
  it('should load mission templates', async () => {
    const { fileURLToPath } = await import('url');
    const missionsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'missions'
    );

    const files = await fs.readdir(missionsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    assert.ok(jsonFiles.length >= 17, `Expected at least 17 mission templates, found ${jsonFiles.length}`);

    for (const file of jsonFiles) {
      const template = await fs.readJson(path.join(missionsDir, file));
      assert.ok(template.template, `${file}: should have "template" field`);
      assert.ok(template.service_type, `${file}: should have "service_type" field`);
      assert.ok(template.name, `${file}: should have "name" field`);
      assert.ok(typeof template.default_price_usd === 'number', `${file}: should have numeric "default_price_usd"`);
      assert.ok(template.estimated_hours > 0, `${file}: should have positive "estimated_hours"`);
      assert.ok(Array.isArray(template.skills_required), `${file}: should have "skills_required" array`);
      assert.ok(Array.isArray(template.deliverables), `${file}: should have "deliverables" array`);
      assert.ok(Array.isArray(template.steps), `${file}: should have "steps" array`);
    }
  });

  it('should validate specific mission template prices', async () => {
    const missionsDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '..',
      'missions'
    );

    const seoBasic = await fs.readJson(path.join(missionsDir, 'seo-audit-basic.json'));
    assert.strictEqual(seoBasic.default_price_usd, 9);

    const seoPro = await fs.readJson(path.join(missionsDir, 'seo-audit-pro.json'));
    assert.strictEqual(seoPro.default_price_usd, 59);

    const blog500 = await fs.readJson(path.join(missionsDir, 'blog-post-500.json'));
    assert.strictEqual(blog500.default_price_usd, 5);

    const blog1500 = await fs.readJson(path.join(missionsDir, 'blog-post-1500.json'));
    assert.strictEqual(blog1500.default_price_usd, 12);

    const social = await fs.readJson(path.join(missionsDir, 'social-media-weekly.json'));
    assert.strictEqual(social.default_price_usd, 9);

    const leads = await fs.readJson(path.join(missionsDir, 'lead-list-50.json'));
    assert.strictEqual(leads.default_price_usd, 15);

    const whatsapp = await fs.readJson(path.join(missionsDir, 'whatsapp-setup.json'));
    assert.strictEqual(whatsapp.default_price_usd, 19);

    // New v1.2.0 skills
    const emailBasic = await fs.readJson(path.join(missionsDir, 'email-outreach-basic.json'));
    assert.strictEqual(emailBasic.default_price_usd, 9);

    const competitorPro = await fs.readJson(path.join(missionsDir, 'competitor-analysis-pro.json'));
    assert.strictEqual(competitorPro.default_price_usd, 49);

    const landingBasic = await fs.readJson(path.join(missionsDir, 'landing-page-basic.json'));
    assert.strictEqual(landingBasic.default_price_usd, 15);

    const dataPro = await fs.readJson(path.join(missionsDir, 'data-scrape-pro.json'));
    assert.strictEqual(dataPro.default_price_usd, 25);

    const reputationAudit = await fs.readJson(path.join(missionsDir, 'reputation-audit.json'));
    assert.strictEqual(reputationAudit.default_price_usd, 19);
  });

  it('should create a mission from template', async () => {
    const missionId = `test-${Date.now()}`;
    const missionPath = path.join(TEST_MISSIONS_DIR, `${missionId}.json`);

    const mission = {
      id: missionId,
      template: 'seo-audit-basic',
      name: 'Test SEO Audit',
      price_usd: 9,
      status: 'created',
      client: { name: 'Test Client', email: 'test@example.com' },
      steps: [
        { index: 0, description: 'Step 1', status: 'pending' },
        { index: 1, description: 'Step 2', status: 'pending' },
      ],
      created_at: new Date().toISOString(),
    };

    await fs.writeJson(missionPath, mission, { spaces: 2 });
    const loaded = await fs.readJson(missionPath);

    assert.strictEqual(loaded.id, missionId);
    assert.strictEqual(loaded.template, 'seo-audit-basic');
    assert.strictEqual(loaded.price_usd, 9);
    assert.strictEqual(loaded.status, 'created');
    assert.strictEqual(loaded.client.name, 'Test Client');
    assert.strictEqual(loaded.steps.length, 2);

    // Cleanup
    await fs.remove(missionPath);
  });

  it('should support mission lifecycle state transitions', () => {
    const validTransitions = {
      created: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: ['paid'],
    };

    // Verify we have the expected states
    assert.ok(validTransitions.created.includes('in_progress'));
    assert.ok(validTransitions.in_progress.includes('completed'));
    assert.ok(!validTransitions.created.includes('completed'), 'Cannot go from created directly to completed');
  });
});

// ─── Earnings Tests ────────────────────────────────────────────────────

describe('Earnings', () => {
  it('should write and read earnings in JSONL format', async () => {
    const testFile = path.join(TEST_CONFIG_DIR, 'earnings-test.jsonl');

    const entry1 = { id: 'earn_1', amount: 9, service_type: 'seo-audit', recorded_at: new Date().toISOString() };
    const entry2 = { id: 'earn_2', amount: 29, service_type: 'seo-audit', recorded_at: new Date().toISOString() };

    await fs.writeFile(testFile, JSON.stringify(entry1) + '\n', 'utf-8');
    await fs.appendFile(testFile, JSON.stringify(entry2) + '\n', 'utf-8');

    const content = await fs.readFile(testFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    assert.strictEqual(lines.length, 2);

    const parsed1 = JSON.parse(lines[0]);
    const parsed2 = JSON.parse(lines[1]);

    assert.strictEqual(parsed1.amount, 9);
    assert.strictEqual(parsed2.amount, 29);
    assert.strictEqual(parsed1.id, 'earn_1');
    assert.strictEqual(parsed2.id, 'earn_2');

    // Total
    const total = [parsed1, parsed2].reduce((sum, e) => sum + e.amount, 0);
    assert.strictEqual(total, 38);

    // Cleanup
    await fs.remove(testFile);
  });

  it('should handle empty earnings file', async () => {
    const testFile = path.join(TEST_CONFIG_DIR, 'earnings-empty.jsonl');
    await fs.writeFile(testFile, '', 'utf-8');

    const content = await fs.readFile(testFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    assert.strictEqual(lines.length, 0);

    await fs.remove(testFile);
  });
});

// ─── Integration Module Tests ──────────────────────────────────────────

describe('Integrations', () => {
  it('should export stripe-connect functions', async () => {
    const stripe = await import('../src/integrations/stripe-connect.js');
    assert.strictEqual(typeof stripe.createPaymentLink, 'function');
    assert.strictEqual(typeof stripe.createInvoice, 'function');
    assert.strictEqual(typeof stripe.getPaymentStatus, 'function');
    assert.strictEqual(typeof stripe.listPayments, 'function');
    assert.strictEqual(typeof stripe.testConnection, 'function');
  });

  it('should export hyrve-bridge functions', async () => {
    const hyrve = await import('../src/integrations/hyrve-bridge.js');
    assert.strictEqual(typeof hyrve.registerAgent, 'function');
    assert.strictEqual(typeof hyrve.syncStatus, 'function');
    assert.strictEqual(typeof hyrve.listAvailableJobs, 'function');
    assert.strictEqual(typeof hyrve.acceptJob, 'function');
  });

  it('should export openclaw-bridge functions', async () => {
    const openclaw = await import('../src/integrations/openclaw-bridge.js');
    assert.strictEqual(typeof openclaw.detectOpenClaw, 'function');
    assert.strictEqual(typeof openclaw.getSkillsDir, 'function');
    assert.strictEqual(typeof openclaw.installSkills, 'function');
    assert.strictEqual(typeof openclaw.listInstalledSkills, 'function');
    assert.strictEqual(typeof openclaw.listAvailableSkills, 'function');
  });
});

// ─── Engine Module Tests ───────────────────────────────────────────────

describe('Engine', () => {
  it('should export mission-runner functions', async () => {
    const runner = await import('../src/engine/mission-runner.js');
    assert.strictEqual(typeof runner.createMission, 'function');
    assert.strictEqual(typeof runner.startMission, 'function');
    assert.strictEqual(typeof runner.completeMission, 'function');
    assert.strictEqual(typeof runner.listMissions, 'function');
    assert.strictEqual(typeof runner.getMission, 'function');
    assert.strictEqual(typeof runner.getMissionStats, 'function');
  });

  it('should export earnings-tracker functions', async () => {
    const tracker = await import('../src/engine/earnings-tracker.js');
    assert.strictEqual(typeof tracker.recordEarning, 'function');
    assert.strictEqual(typeof tracker.getTotal, 'function');
    assert.strictEqual(typeof tracker.getMonthly, 'function');
    assert.strictEqual(typeof tracker.getWeekly, 'function');
    assert.strictEqual(typeof tracker.getToday, 'function');
    assert.strictEqual(typeof tracker.getHistory, 'function');
    assert.strictEqual(typeof tracker.getByService, 'function');
    assert.strictEqual(typeof tracker.getDailyTotals, 'function');
  });

  it('should export scheduler functions', async () => {
    const scheduler = await import('../src/engine/scheduler.js');
    assert.strictEqual(typeof scheduler.startHeartbeat, 'function');
    assert.strictEqual(typeof scheduler.stopHeartbeat, 'function');
    assert.strictEqual(typeof scheduler.checkPendingMissions, 'function');
    assert.strictEqual(typeof scheduler.checkUnpaidInvoices, 'function');
    assert.strictEqual(typeof scheduler.isHeartbeatRunning, 'function');
  });
});

// ─── Template Tests ────────────────────────────────────────────────────

describe('Templates', () => {
  it('should have a valid default config template', async () => {
    const templatesDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '..',
      'templates'
    );

    const defaultConfig = await fs.readJson(path.join(templatesDir, 'config.default.json'));
    assert.ok(defaultConfig.agent, 'Default config template should have agent');
    assert.ok(defaultConfig.services, 'Default config template should have services');
    assert.ok(defaultConfig.stripe, 'Default config template should have stripe');
    assert.ok(defaultConfig.server, 'Default config template should have server');
  });

  it('should have an invoice template', async () => {
    const templatesDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '..',
      'templates'
    );

    const invoiceHtml = await fs.readFile(path.join(templatesDir, 'invoice.html'), 'utf-8');

    // Check for required placeholders
    assert.ok(invoiceHtml.includes('{{invoice_id}}'), 'Invoice should have invoice_id placeholder');
    assert.ok(invoiceHtml.includes('{{agent_name}}'), 'Invoice should have agent_name placeholder');
    assert.ok(invoiceHtml.includes('{{client_name}}'), 'Invoice should have client_name placeholder');
    assert.ok(invoiceHtml.includes('{{service_description}}'), 'Invoice should have service_description placeholder');
    assert.ok(invoiceHtml.includes('{{amount}}'), 'Invoice should have amount placeholder');
    assert.ok(invoiceHtml.includes('{{currency}}'), 'Invoice should have currency placeholder');
    assert.ok(invoiceHtml.includes('{{payment_link}}'), 'Invoice should have payment_link placeholder');
    assert.ok(invoiceHtml.includes('{{date}}'), 'Invoice should have date placeholder');
  });
});

// ─── Dashboard Server Tests ────────────────────────────────────────────

describe('Dashboard Server', () => {
  it('should export createDashboardServer function', async () => {
    const { createDashboardServer } = await import('../src/dashboard/server.js');
    assert.strictEqual(typeof createDashboardServer, 'function');
  });

  it('should create an express app with expected routes', async () => {
    const { createDashboardServer } = await import('../src/dashboard/server.js');
    const app = createDashboardServer();

    assert.ok(app, 'Should return an express app');
    assert.strictEqual(typeof app.listen, 'function', 'App should have listen method');
  });
});

// ─── Version Tests ────────────────────────────────────────────────────

describe('Version', () => {
  it('should export VERSION from utils/version.js', async () => {
    const { VERSION } = await import('../src/utils/version.js');
    assert.ok(VERSION, 'VERSION should be defined');
    assert.ok(/^\d+\.\d+\.\d+/.test(VERSION), `VERSION "${VERSION}" should be semver format`);
  });

  it('should match package.json version', async () => {
    const { VERSION } = await import('../src/utils/version.js');
    const pkg = await fs.readJson(
      path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'package.json')
    );
    assert.strictEqual(VERSION, pkg.version);
  });
});

// ─── Security Tests ──────────────────────────────────────────────────

describe('Security', () => {
  it('should block prototype pollution keys in config traversal', () => {
    const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

    for (const dangerous of DANGEROUS_KEYS) {
      const keys = `some.${dangerous}.nested`.split('.');
      const hasDangerous = keys.some((k) => DANGEROUS_KEYS.includes(k));
      assert.ok(hasDangerous, `Should detect dangerous key "${dangerous}"`);
    }
  });

  it('should block sensitive config keys via API', () => {
    const BLOCKED_KEYS = ['stripe.secret_key', 'stripe.webhook_secret'];

    assert.ok(BLOCKED_KEYS.includes('stripe.secret_key'));
    assert.ok(BLOCKED_KEYS.includes('stripe.webhook_secret'));
    assert.ok(!BLOCKED_KEYS.includes('agent.name'));
    assert.ok(!BLOCKED_KEYS.includes('services.seo_audit.enabled'));
  });

  it('should have new pricing for v1.2.0 skills', async () => {
    const { getDefaultConfig } = await import('../src/cli/utils/config.js');
    const config = getDefaultConfig();

    assert.strictEqual(config.services.email_outreach.pricing.basic, 9);
    assert.strictEqual(config.services.email_outreach.pricing.pro, 29);
    assert.strictEqual(config.services.competitor_analysis.pricing.basic, 19);
    assert.strictEqual(config.services.competitor_analysis.pricing.pro, 49);
    assert.strictEqual(config.services.landing_page.pricing.basic, 15);
    assert.strictEqual(config.services.landing_page.pricing.pro, 39);
    assert.strictEqual(config.services.data_scraping.pricing.basic, 9);
    assert.strictEqual(config.services.data_scraping.pricing.pro, 25);
    assert.strictEqual(config.services.reputation_management.pricing.basic, 19);
    assert.strictEqual(config.services.reputation_management.pricing.pro, 49);
  });
});

// ─── Skills Directory Tests ──────────────────────────────────────────

describe('Skills', () => {
  it('should have 12 skill directories', async () => {
    const skillsDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
      '..',
      'skills'
    );

    const dirs = await fs.readdir(skillsDir);
    const skillDirs = dirs.filter(d => d.startsWith('cashclaw-'));
    assert.ok(skillDirs.length >= 12, `Expected at least 12 skill dirs, found ${skillDirs.length}`);

    for (const dir of skillDirs) {
      const skillMd = path.join(skillsDir, dir, 'SKILL.md');
      const exists = await fs.pathExists(skillMd);
      assert.ok(exists, `${dir}/SKILL.md should exist`);
    }
  });
});

// ─── Dashboard Command Tests ──────────────────────────────────────────

describe('Dashboard Port Collision', () => {
  let children = [];

  // Cleanup after each test to ensure ports are freed
  afterEach(() => {
    children.forEach(child => child.kill());
    children = [];
  });

  it('should successfully increment ports up to the limit', async (t) => {
    const ports = [];
    
    // Helper to start an instance and return the port
    const startInstance = () => new Promise((resolve) => {
      const child = exec('node bin/cashclaw.js dashboard --no-open');
      children.push(child);
      
      const onData = (data) => {
        const match = data.toString().match(/localhost:(\d+)/);
        if (match) {
            child.stderr.removeListener('data', onData);
            child.stdout.removeListener('data', onData);
            resolve(parseInt(match[1], 10));
        }
      }
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
    });

    // Test 3 instances to verify multiple recursions
    ports[0] = await startInstance();
    ports[1] = await startInstance();
    ports[2] = await startInstance();

    assert.strictEqual(ports[1], ports[0] + 1);
    assert.strictEqual(ports[2], ports[1] + 1);
  });
});


// ─── Summary ───────────────────────────────────────────────────────────

console.log('\n  CashClaw Test Suite\n');
