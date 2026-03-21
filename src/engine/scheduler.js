import { listMissions } from './mission-runner.js';
import { loadConfig } from '../cli/utils/config.js';

let heartbeatTimer = null;
let isRunning = false;

/**
 * Start the heartbeat scheduler that periodically checks for
 * pending missions and unpaid invoices.
 * @param {number} intervalMs - Interval in milliseconds (default: 60000)
 */
export function startHeartbeat(intervalMs = 60000) {
  if (isRunning) {
    console.log('[scheduler] Heartbeat already running.');
    return;
  }

  isRunning = true;
  console.log(`[scheduler] Heartbeat started (interval: ${intervalMs}ms)`);

  // Run immediately on start
  tick();

  heartbeatTimer = setInterval(tick, intervalMs);
}

/**
 * Stop the heartbeat scheduler.
 */
export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  isRunning = false;
  console.log('[scheduler] Heartbeat stopped.');
}

/**
 * Single tick of the heartbeat: check pending work.
 */
async function tick() {
  try {
    await checkPendingMissions();
    await checkUnpaidInvoices();
  } catch (err) {
    console.error(`[scheduler] Heartbeat tick error: ${err.message}`);
  }
}

/**
 * Check for missions that are created but not started,
 * or in_progress missions that may need attention.
 * @returns {object} Summary of pending missions
 */
export async function checkPendingMissions() {
  try {
    const created = await listMissions('created');
    const inProgress = await listMissions('in_progress');

    const summary = {
      pending_start: created.length,
      in_progress: inProgress.length,
      missions_needing_attention: [],
    };

    // Flag missions that have been in_progress for more than 24 hours
    const now = Date.now();
    for (const mission of inProgress) {
      const startedAt = new Date(mission.started_at).getTime();
      const hoursElapsed = (now - startedAt) / (1000 * 60 * 60);
      if (hoursElapsed > mission.estimated_hours * 2) {
        summary.missions_needing_attention.push({
          id: mission.id,
          name: mission.name,
          hours_elapsed: Math.round(hoursElapsed * 10) / 10,
          estimated_hours: mission.estimated_hours,
        });
      }
    }

    if (summary.pending_start > 0 || summary.missions_needing_attention.length > 0) {
      console.log(
        `[scheduler] Pending: ${summary.pending_start} to start, ` +
        `${summary.in_progress} in progress, ` +
        `${summary.missions_needing_attention.length} overdue`
      );
    }

    return summary;
  } catch (err) {
    console.error(`[scheduler] Error checking pending missions: ${err.message}`);
    return { pending_start: 0, in_progress: 0, missions_needing_attention: [] };
  }
}

/**
 * Check for completed missions that haven't been paid yet.
 * @returns {object} Summary of unpaid invoices
 */
export async function checkUnpaidInvoices() {
  try {
    const completed = await listMissions('completed');

    const unpaid = completed.filter(
      (m) => m.payment && m.payment.status === 'unpaid'
    );

    const summary = {
      unpaid_count: unpaid.length,
      unpaid_total: unpaid.reduce((sum, m) => sum + (m.price_usd || 0), 0),
      unpaid_missions: unpaid.map((m) => ({
        id: m.id,
        name: m.name,
        amount: m.price_usd,
        client: m.client?.name || 'Unknown',
        completed_at: m.completed_at,
      })),
    };

    if (summary.unpaid_count > 0) {
      console.log(
        `[scheduler] Unpaid invoices: ${summary.unpaid_count} ($${summary.unpaid_total})`
      );
    }

    return summary;
  } catch (err) {
    console.error(`[scheduler] Error checking unpaid invoices: ${err.message}`);
    return { unpaid_count: 0, unpaid_total: 0, unpaid_missions: [] };
  }
}

/**
 * Check if heartbeat is currently running.
 */
export function isHeartbeatRunning() {
  return isRunning;
}

// ─── v1.6.0: Job Polling Daemon ─────────────────────────────────────────

let jobPollerTimer = null;
let isPollerRunning = false;

/**
 * Start the job polling daemon that periodically checks the HYRVE marketplace
 * for new jobs and optionally auto-accepts them based on config.
 * @param {number} intervalMs - Polling interval in milliseconds (default: 60000)
 * @returns {object} The interval timer (can be cleared with clearInterval)
 */
export async function startJobPoller(intervalMs = 60000) {
  if (isPollerRunning) {
    console.log('[Poller] Job poller already running.');
    return jobPollerTimer;
  }

  const { listAvailableJobs, acceptJob, syncStatus } = await import('../integrations/hyrve-bridge.js');

  console.log(`[Poller] Starting job poller (every ${intervalMs / 1000}s)`);
  isPollerRunning = true;

  async function poll() {
    try {
      const config = await loadConfig();

      // Send heartbeat to HYRVE
      await syncStatus().catch(() => {});

      // Check for new jobs
      const result = await listAvailableJobs();
      const jobs = result?.jobs || [];

      if (jobs.length > 0) {
        console.log(`[Poller] Found ${jobs.length} available job(s)`);
      }

      if (jobs.length > 0 && config.hyrve?.auto_accept) {
        const maxUsd = config.hyrve?.auto_accept_max_usd || config.hyrve?.max_accept_usd || 100;
        for (const job of jobs) {
          const budget = parseFloat(job.budget_usd || 0);
          if (budget <= maxUsd && budget > 0) {
            console.log(`[Poller] Auto-accepting job: ${job.title} ($${budget})`);
            await acceptJob(job.id).catch(e => console.error(`[Poller] Accept failed: ${e.message}`));
          }
        }
      }
    } catch (err) {
      console.error(`[Poller] Error: ${err.message}`);
    }
  }

  // Initial poll
  await poll();
  // Repeat
  jobPollerTimer = setInterval(poll, intervalMs);
  return jobPollerTimer;
}

/**
 * Stop the job polling daemon.
 */
export function stopJobPoller() {
  if (jobPollerTimer) {
    clearInterval(jobPollerTimer);
    jobPollerTimer = null;
  }
  isPollerRunning = false;
  console.log('[Poller] Job poller stopped.');
}

/**
 * Check if the job poller is currently running.
 */
export function isPollerActive() {
  return isPollerRunning;
}
