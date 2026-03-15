import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { loadConfig } from '../utils/config.js';
import { createDashboardServer } from '../../dashboard/server.js';
import { showMiniBanner } from '../utils/banner.js';

const orange = chalk.hex('#FF6B35');
const green = chalk.hex('#16C784');
const dim = chalk.dim;

/**
 * Recursively attempts to start the server on the given port.
 * If the port is in use, it increments and tries again.
 */
async function startServer(app, port, host, limit = 10) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      resolve({ server, usedPort: port });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && limit > 0) {
        // Port taken, try the next one
        resolve(startServer(app, port + 1, host, limit - 1));
      } else {
        reject(err);
      }
    });
  });
}

export async function runDashboard(options = {}) {
  showMiniBanner();

  const config = await loadConfig();
  const startPort = options.port || config.server.port || 3847; //
  const host = config.server.host || 'localhost';

  const spinner = ora('Starting dashboard server...').start();

  try {
    const app = createDashboardServer();

    // CALL THE HELPER HERE
    const { server, usedPort } = await startServer(app, startPort, host);

    const url = `http://${host}:${usedPort}`;
    spinner.succeed(`Dashboard running at ${green.bold(url)}`);
    
    if (usedPort !== startPort) {
      console.log(dim(`  (Note: Port ${startPort} was busy, switched to ${usedPort})`));
    }

    console.log();
    console.log(`  ${orange('API Endpoints:')}`);
    console.log(`  ${dim('GET')}  ${url}/api/status`);
    console.log(`  ${dim('GET')}  ${url}/api/missions`);
    console.log(`  ${dim('GET')}  ${url}/api/earnings`);
    console.log(`  ${dim('GET')}  ${url}/api/skills`);
    console.log(`  ${dim('POST')} ${url}/api/config`);
    console.log();
    console.log(dim('  Press Ctrl+C to stop the server.\n'));

    // Auto-open browser unless --no-open flag
    if (!options.noOpen) {
      try {
        await open(url);
      } catch {
        console.log(dim(`  Could not auto-open browser. Visit ${url} manually.\n`));
      }
    }

    // Keep process alive
    process.on('SIGINT', () => {
      console.log(dim('\n  Dashboard stopped.\n'));
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      process.exit(0);
    });
  } catch (err) {
    spinner.fail(err.message);
    process.exit(1);
  }
}
