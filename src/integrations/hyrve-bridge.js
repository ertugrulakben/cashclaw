import { loadConfig } from '../cli/utils/config.js';
import { VERSION } from '../utils/version.js';

const DEFAULT_API_URL = 'https://api.hyrveai.com/v1';

/**
 * Get the HYRVE API base URL from config or default.
 */
async function getApiUrl() {
  const config = await loadConfig();
  return config.hyrve?.api_url || DEFAULT_API_URL;
}

/**
 * Build request headers for HYRVE API calls.
 * Includes X-API-Key for authenticated requests.
 */
async function getHeaders(config = null) {
  if (!config) config = await loadConfig();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `CashClaw/${VERSION}`,
    'X-Agent-Id': config.hyrve?.agent_id || '',
    'X-Agent-Name': config.agent?.name || '',
  };
  if (config.hyrve?.api_key) {
    headers['X-API-Key'] = config.hyrve.api_key;
  }
  return headers;
}

/**
 * Parse an API error response into a descriptive message.
 * Handles JSON error bodies, plain text, and network errors.
 * @param {Response} response - The fetch Response object
 * @returns {string} Human-readable error message
 */
async function parseErrorResponse(response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      if (body.error?.message) return body.error.message;
      if (body.message) return body.message;
      if (body.error && typeof body.error === 'string') return body.error;
      return JSON.stringify(body);
    }
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status} ${response.statusText}`;
  }
}

/**
 * Check if the HYRVE bridge is properly configured with API key.
 * @param {object} config - CashClaw configuration
 * @returns {object} { configured: boolean, message: string }
 */
function checkBridgeConfig(config) {
  if (!config.hyrve?.api_key) {
    return {
      configured: false,
      message: 'HYRVE API key not configured. Run "cashclaw config --hyrve-key <YOUR_KEY>" or set hyrve.api_key in config.',
    };
  }
  if (!config.hyrve?.agent_id) {
    return {
      configured: false,
      message: 'Agent not registered with HYRVE. Run "cashclaw init" first.',
    };
  }
  return { configured: true, message: 'Bridge configured' };
}

/**
 * Register the CashClaw agent on the HYRVEai marketplace.
 * This makes the agent discoverable to potential clients.
 * @param {object} config - CashClaw configuration
 * @returns {object} Registration result with agent_id
 */
export async function registerAgent(config) {
  const apiUrl = config.hyrve?.api_url || DEFAULT_API_URL;

  const enabledServices = Object.entries(config.services || {})
    .filter(([_, svc]) => svc.enabled)
    .map(([key, svc]) => ({
      type: key,
      pricing: svc.pricing,
      description: svc.description,
    }));

  const payload = {
    agent_name: config.agent?.name || 'CashClaw Agent',
    owner_name: config.agent?.owner || '',
    email: config.agent?.email || '',
    currency: config.agent?.currency || 'USD',
    services: enabledServices,
    stripe_connected: !!config.stripe?.secret_key,
    version: VERSION,
  };

  try {
    const response = await fetch(`${apiUrl}/agents/register`, {
      method: 'POST',
      headers: await getHeaders(config),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`HYRVE API error (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      agent_id: data.agent_id || data.id,
      message: data.message || 'Agent registered successfully',
    };
  } catch (err) {
    // If the API is not reachable, return a graceful failure
    if (err.cause?.code === 'ECONNREFUSED' || err.cause?.code === 'ENOTFOUND' || err.message.includes('fetch')) {
      return {
        success: false,
        agent_id: null,
        message: 'HYRVEai marketplace is not reachable. Check your network connection or try again later.',
      };
    }
    return {
      success: false,
      agent_id: null,
      message: `Registration failed: ${err.message}`,
    };
  }
}

/**
 * Sync agent status with HYRVE marketplace.
 * Sends current earnings, mission count, and availability.
 */
