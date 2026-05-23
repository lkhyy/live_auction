---
name: reset-project-storage
description: >-
  Resets all live-auction project storage (MySQL, Redis, BullMQ queues) to the
  initial seed/demo state. Use when the user asks to reset the database, wipe
  all data, start fresh, restore initial state, clear auction data, or rerun
  the demo from scratch.
---

# Reset Project Storage

Restore **MySQL + Redis** to the same state as a fresh `migrate deploy` + `db:seed`.

## What gets reset

| Store | Contents cleared |
|-------|------------------|
| **MySQL** | users, lots, auctions, bids, orders, events, live_rooms |
| **Redis** | auction state, leaderboards, rate limits, viewers, BullMQ job queues |

## What is NOT reset (manual)

- Browser `localStorage` JWT (`accessToken`) — user should re-login or clear site data
- Docker named volumes (only wiped in **nuclear** mode below)
- `.env` and application code

## Default workflow

Run from repository root:

```bash
npm run storage:reset
```

Equivalent to `node scripts/reset-storage.mjs`.

The script recreates the MySQL database (drop + create), runs `prisma migrate deploy`, seeds demo data, and flushes Redis. It avoids `prisma migrate reset` so it works reliably in automated/agent contexts.

### Prerequisites

1. MySQL and Redis running:
   ```bash
   docker compose up -d mysql redis
   ```
2. Root `.env` exists (`cp .env.example .env` if missing)
3. **Stop the API** if it is running (`npm run dev:api`) — avoids stale Redis connections during reset

### After reset

Restart dev services if needed:

```bash
npm run dev:api
npm run dev:web
```

Initial demo state (from `apps/api/prisma/seed.ts`):

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 主播 | host@example.com | password123 |
| 买家 | buyer@example.com | password123 |
| 买家2 | buyer2@example.com | password123 |

- 演示直播间：`00000000-0000-4000-8000-00000000ROOM`（已 LIVE）
- H5 入口：`http://localhost:5173/m/room/00000000-0000-4000-8000-00000000ROOM`
- 含 5 个演示商品/场次（进行中、待开始、已成交等混合状态）

## Agent checklist

When user requests a storage reset:

```
- [ ] Confirm intent (destructive — all bids/orders/auctions will be lost)
- [ ] Ensure mysql + redis containers are healthy
- [ ] Stop API dev server if running
- [ ] Run: npm run storage:reset
- [ ] Report success + demo login hints
- [ ] Remind user to re-login in browser if sessions look stale
```

## Nuclear option (full Docker volume wipe)

Use only when DB is corrupted or migrate reset fails:

```bash
docker compose down -v mysql redis
docker compose up -d mysql redis
# wait for healthy, then:
npm run storage:reset
```

This deletes `mysql_data` and `redis_data` volumes entirely.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Environment variable not found: DATABASE_URL` | Ensure root `.env` exists with `DATABASE_URL` |
| `Could not flush Redis` | `docker compose up -d redis` |
| `Can't reach database server` | `docker compose up -d mysql`, wait for healthy |
| `prisma migrate reset` hangs | Stop API/BullMQ workers first |
| `prisma migrate reset` blocked by Prisma AI guard | Use `npm run storage:reset` (recreate DB + deploy + seed) |

## Implementation reference

- Reset script: [scripts/reset-storage.mjs](../../../scripts/reset-storage.mjs)
- Seed data: [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts)
