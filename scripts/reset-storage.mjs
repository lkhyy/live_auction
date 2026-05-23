#!/usr/bin/env node
/**
 * Reset all project storage to initial seed state:
 * - Redis: auction state, BullMQ queues, rate limits, viewers
 * - MySQL: recreate database, apply migrations, run seed
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'apps/api');

function loadEnv() {
  const env = { ...process.env };
  for (const file of [resolve(root, '.env'), resolve(apiDir, '.env')]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    cwd: opts.cwd ?? root,
    env: opts.env ?? process.env,
  });
}

function tryRun(cmd, opts = {}) {
  try {
    run(cmd, opts);
    return true;
  } catch {
    return false;
  }
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '3306',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

function flushRedis() {
  console.log('\n=== Step 1/3: Flush Redis ===');

  if (tryRun('docker exec live_auction_redis redis-cli FLUSHALL')) {
    console.log('Redis flushed via Docker container live_auction_redis');
    return;
  }

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  if (tryRun(`redis-cli -u "${redisUrl}" FLUSHALL`)) {
    console.log('Redis flushed via local redis-cli');
    return;
  }

  throw new Error(
    'Could not flush Redis. Start Docker: docker compose up -d redis',
  );
}

function recreateDatabase(dbEnv) {
  console.log('\n=== Step 2/3: Recreate MySQL database ===');
  const url =
    dbEnv.DATABASE_URL ??
    'mysql://auction:auction@localhost:3306/live_auction';
  const { host, port, user, password, database } = parseDatabaseUrl(url);
  const sql = `DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\`;`;

  const dockerCmd =
    `docker exec live_auction_mysql mysql -u${user} -p${password} -e "${sql}"`;
  if (tryRun(dockerCmd)) {
    console.log(`Database ${database} recreated via Docker`);
    return;
  }

  const mysqlCmd =
    `mysql -h${host} -P${port} -u${user} -p${password} -e "${sql}"`;
  if (tryRun(mysqlCmd, { env: dbEnv })) {
    console.log(`Database ${database} recreated via local mysql client`);
    return;
  }

  throw new Error(
    'Could not recreate database. Start Docker: docker compose up -d mysql',
  );
}

function migrateAndSeed(dbEnv) {
  console.log('\n=== Step 3/3: Apply migrations & seed ===');
  run('npx prisma migrate deploy', { cwd: apiDir, env: dbEnv });
  run('npx prisma generate', { cwd: apiDir, env: dbEnv });
  run('npm run db:seed', { cwd: apiDir, env: dbEnv });
}

const env = loadEnv();
console.log('Resetting live-auction storage to initial state...\n');

flushRedis();
recreateDatabase(env);
migrateAndSeed(env);

console.log('\n✓ Storage reset complete.');
console.log('  Demo accounts: host@example.com / buyer@example.com (password123)');
console.log('  Demo live room: 00000000-0000-4000-8000-00000000ROOM');
console.log('  H5: /m/room/00000000-0000-4000-8000-00000000ROOM');
console.log('  Tip: clear browser localStorage (accessToken) or re-login in the web app.');
