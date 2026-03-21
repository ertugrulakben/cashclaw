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
    // Use self-register endpoint (no auth required for initial registration)
    const selfRegPayload = {
      agent_name: payload.agent_name,
      description: `CashClaw agent: ${enabledServices.map(s => s.type).join(', ')}`,
      capabilities: enabledServices.map(s => s.type),
      pricing_model: 'per_task',
      base_price_usd: enabledServices[0]?.pricing?.basic || 5,
      owner_email: payload.email,
      owner_name: payload.owner_name,
    };

    const response = await fetch(`${apiUrl}/agents/self-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `CashClaw/${VERSION}`,
      },
      body: JSON.stringify(selfRegPayload),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`HYRVE API error (${response.status}): ${errMsg}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        agent_id: data.agent_id || data.id,
        api_key: data.api_key || null,
        agent_slug: data.agent_slug || null,
        dashboard_url: data.dashboard_url || null,
      },
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
    const params = new URLSearchParams({ limit: '20' });
    if (enabledTypes.length > 0) {
      params.set('service_types', enabledTypes.join(','));
    }

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

/**
 * Get the agent's wallet data from the HYRVE marketplace.
 * Returns available balance, pending balance, total earned, and recent transactions.
 * @returns {object} Wallet data with balances and transactions
 */
export async function getWallet() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  const check = checkBridgeConfig(config);
  if (!check.configured) {
    return { success: false, wallet: null, transactions: [], message: check.message };
  }
  try {
    const response = await fetch(`${apiUrl}/wallet`, {
      headers: await getHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Wallet fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return {
      success: true,
      wallet: data.wallet || { available: 0, pending: 0, total_earned: 0 },
      transactions: data.transactions || [],
    };
  } catch (err) {
    return { success: false, wallet: null, transactions: [], message: `Wallet unavailable: ${err.message}` };
  }
}

// ─── JWT Auth & v1.1.0 Functions ────────────────────────────────────────

/**
 * Build request headers with JWT or API key authentication.
 * Prefers JWT Bearer token if available, falls back to X-API-Key.
 */
async function getAuthHeaders(config = null) {
  if (!config) config = await loadConfig();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `CashClaw/${VERSION}`,
  };
  // JWT token varsa Bearer kullan, yoksa API key kullan
  if (config.hyrve?.jwt_token) {
    headers['Authorization'] = `Bearer ${config.hyrve.jwt_token}`;
  } else if (config.hyrve?.api_key) {
    headers['X-API-Key'] = config.hyrve.api_key;
  }
  if (config.hyrve?.agent_id) {
    headers['X-Agent-Id'] = config.hyrve.agent_id;
  }
  return headers;
}

/**
 * Login to HYRVE AI and obtain a JWT token.
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {object} { success, token, refresh_token, user }
 */
export async function loginAndGetToken(email, password) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Login failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return {
      success: true,
      token: data.access_token || data.token,
      refresh_token: data.refresh_token,
      user: data.user,
    };
  } catch (err) {
    return { success: false, message: `Login failed: ${err.message}` };
  }
}

/**
 * Accept a proposal for an order.
 * @param {string} orderId - The order ID with the proposal
 * @returns {object} { success, order, message }
 */
export async function acceptProposal(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/accept-proposal`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Accept failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, order: data.order || data, message: 'Proposal accepted' };
  } catch (err) {
    return { success: false, message: `Could not accept proposal: ${err.message}` };
  }
}

/**
 * Reject a proposal for an order.
 * @param {string} orderId - The order ID with the proposal
 * @returns {object} { success, message }
 */
export async function rejectProposal(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/reject-proposal`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Reject failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Proposal rejected' };
  } catch (err) {
    return { success: false, message: `Could not reject proposal: ${err.message}` };
  }
}

/**
 * Send a message on an order thread.
 * @param {string} orderId - The order ID
 * @param {string} content - Message content
 * @returns {object} { success, message }
 */
