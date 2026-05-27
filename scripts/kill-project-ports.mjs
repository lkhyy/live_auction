#!/usr/bin/env node
/**
 * Check and kill processes occupying live-auction project ports.
 *
 * Usage:
 *   node scripts/kill-project-ports.mjs           # check only
 *   node scripts/kill-project-ports.mjs --kill    # kill dev ports (3000,5173,5174)
 *   node scripts/kill-project-ports.mjs --kill --all --yes
 *   node scripts/kill-project-ports.mjs --kill --port 5173 --yes
 */
import { execSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const PORT_DEFS = [
  { port: 3000, label: 'API (NestJS)', group: 'dev', envKey: 'PORT' },
  { port: 5173, label: 'Web H5 (Vite)', group: 'dev' },
  { port: 5174, label: 'Admin (Vite)', group: 'dev' },
  { port: 3306, label: 'MySQL', group: 'infra' },
  { port: 6379, label: 'Redis', group: 'infra' },
  { port: 80, label: 'Nginx (full stack)', group: 'docker' },
  { port: 8081, label: 'Redis Commander', group: 'docker' },
];

function loadEnvPort() {
  const envFile = resolve(root, '.env');
  if (!existsSync(envFile)) return null;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^PORT=(.+)$/);
    if (m) return Number(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return null;
}

function parseArgs(argv) {
  const opts = { kill: false, all: false, yes: false, ports: [] };
  for (const arg of argv) {
    if (arg === '--kill') opts.kill = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--yes' || arg === '-y') opts.yes = true;
    else if (arg.startsWith('--port=')) opts.ports.push(Number(arg.slice(7)));
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

function getProcessName(pid) {
  if (isWin) {
    const out = trySh(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const m = out.match(/^"([^"]+)"/);
    return m ? m[1] : 'unknown';
  }
  return trySh(`ps -p ${pid} -o comm=`) || 'unknown';
}

function getWindowsListeners(port) {
  const out = trySh('netstat -ano');
  if (!out) return [];
  const pids = new Set();
  const re = new RegExp(`:${port}\\s+`, 'i');
  for (const line of out.split('\n')) {
    if (!/LISTENING/i.test(line) || !re.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts.at(-1);
    if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
  }
  return [...pids].map((pid) => ({
    pid: Number(pid),
    process: getProcessName(pid),
  }));
}

function getUnixListeners(port) {
  let pids = trySh(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`);
  if (!pids) {
    const ss = trySh(`ss -H -ltnp 'sport = :${port}'`);
    if (ss) {
      const found = new Set();
      for (const m of ss.matchAll(/pid=(\d+)/g)) found.add(m[1]);
      pids = [...found].join('\n');
    }
  }
  if (!pids) return [];
  return [...new Set(pids.split('\n').filter(Boolean))].map((pid) => ({
    pid: Number(pid),
    process: getProcessName(pid),
  }));
}

function getListeners(port) {
  return isWin ? getWindowsListeners(port) : getUnixListeners(port);
}

function isDockerish(processName) {
  const n = processName.toLowerCase();
  return (
    n.includes('docker') ||
    n.includes('com.docker') ||
    n.includes('wslrelay') ||
    n.includes('vpnkit') ||
    n.includes('limactl')
  );
}

function resolveTargetPorts(opts) {
  const apiPort = loadEnvPort();
  let defs = PORT_DEFS.map((d) =>
    d.envKey === 'PORT' && apiPort ? { ...d, port: apiPort } : d,
  );

  if (opts.ports.length) {
    const set = new Set(opts.ports);
    defs = defs.filter((d) => set.has(d.port));
    for (const p of opts.ports) {
      if (!defs.some((d) => d.port === p)) {
        defs.push({ port: p, label: `Custom :${p}`, group: 'custom' });
      }
    }
  } else if (!opts.all) {
    defs = defs.filter((d) => d.group === 'dev');
  }

  return defs;
}

function scanPorts(defs) {
  const rows = [];
  for (const def of defs) {
    const listeners = getListeners(def.port);
    rows.push({ ...def, listeners, occupied: listeners.length > 0 });
  }
  return rows;
}

function printReport(rows, { killing } = {}) {
  console.log(killing ? '\nKilling project port listeners...\n' : '\nProject port status:\n');
  console.log(
    `${'PORT'.padEnd(6)} ${'SERVICE'.padEnd(22)} ${'STATUS'.padEnd(10)} PID / PROCESS`,
  );
  console.log('-'.repeat(70));

  for (const row of rows) {
    const status = row.occupied ? 'IN USE' : 'free';
    if (!row.occupied) {
      console.log(`${String(row.port).padEnd(6)} ${row.label.padEnd(22)} ${status}`);
      continue;
    }
    for (const [i, l] of row.listeners.entries()) {
      const svc = i === 0 ? row.label : '';
      const portCol = i === 0 ? String(row.port) : '';
      const statCol = i === 0 ? status : '';
      console.log(
        `${portCol.padEnd(6)} ${svc.padEnd(22)} ${statCol.padEnd(10)} ${l.pid} ${l.process}`,
      );
    }
  }

  const used = rows.filter((r) => r.occupied);
  console.log(`\n${used.length}/${rows.length} port(s) in use.`);
  if (!killing && used.length) {
    console.log('Kill dev servers: npm run ports:kill');
    console.log('Kill all (incl. infra): npm run ports:kill -- --all --yes');
  }
}

function killPid(pid) {
  if (isWin) {
    spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
  } else {
    spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
  }
}

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(`${message} [y/N] `, res));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function killListeners(rows, opts) {
  const toKill = [];
  for (const row of rows) {
    if (!row.occupied) continue;
    for (const l of row.listeners) {
      if (row.group !== 'dev' && row.group !== 'custom' && isDockerish(l.process)) {
        console.warn(
          `Skip :${row.port} PID ${l.pid} (${l.process}) — Docker/infra; use docker compose stop`,
        );
        continue;
      }
      toKill.push({ port: row.port, label: row.label, ...l });
    }
  }

  if (!toKill.length) {
    console.log('\nNothing to kill.');
    return;
  }

  console.log('\nWill kill:');
  for (const t of toKill) {
    console.log(`  :${t.port} ${t.label} → PID ${t.pid} (${t.process})`);
  }

  if (!opts.yes && !(await confirm('\nProceed?'))) {
    console.log('Cancelled.');
    return;
  }

  for (const t of toKill) {
    killPid(t.pid);
    console.log(`✓ Killed PID ${t.pid} (:${t.port})`);
  }

  await new Promise((r) => setTimeout(r, 400));
  printReport(scanPorts(rows.map(({ port, label, group, envKey }) => ({ port, label, group, envKey }))), {
    killing: true,
  });
}

function printHelp() {
  console.log(`Usage: node scripts/kill-project-ports.mjs [options]

Options:
  (default)       Check project ports (no kill)
  --kill          Kill listeners on selected ports
  --all           Include infra/docker ports (3306,6379,80,8081); default is dev only
  --port=5173     Target specific port (repeatable)
  --yes, -y       Skip confirmation
  -h, --help      Show this help

npm shortcuts:
  npm run ports:check
  npm run ports:kill
  npm run ports:kill -- --all --yes
`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const defs = resolveTargetPorts(opts);
  const rows = scanPorts(defs);

  if (!opts.kill) {
    printReport(rows);
    return;
  }

  await killListeners(rows, opts);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