export async function syncStatus() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, message: check.message };
  }

  try {
    const response = await fetch(`${apiUrl}/agents/${config.hyrve.agent_id}/sync`, {
      method: 'POST',
      headers: await getHeaders(config),
      body: JSON.stringify({
        status: 'active',
        stats: config.stats || {},
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Sync failed (${response.status}): ${errMsg}`);
    }

    return { success: true, message: 'Status synced with HYRVE marketplace' };
  } catch (err) {
    return {
      success: false,
      message: `Sync unavailable: ${err.message}. Local data is up to date.`,
    };
  }
}

/**
 * List available jobs from the HYRVE marketplace that match
 * this agent's enabled services.
 */
export async function listAvailableJobs() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const enabledTypes = Object.entries(config.services || {})
    .filter(([_, svc]) => svc.enabled)
    .map(([key]) => key);

  try {
    const params = new URLSearchParams({
      service_types: enabledTypes.join(','),
      currency: config.agent?.currency || 'USD',
      limit: '20',
    });

    const response = await fetch(`${apiUrl}/jobs?${params}`, {
      headers: await getHeaders(config),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Failed to fetch jobs (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      jobs: data.jobs || [],
      total: data.total || 0,
    };
  } catch (err) {
    return {
      success: false,
      jobs: [],
      total: 0,
      message: `Marketplace unavailable: ${err.message}`,
    };
  }
}

/**
 * Accept a job from the HYRVE marketplace.
 * This creates a mission locally and notifies the marketplace.
 * @param {string} jobId - The HYRVE job ID to accept
 */
export async function acceptJob(jobId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, message: check.message };
  }

  try {
    const response = await fetch(`${apiUrl}/jobs/${jobId}/accept`, {
      method: 'POST',
      headers: await getHeaders(config),
      body: JSON.stringify({
        agent_id: config.hyrve.agent_id,
        accepted_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Failed to accept job (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      job: data.job || {},
      mission_template: data.mission_template || null,
      message: data.message || 'Job accepted successfully',
    };
  } catch (err) {
    return {
      success: false,
      message: `Could not accept job: ${err.message}`,
    };
  }
}

/**
 * Deliver completed work for an order on the HYRVE marketplace.
 * Uploads deliverables and marks the order as delivered.
 * @param {string} orderId - The HYRVE order ID
 * @param {object} deliverables - Deliverable details
 * @param {string} deliverables.summary - Summary of work completed
 * @param {string[]} deliverables.files - Array of file paths or URLs
 * @param {object} deliverables.metadata - Additional metadata (word count, pages, etc.)
 * @returns {object} Delivery result
 */
export async function deliverJob(orderId, deliverables) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, message: check.message };
  }

  if (!orderId) {
    return { success: false, message: 'Order ID is required.' };
  }

  if (!deliverables || !deliverables.summary) {
    return { success: false, message: 'Deliverables must include a summary.' };
  }

  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: await getHeaders(config),
      body: JSON.stringify({
        agent_id: config.hyrve.agent_id,
        summary: deliverables.summary,
        files: deliverables.files || [],
        metadata: deliverables.metadata || {},
        delivered_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Delivery failed (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      order: data.order || {},
      message: data.message || 'Deliverables submitted successfully. Awaiting client review.',
    };
  } catch (err) {
    return {
      success: false,
      message: `Could not deliver order: ${err.message}`,
    };
  }
}

/**
 * Get the authenticated agent's profile from the HYRVE marketplace.
 * Returns agent details, stats, reputation, and active services.
 * @returns {object} Agent profile data
 */
export async function getAgentProfile() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, message: check.message };
  }

  try {
    const response = await fetch(`${apiUrl}/agents/${config.hyrve.agent_id}`, {
      method: 'GET',
      headers: await getHeaders(config),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Failed to fetch profile (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      profile: data.agent || data,
      message: 'Agent profile retrieved successfully',
    };
  } catch (err) {
    return {
      success: false,
      profile: null,
      message: `Could not fetch profile: ${err.message}`,
    };
  }
}

/**
 * List orders for the authenticated agent from the HYRVE marketplace.
 * Returns active, completed, and pending orders.
 * @param {object} options - Query options
 * @param {string} options.status - Filter by status: 'active', 'completed', 'pending', 'all'
 * @param {number} options.limit - Max results (default 20)
 * @param {number} options.offset - Pagination offset (default 0)
 * @returns {object} Orders list
 */
export async function listOrders(options = {}) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();

  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, orders: [], total: 0, message: check.message };
  }

  try {
    const params = new URLSearchParams({
      status: options.status || 'all',
      limit: String(options.limit || 20),
      offset: String(options.offset || 0),
    });

    const response = await fetch(`${apiUrl}/orders?${params}`, {
      method: 'GET',
      headers: await getHeaders(config),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Failed to fetch orders (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      orders: data.orders || [],
      total: data.total || 0,
      message: `Found ${data.total || 0} order(s)`,
    };
  } catch (err) {
    return {
      success: false,
      orders: [],
      total: 0,
      message: `Could not fetch orders: ${err.message}`,
    };
  }
}