export async function sendMessage(orderId, content) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/messages`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Send failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, message: data };
  } catch (err) {
    return { success: false, message: `Could not send message: ${err.message}` };
  }
}

/**
 * Get messages for an order.
 * @param {string} orderId - The order ID
 * @param {number} page - Page number (default 1)
 * @returns {object} { success, messages, total }
 */
export async function getMessages(orderId, page = 1) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/messages?page=${page}&limit=50`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, messages: data.messages || data, total: data.total || 0 };
  } catch (err) {
    return { success: false, messages: [], message: `Could not fetch messages: ${err.message}` };
  }
}

/**
 * Get unread message count for an order.
 * @param {string} orderId - The order ID
 * @returns {object} { success, count }
 */
export async function getUnreadCount(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/messages/unread`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) return { success: false, count: 0 };
    const data = await response.json();
    return { success: true, count: data.unread_count || data.count || 0 };
  } catch (err) {
    return { success: false, count: 0 };
  }
}

/**
 * Request a withdrawal from the HYRVE wallet.
 * @param {number} amountUsd - Amount in USD to withdraw
 * @param {string} method - Payment method (stripe/usdt_trc20/usdt_erc20)
 * @returns {object} { success, withdrawal }
 */
export async function requestWithdraw(amountUsd, method = 'stripe') {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/wallet/withdraw`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ amount_usd: amountUsd, method }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Withdraw failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, withdrawal: data };
  } catch (err) {
    return { success: false, message: `Withdrawal failed: ${err.message}` };
  }
}

/**
 * Get withdrawal history from the HYRVE wallet.
 * @returns {object} { success, withdrawals }
 */
export async function getWithdrawals() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/wallet/withdrawals`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) return { success: false, withdrawals: [] };
    const data = await response.json();
    return { success: true, withdrawals: data.withdrawals || data };
  } catch (err) {
    return { success: false, withdrawals: [] };
  }
}

/**
 * Claim an agent registered via SKILL.md or self-register.
 * @param {string} apiKey - The API key to claim
 * @returns {object} { success, agent, message }
 */
export async function claimAgent(apiKey) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/agents/claim`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Claim failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, agent: data.agent || data, message: 'Agent claimed successfully' };
  } catch (err) {
    return { success: false, message: `Could not claim agent: ${err.message}` };
  }
}

/**
 * Open a dispute for an order.
 * @param {string} orderId - The order ID
 * @param {string} reason - Dispute reason
 * @returns {object} { success, message }
 */
export async function openDispute(orderId, reason) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/dispute`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Dispute failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Dispute opened' };
  } catch (err) {
    return { success: false, message: `Could not open dispute: ${err.message}` };
  }
}

/**
 * Get detailed information about a specific job.
 * @param {string} jobId - The job ID
 * @returns {object} { success, job }
 */
export async function getJobDetail(jobId) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/jobs/${jobId}`, {
      headers: { 'User-Agent': `CashClaw/${VERSION}` },
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, job: data.job || data };
  } catch (err) {
    return { success: false, message: `Could not fetch job: ${err.message}` };
  }
}

// ─── v1.6.0: Full HYRVE API Coverage ────────────────────────────────────

// === AUTH ===

/**
 * Register a new user account on HYRVE AI.
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - Display name
 * @param {string} role - User role (default: 'agent_owner')
 * @returns {object} { success, user, token }
 */
export async function register(email, password, displayName, role = 'agent_owner') {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ email, password, display_name: displayName, role }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Registration failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, user: data.user || data, token: data.access_token || data.token };
  } catch (err) {
    return { success: false, message: `Registration failed: ${err.message}` };
  }
}

/**
 * Refresh an expired JWT token.
 * @param {string} refreshTokenValue - The refresh token
 * @returns {object} { success, token, refresh_token }
 */
export async function refreshToken(refreshTokenValue) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Token refresh failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, token: data.access_token || data.token, refresh_token: data.refresh_token };
  } catch (err) {
    return { success: false, message: `Token refresh failed: ${err.message}` };
  }
}

/**
 * Update the authenticated user's profile.
 * @param {object} data - Profile fields to update
 * @returns {object} { success, user }
 */
export async function updateProfile(data) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/me`, {
      method: 'PATCH',
      headers: await getAuthHeaders(config),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Profile update failed (${response.status}): ${errMsg}`);
    }
    const result = await response.json();
    return { success: true, user: result.user || result };
  } catch (err) {
    return { success: false, message: `Profile update failed: ${err.message}` };
  }
}

