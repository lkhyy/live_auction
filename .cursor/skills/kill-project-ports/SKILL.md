---
name: kill-project-ports
description: >-
  Checks live-auction project port usage (3000, 5173, 5174, 3306, 6379, etc.)
  and kills occupying processes on request. Use when ports are in use, dev
  servers fail to start, EADDRINUSE, address already in use, or the user asks
  to free/kill/release project ports.
---

# Kill Project Ports

检查并释放本项目占用的端口。

## 项目端口一览

| 端口 | 服务 | 分组 | 默认 kill |
|------|------|------|-----------|
| 3000 | API (NestJS) | dev | ✅ |
| 5173 | 用户端 H5 (Vite) | dev | ✅ |
| 5174 | 管理后台 (Vite) | dev | ✅ |
| 3306 | MySQL | infra | 仅 `--all` |
| 6379 | Redis | infra | 仅 `--all` |
| 80 | Nginx (full stack) | docker | 仅 `--all` |
| 8081 | Redis Commander | docker | 仅 `--all` |

API 端口会读取根目录 `.env` 中的 `PORT`（若存在）。

## 命令

```bash
# 仅查看占用（不杀进程）
npm run ports:check

# 释放 dev 端口（3000 / 5173 / 5174）
npm run ports:kill

# 跳过确认（Agent 或 CI 用）
npm run ports:kill -- --yes

# 含基础设施端口（慎用）
npm run ports:kill -- --all --yes

# 指定端口
node scripts/kill-project-ports.mjs --kill --port=5173 --yes
```

## 安全规则

| 规则 | 说明 |
|------|------|
| 默认只杀 **dev** | 不动 MySQL/Redis，除非 `--all` |
| Docker 进程 | 识别 `docker` / `com.docker` / `wslrelay` 等时**跳过**，提示 `docker compose stop` |
| 需确认 | 无 `--yes` 时会询问 `Proceed?`；用户明确说「kill/释放」时 Agent 可加 `--yes` |
| 不杀无关端口 | 仅处理上表端口或 `--port=` 指定项 |

## Agent 检查清单

**用户说「端口被占用 / 起不来 / EADDRINUSE」：**

```
- [ ] 运行 npm run ports:check，汇报占用 PID 与进程名
- [ ] 若需释放：npm run ports:kill -- --yes
- [ ] 若 infra 端口冲突：建议 docker compose stop mysql redis，而非盲目 kill
- [ ] kill 后再次 ports:check 确认 free
- [ ] 提示用户重新 npm run dev:api / dev:web / dev:admin
```

**用户只说「查一下端口」：** 只跑 `ports:check`，不 kill。

## 典型场景

| 现象 | 处理 |
|------|------|
| `Error: listen EADDRINUSE :::3000` | `npm run ports:kill -- --yes` |
| 5173 被旧 Vite 占用 | `npm run ports:kill -- --port=5173 --yes` |
| 3306 被占且进程是 Docker | `docker compose stop mysql`，不用 kill |
| 5174 无服务但显示 IN USE | kill 5174 后 `npm run dev:admin` |

## 实现

- 脚本：[scripts/kill-project-ports.mjs](../../../scripts/kill-project-ports.mjs)
- Windows：`netstat -ano` + `taskkill /F`
- macOS/Linux：`lsof` 或 `ss` + `kill -9`
