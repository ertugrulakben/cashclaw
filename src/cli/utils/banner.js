import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'));

const orange = chalk.hex('#FF6B35');
const green = chalk.hex('#16C784');
const dim = chalk.dim;

const LOGO = `
   ___           _      ___ _
  / __\\__ _ ___| |__  / __\\ | __ ___      __
 / /  / _\` / __| '_ \\/ /  | |/ _\` \\ \\ /\\ / /
/ /__| (_| \\__ \\ | | / /___| | (_| |\\ V  V /
\\____/\\__,_|___/_| |_\\____/|_|\\__,_| \\_/\\_/
`;

export function showBanner() {
  const logoColored = orange.bold(LOGO);
  const version = dim(`v${pkg.version}`);
  const tagline = green('Turn your AI agent into a freelance business');
  const site = dim('https://cashclawai.com');

  const content = `${logoColored}
  ${tagline}  ${version}
  ${site}`;

  const banner = boxen(content, {
    padding: { top: 0, bottom: 1, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: '#FF6B35',
    dimBorder: false,
  });

  console.log(banner);
  console.log();
}

export function showMiniBanner() {
  console.log(
    orange.bold('\n  CashClaw') +
    dim(` v${pkg.version}`) +
    green(' | ') +
    dim('cashclawai.com\n')
  );
}