/**
 * Request a password reset email.
 * @param {string} email - Account email
 * @returns {object} { success, message }
 */
export async function forgotPassword(email) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Request failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, message: data.message || 'Password reset email sent' };
  } catch (err) {
    return { success: false, message: `Forgot password failed: ${err.message}` };
  }
}

/**
 * Reset password with a token.
 * @param {string} token - Reset token from email
 * @param {string} email - Account email
 * @param {string} newPassword - New password
 * @returns {object} { success, message }
 */
export async function resetPassword(token, email, newPassword) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ token, email, new_password: newPassword }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Reset failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Password reset successfully' };
  } catch (err) {
    return { success: false, message: `Password reset failed: ${err.message}` };
  }
}

/**
 * Verify email address with a token.
 * @param {string} token - Verification token from email
 * @returns {object} { success, message }
 */
export async function verifyEmail(token) {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `CashClaw/${VERSION}` },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Verification failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Email verified successfully' };
  } catch (err) {
    return { success: false, message: `Email verification failed: ${err.message}` };
  }
}

/**
 * Resend email verification for the authenticated user.
 * @returns {object} { success, message }
 */
export async function resendVerification() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Resend failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Verification email resent' };
  } catch (err) {
    return { success: false, message: `Resend failed: ${err.message}` };
  }
}

// === AGENTS ===

/**
 * Register an agent via the dashboard (authenticated).
 * @param {object} data - Agent registration data
 * @returns {object} { success, agent }
 */
export async function registerAgentDashboard(data) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/agents/register`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Agent registration failed (${response.status}): ${errMsg}`);
    }
    const result = await response.json();
    return { success: true, agent: result.agent || result, message: 'Agent registered via dashboard' };
  } catch (err) {
    return { success: false, message: `Agent registration failed: ${err.message}` };
  }
}

/**
 * Update an existing agent's details.
 * @param {string} agentId - The agent ID to update
 * @param {object} data - Fields to update
 * @returns {object} { success, agent }
 */
export async function updateAgent(agentId, data) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/agents/${agentId}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(config),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Agent update failed (${response.status}): ${errMsg}`);
    }
    const result = await response.json();
    return { success: true, agent: result.agent || result };
  } catch (err) {
    return { success: false, message: `Agent update failed: ${err.message}` };
  }
}

/**
 * Delete an agent from the marketplace.
 * @param {string} agentId - The agent ID to delete
 * @returns {object} { success, message }
 */
export async function deleteAgent(agentId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/agents/${agentId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Agent deletion failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Agent deleted successfully' };
  } catch (err) {
    return { success: false, message: `Agent deletion failed: ${err.message}` };
  }
}

// === ORDERS ===

/**
 * Create a new order on the marketplace.
 * @param {object} data - Order data (agent_id, task_description, amount_usd, etc.)
 * @returns {object} { success, order }
 */
export async function createOrder(data) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Order creation failed (${response.status}): ${errMsg}`);
    }
    const result = await response.json();
    return { success: true, order: result.order || result };
  } catch (err) {
    return { success: false, message: `Order creation failed: ${err.message}` };
  }
}

/**
 * Mark an order as completed/approved.
 * @param {string} orderId - The order ID to complete
 * @returns {object} { success, order, message }
 */
export async function completeOrder(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/complete`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Complete failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, order: data.order || data, message: 'Order completed' };
  } catch (err) {
    return { success: false, message: `Could not complete order: ${err.message}` };
  }
}

/**
 * Leave a review for a completed order.
 * @param {string} orderId - The order ID
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Review comment
 * @returns {object} { success, message }
 */
export async function reviewOrder(orderId, rating, comment) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/review`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ rating, comment }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Review failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Review submitted successfully' };
  } catch (err) {
    return { success: false, message: `Review failed: ${err.message}` };
  }
}

/**
 * Send a counter-offer for an order.
 * @param {string} orderId - The order ID
 * @param {number} amountUsd - Counter-offer amount in USD
 * @param {string} message - Optional message with the counter-offer
 * @returns {object} { success, order, message }
 */
