# 直播竞拍系统 (Live Auction)

高并发直播场景下的实时竞拍平台：React + Socket.io 前端，NestJS + MySQL + Redis + BullMQ 后端。

## 功能

- 商品上架与管理
- 竞拍规则配置（0 元起拍、固定加价、封顶价、软关闭延时、主播取消）
- HTTP 出价 + Redis Lua 原子校验
- WebSocket 实时排名与毫秒级倒计时（服务端权威时钟）
- PC 管理台 + 移动端 H5（看板、订单、可配置起拍价）
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

### 5. 启动开发服务

```bash
# 终端 1 - API
npm run dev:api

# 终端 2 - Web
npm run dev:web
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Web: http://localhost:5173
- H5 大厅: http://localhost:5173/m
- 管理台: http://localhost:5173/admin/dashboard

### 演示账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 主播 | host@example.com | password123 |
| 买家 | buyer@example.com | password123 |
| 买家2 | buyer2@example.com | password123 |

## 演示流程

1. `host@example.com` 登录 → 管理台 → 场次管理 → 对「【演示】翡翠手镯专场」点击 **开播**
2. `buyer@example.com` 打开 http://localhost:5173/m → 进入直播间出价
3. 成交后在 **订单** 页模拟支付

演示脚本与录屏清单：[docs/demo-scripts/](docs/demo-scripts/)

## 项目结构

```
apps/api     NestJS 后端
apps/web     React + Vite 前端
packages/shared  共享类型与 Zod Schema
docker/      Dockerfile 与 Nginx 配置
load-tests/  k6 / Artillery 压测
```

## Docker 全栈

```bash
docker compose --profile full up --build
```

## 压测

见 [load-tests/README.md](load-tests/README.md)。

## 技术要点

- **出价热路径**: Redis Lua 脚本原子更新价格、排名、软关闭延时
- **一致性**: 广播带单调 `seq`，客户端丢弃过期消息
- **时钟**: `timer_sync` 事件 + 客户端 `clockOffset` 校正
- **持久化**: BullMQ 异步落库，幂等键防重复
