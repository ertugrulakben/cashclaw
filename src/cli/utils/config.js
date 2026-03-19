import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Returns the path to the CashClaw config directory: ~/.cashclaw/
 */
export function getConfigDir() {
  return path.join(os.homedir(), '.cashclaw');
}

/**
 * Returns the path to the main config file: ~/.cashclaw/config.json
 */
export function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Ensures ~/.cashclaw/ and its subdirectories exist.
 */
export async function ensureConfigDir() {
  const configDir = getConfigDir();
  await fs.ensureDir(configDir);
  await fs.ensureDir(path.join(configDir, 'missions'));
  return configDir;
}

/**
 * Returns the full default configuration with realistic pricing.
 */
export function getDefaultConfig() {
  return {
    agent: {
      name: 'MyCashClaw',
      owner: '',
      email: '',
      currency: 'USD',
      created_at: new Date().toISOString(),
    },
    stripe: {
      secret_key: '',
      connected: false,
      mode: 'test',
    },
    server: {
      port: 3847,
      host: 'localhost',
    },
    services: {
      seo_audit: {
        enabled: false,
        pricing: {
          basic: 9,
          standard: 29,
          pro: 59,
        },
        description: 'Automated SEO audits with actionable recommendations',
      },
      content_writing: {
        enabled: false,
        pricing: {
          post_500: 5,
          post_1500: 12,
          newsletter: 9,
        },
        description: 'AI-powered blog posts, articles, and newsletters',
      },
      lead_generation: {
        enabled: false,
        pricing: {
          starter_25: 9,
          standard_50: 15,
          pro_100: 25,
        },
        description: 'Targeted lead lists with contact info and scoring',
      },
      whatsapp_management: {
        enabled: false,
        pricing: {
          setup: 19,
          monthly: 49,
        },
        description: 'WhatsApp Business setup and automated responses',
      },
      social_media: {
        enabled: false,
        pricing: {
          weekly_1: 9,
          weekly_3: 19,
          monthly_full: 49,
        },
        description: 'Social media content creation and scheduling',
      },
      email_outreach: {
        enabled: false,
        pricing: {
          basic: 9,
          standard: 19,
          pro: 29,
        },
        description: 'Cold email sequences and outreach campaigns',
      },
      competitor_analysis: {
        enabled: false,
        pricing: {
          basic: 19,
          standard: 35,
          pro: 49,
        },
        description: 'Competitor analysis reports with market insights',
      },
      landing_page: {
        enabled: false,
        pricing: {
          basic: 15,
          standard: 29,
          pro: 39,
        },
        description: 'Landing page copy and HTML generation',
      },
      data_scraping: {
        enabled: false,
        pricing: {
          basic: 9,
          standard: 19,
          pro: 25,
        },
        description: 'Web data extraction and structuring',
      },
      reputation_management: {
        enabled: false,
        pricing: {
          basic: 19,
          standard: 35,
          pro: 49,
        },
        description: 'Online review monitoring and response',
      },
    },
    hyrve: {
      api_key: null,
      agent_id: null,
      dashboard_url: 'https://app.hyrveai.com',
      api_url: 'https://api.hyrveai.com/v1',
      enabled: false,
      registered: false,
    },
    openclaw: {
      workspace: '',
      skills_dir: '',
      auto_detected: false,
    },
    heartbeat: {
      enabled: false,
      interval_ms: 60000,
    },
    stats: {
      total_missions: 0,
      completed_missions: 0,
      total_earned: 0,
    },
  };
}

/**
 * Loads config from ~/.cashclaw/config.json.
 * Returns default config if file does not exist.
 */
export async function loadConfig() {
  const configPath = getConfigPath();
  try {
    const exists = await fs.pathExists(configPath);
    if (!exists) {
      return getDefaultConfig();
    }
    const raw = await fs.readFile(configPath, 'utf-8');
    const loaded = JSON.parse(raw);
    // Merge with defaults to fill in any missing keys
    const defaults = getDefaultConfig();
    return deepMerge(defaults, loaded);
  } catch (err) {
    console.error(`Warning: Could not read config at ${configPath}: ${err.message}`);
    return getDefaultConfig();
  }
}

/**
 * Saves config object to ~/.cashclaw/config.json.
 */
export async function saveConfig(config) {
  await ensureConfigDir();
  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

/**
 * Deep merge: target is base, source overrides.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