export async function counterOffer(orderId, amountUsd, message = '') {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/counter-offer`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ amount_usd: amountUsd, message }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Counter-offer failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, order: data.order || data, message: 'Counter-offer sent' };
  } catch (err) {
    return { success: false, message: `Counter-offer failed: ${err.message}` };
  }
}

/**
 * Accept a counter-offer on an order.
 * @param {string} orderId - The order ID
 * @returns {object} { success, order, message }
 */
export async function acceptCounter(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}/accept-counter`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Accept counter failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, order: data.order || data, message: 'Counter-offer accepted' };
  } catch (err) {
    return { success: false, message: `Accept counter failed: ${err.message}` };
  }
}

// === PAYMENTS ===

/**
 * Create a payment proposal for an agent's service.
 * @param {string} agentId - The agent ID
 * @param {string} taskDescription - Description of the task
 * @returns {object} { success, proposal }
 */
export async function propose(agentId, taskDescription) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/payments/propose`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ agent_id: agentId, task_description: taskDescription }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Proposal failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, proposal: data.proposal || data };
  } catch (err) {
    return { success: false, message: `Proposal failed: ${err.message}` };
  }
}

/**
 * Create a Stripe checkout session for an order.
 * @param {string} orderId - The order ID to pay
 * @returns {object} { success, checkout_url }
 */
export async function checkout(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/payments/checkout`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Checkout failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, checkout_url: data.checkout_url || data.url, session: data };
  } catch (err) {
    return { success: false, message: `Checkout failed: ${err.message}` };
  }
}

/**
 * Verify payment status for an order.
 * @param {string} orderId - The order ID to verify
 * @returns {object} { success, payment_status }
 */
export async function verifyPayment(orderId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/payments/verify`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Verify failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, payment_status: data.status || data.payment_status, data };
  } catch (err) {
    return { success: false, message: `Payment verification failed: ${err.message}` };
  }
}

/**
 * Get payment configuration (supported methods, fees, etc.).
 * @returns {object} { success, config }
 */
export async function getPaymentConfig() {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/payments/config`, {
      headers: { 'User-Agent': `CashClaw/${VERSION}` },
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, config: data };
  } catch (err) {
    return { success: false, message: `Could not fetch payment config: ${err.message}` };
  }
}

// === API KEYS ===

/**
 * Create a new API key.
 * @param {string} label - Label/description for the key
 * @returns {object} { success, key }
 */
export async function createApiKey(label) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/keys`, {
      method: 'POST',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({ label }),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Key creation failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, key: data.key || data.api_key, data };
  } catch (err) {
    return { success: false, message: `API key creation failed: ${err.message}` };
  }
}

/**
 * List all API keys for the authenticated user.
 * @returns {object} { success, keys }
 */
export async function listApiKeys() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/keys`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, keys: data.keys || data };
  } catch (err) {
    return { success: false, keys: [], message: `Could not fetch API keys: ${err.message}` };
  }
}

/**
 * Revoke (delete) an API key.
 * @param {string} keyId - The key ID to revoke
 * @returns {object} { success, message }
 */
export async function revokeApiKey(keyId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/keys/${keyId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Revoke failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'API key revoked' };
  } catch (err) {
    return { success: false, message: `Key revocation failed: ${err.message}` };
  }
}

// === ADMIN ===

/**
 * Get admin dashboard statistics.
 * @returns {object} { success, stats }
 */
export async function adminGetStats() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/stats`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Admin stats failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, stats: data.stats || data };
  } catch (err) {
    return { success: false, message: `Admin stats failed: ${err.message}` };
  }
}

/**
 * List all users (admin only).
 * @param {number} page - Page number (default 1)
 * @param {number} limit - Results per page (default 20)
 * @returns {object} { success, users, total }
 */
export async function adminListUsers(page = 1, limit = 20) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/users?page=${page}&limit=${limit}`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Admin users failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, users: data.users || data, total: data.total || 0 };
  } catch (err) {
    return { success: false, users: [], message: `Admin users failed: ${err.message}` };
  }
}

/**
 * Ban a user (admin only).
 * @param {string} userId - The user ID to ban
 * @returns {object} { success, message }
 */
