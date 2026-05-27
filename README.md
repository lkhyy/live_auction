# 面向直播电商的高并发实时竞拍平台 (Live Auction)

高并发直播场景下的实时竞拍平台：React + Socket.io 前端，NestJS + MySQL + Redis + BullMQ 后端。

**交付材料**：[docs/交付说明.md](docs/交付说明.md)（赛方 14 项对照） · [docs/部署指南.md](docs/部署指南.md)（公网部署）

## 在线体验

| 环境 | 用户端 | 管理端 |
|------|--------|--------|
| **公网（部署后填写）** | `https://YOUR_DOMAIN/m` | `https://YOUR_DOMAIN/admin/` |
| **本地开发** | http://localhost:5173/m | http://localhost:5174 |

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 主播 | host@example.com | password123 |
| 买家 | buyer@example.com | password123 |

**演示视频**：_（提交前填写公开链接，拍摄脚本见 [docs/demo-scripts/录屏检查清单.md](docs/demo-scripts/录屏检查清单.md)）_

## 源代码仓库

- **主仓库**：https://github.com/lkhyy/live_auction  
- **主分支**：`main`（monorepo：`apps/api`、`apps/web`、`packages/shared`）

## 功能

- 商品上架与管理（管理端直播控制台内一体化创建）
- 竞拍规则配置（起拍价、固定加价、封顶价、软关闭延时、主播取消）
- HTTP 出价 + Redis Lua 原子校验
- WebSocket 实时排名与毫秒级倒计时（服务端权威时钟）
- **管理后台**（5174）：直播控制台 + 订单管理
- **用户端 H5**（5173）：直播大厅、我参与的拍品、订单
- 完整方案见 [docs/项目开发.md](docs/项目开发.md)

## 快速开始

### 1. 启动基础设施

```bash
docker compose up -d mysql redis
```

### 2. 配置环境

```bash
cp .env.example .env
```

### 3. 安装依赖

```bash
npm install
npm run build -w @live-auction/shared
```

### 4. 数据库迁移与种子

```bash
cd apps/api
npx prisma migrate dev --name init
npm run db:seed
```

或在仓库根目录一键重置存储（MySQL + Redis + seed）：

```bash
npm run storage:reset
```

### 5. 启动开发服务

```bash
# 终端 1 - API
npm run dev:api

# 终端 2 - 用户端 H5（买家）
npm run dev:web

# 终端 3 - 管理后台（主播，须单独启动，端口 5174）
npm run dev:admin
```

> 注意：`dev:web` 只开 **5173 用户端**；管理端必须再跑 `dev:admin`。只开 web 时 5174 不会有服务。

- API / Swagger: http://localhost:3000 · http://localhost:3000/docs
- **用户端 H5**（买家）: http://localhost:5173 → 登录后 `/m`
- **管理后台**（主播）: http://localhost:5174 → 登录后进入 **直播控制台**
- 演示橱窗: http://localhost:5173/m/room/00000000-0000-4000-8000-00000000ROOM

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run storage:reset` | 重置 MySQL + Redis 并重新 seed |
| `npm run ports:check` | 检查 3000 / 5173 / 5174 端口占用 |
| `npm run ports:kill` | 释放上述端口（开发冲突时使用） |
| `npm run dev:web:fresh` | 用户端白屏时：清 Vite 缓存并重启 |

### 手机 / 局域网访问（192.168.x）

1. 用户端须已 `host: true`（`vite.config.ts` 默认已开），终端里应能看到 `Network: http://192.168.x.x:5173/`。
2. 手机与电脑同一 WiFi，浏览器打开该 **Network** 地址（不要用 `localhost`）。
3. 本机同时运行 `npm run dev:api`；开发模式下 API 经 Vite 代理，无需改 `VITE_API_URL`。
4. Windows 防火墙若拦截，放行 Node 的 **5173**、**3000** 端口。

### 用户端白屏

多为 Vite 依赖缓存过期（浏览器控制台可见 `504 Outdated Optimize Dep`）：

```bash
npm run ports:kill -- --port=5173 --yes
npm run dev:web:fresh
```

然后访问 **http://localhost:5173/m**（`127.0.0.1` 亦可；若仍打不开，优先用 `localhost` 并确认已重启 `dev:web`）。

### 演示账号

| 角色 | 邮箱 | 密码 | 入口 |
|------|------|------|------|
| 主播 | host@example.com | password123 | http://localhost:5174 |
| 买家 | buyer@example.com | password123 | http://localhost:5173 |
| 买家2 | buyer2@example.com | password123 | http://localhost:5173 |

## 演示流程

**多品橱窗（推荐）**

1. `docker compose up -d mysql redis` 后执行 `npm run storage:reset` 或 `cd apps/api && npm run db:seed`
2. 主播 `host@example.com` 打开 **http://localhost:5174**
   - **直播控制台**：选择房间 →「待上架」添加商品 → 房间开播 / 切品讲解
3. 买家 `buyer@example.com` 打开 **http://localhost:5173/m**
   - **大厅**：进入直播间 → 在橱窗里出价
   - **我参与的**：查看出过价的拍品，可跳回直播间继续竞拍
   - **订单**：落槌后模拟支付

**单场竞拍深链**

- 路由 `/m/live/:auctionId` 仍保留，用于从橱窗或「我参与的」直接进入出价页
- 首页不再单独列出「单场竞拍」列表

演示脚本与录屏清单：[docs/demo-scripts/](docs/demo-scripts/)

## 用户端信息架构

| Tab | 路由 | 说明 |
|-----|------|------|
| 大厅 | `/m` | 全部直播间（筹备中 / 直播中 / 已结束） |
| 我参与的 | `/m/participations` | 按拍品聚合，显示领先/被超越，可回直播间 |
| 订单 | `/m/orders` | 成交订单与模拟支付 |

旧路由 `/m/history` 自动重定向到 `/m/participations`。

## 管理端信息架构

| 菜单 | 路由 | 说明 |
|------|------|------|
| 直播控制台 | `/` | 房间选择、待上架/直播中 Tab、添加商品、切品、下架 |
| 订单管理 | `/orders` | 本场成交订单 |

旧路径（`/dashboard`、`/auctions`、`/live-rooms` 等）均重定向到 `/`。

## 项目结构

```
apps/api          NestJS 后端
apps/web          React + Vite（用户端 dist + 管理端 dist-admin）
packages/shared   共享类型与 Zod Schema
scripts/          storage:reset、ports:kill 等工具脚本
docker/           Dockerfile 与 Nginx 配置
load-tests/       k6 / Artillery 压测
```

## Docker 全栈（含用户端 + 管理端 + Nginx）

```bash
docker compose up -d mysql redis
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npm run db:seed
docker compose --profile full up -d --build
```

访问：`http://服务器IP/`（用户端）、`http://服务器IP/admin/`（管理端）。详见 [docs/部署指南.md](docs/部署指南.md)。

## 压测

见 [load-tests/README.md](load-tests/README.md)。

## 技术要点

- **出价热路径**: Redis Lua 脚本原子更新价格、排名、软关闭延时（详见 [docs/Redis开发指南.md](docs/Redis开发指南.md)）
- **一致性**: 广播带单调 `seq`，客户端丢弃过期消息
- **时钟**: `timer_sync` 事件 + 客户端 `clockOffset` 校正
- **持久化**: BullMQ 异步落库，幂等键防重复
- **登录态**: 用户端与管理端分存 `accessTokenUser` / `accessTokenAdmin`；修改 `.env` 中 `JWT_SECRET` 或执行 `storage:reset` 后需重新登录