export async function adminBanUser(userId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Ban failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'User banned' };
  } catch (err) {
    return { success: false, message: `Ban failed: ${err.message}` };
  }
}

/**
 * Unban a user (admin only).
 * @param {string} userId - The user ID to unban
 * @returns {object} { success, message }
 */
export async function adminUnbanUser(userId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/users/${userId}/unban`, {
      method: 'PUT',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Unban failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'User unbanned' };
  } catch (err) {
    return { success: false, message: `Unban failed: ${err.message}` };
  }
}

/**
 * List all orders (admin only).
 * @param {string} status - Filter by status (optional)
 * @param {number} page - Page number (default 1)
 * @returns {object} { success, orders, total }
 */
export async function adminListOrders(status, page = 1) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  const qs = status ? `?status=${status}&page=${page}` : `?page=${page}`;
  try {
    const response = await fetch(`${apiUrl}/admin/orders${qs}`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Admin orders failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, orders: data.orders || data, total: data.total || 0 };
  } catch (err) {
    return { success: false, orders: [], message: `Admin orders failed: ${err.message}` };
  }
}

/**
 * List all agents (admin only).
 * @param {number} page - Page number (default 1)
 * @returns {object} { success, agents, total }
 */
export async function adminListAgents(page = 1) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/agents?page=${page}`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Admin agents failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, agents: data.agents || data, total: data.total || 0 };
  } catch (err) {
    return { success: false, agents: [], message: `Admin agents failed: ${err.message}` };
  }
}

/**
 * Delist an agent from the marketplace (admin only).
 * @param {string} agentId - The agent ID to delist
 * @returns {object} { success, message }
 */
export async function adminDelistAgent(agentId) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/agents/${agentId}/delist`, {
      method: 'PUT',
      headers: await getAuthHeaders(config),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Delist failed (${response.status}): ${errMsg}`);
    }
    return { success: true, message: 'Agent delisted' };
  } catch (err) {
    return { success: false, message: `Delist failed: ${err.message}` };
  }
}

/**
 * Get all open disputes (admin only).
 * @returns {object} { success, disputes }
 */
export async function adminGetDisputes() {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/admin/disputes`, {
      headers: await getAuthHeaders(config),
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Admin disputes failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, disputes: data.disputes || data };
  } catch (err) {
    return { success: false, disputes: [], message: `Admin disputes failed: ${err.message}` };
  }
}

// === OTHER ===

/**
 * Get public platform statistics.
 * @returns {object} { success, stats }
 */
export async function getPlatformStats() {
  const apiUrl = await getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/stats`, {
      headers: { 'User-Agent': `CashClaw/${VERSION}` },
    });
    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      throw new Error(`Stats fetch failed (${response.status}): ${errMsg}`);
    }
    const data = await response.json();
    return { success: true, stats: data.stats || data };
  } catch (err) {
    return { success: false, message: `Platform stats unavailable: ${err.message}` };
  }
}

/**
 * Upload a file as a message attachment on an order.
 * Note: File uploads require multipart/form-data. For large files,
 * use the HYRVE AI dashboard at app.hyrveai.com.
 * @param {string} orderId - The order ID
 * @param {string} filePath - Local file path to upload
 * @returns {object} { success, message }
 */
export async function uploadFile(orderId, filePath) {
  const config = await loadConfig();
  const apiUrl = await getApiUrl();
  try {
    const { createReadStream, statSync } = await import('fs');
    const { basename } = await import('path');

    // Check file exists
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return { success: false, message: `Not a file: ${filePath}` };
    }

    const fileName = basename(filePath);
    const boundary = `----CashClawBoundary${Date.now()}`;
    const headers = await getAuthHeaders(config);
    delete headers['Content-Type'];
    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;

    // For simplicity, recommend dashboard for file uploads
    return {
      success: false,
      message: `File upload for "${fileName}" is available via the HYRVE AI dashboard. Visit: https://app.hyrveai.com/orders/${orderId}`,
      info: 'CLI file upload requires form-data package. Use: npm install form-data',
    };
  } catch (err) {
    return { success: false, message: `File upload failed: ${err.message}` };
  }
}
