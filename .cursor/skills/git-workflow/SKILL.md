---
name: git-workflow
description: >-
  Performs Git operations for the live-auction project: status, diff, branch,
  commit, push, and pull requests via gh. Use when the user asks to commit,
  push, create a branch, open a PR, review changes, or manage version control.
---

# Git Workflow

Git 操作规范。**仅在用户明确要求时**才执行 commit / push / PR 等写入操作。

## 安全红线（必须遵守）

| 禁止 | 说明 |
|------|------|
| 修改 git config | 不执行 `git config` |
| 破坏性命令 | 不执行 `push --force`、`reset --hard`、`clean -fd` 等，除非用户**明确**要求 |
| 对 main/master force push | 若用户要求，先警告 |
| 跳过 hooks | 不用 `--no-verify`、`--no-gpg-sign`，除非用户**明确**要求 |
| 擅自 commit | 用户未说「提交 / commit」时不创建 commit |
| 擅自 push | 用户未说「推送 / push」时不 push |
| 交互式命令 | 不用 `-i`（如 `rebase -i`、`add -i`） |
| 提交密钥 | 不提交 `.env`、credentials、token 等；若用户坚持，先警告 |

### `--amend` 仅当以下**全部**满足

1. 用户明确要求 amend，**或** commit 成功但 pre-commit hook 改了文件需纳入
2. HEAD 是**本会话**内 Agent 创建的 commit（`git log -1 --format='%an %ae'` 核对）
3. 该 commit **尚未** push（`git status` 无 "ahead of origin" 以外的已推送状态）

若 commit **失败**或被 hook **拒绝**：修复后**新建** commit，**不要** amend。

---

## 提交（Commit）

### 1. 并行收集信息

在同一轮中并行执行：

```bash
git status
git diff
git diff --staged
git log -5 --oneline
```

### 2. 分析变更

- 区分 staged / unstaged / untracked
- 对照 `git log` 风格撰写 message
- 排除 `.env`、密钥、无关文件
- 确认 message 反映 **why**，1–2 句，动词用 add/fix/update/refactor/docs/test 等

### 3. 暂存并提交

```bash
git add <相关文件>
git commit -m "<message>"
```

**PowerShell（Windows）** 多行 message：

```powershell
git commit -m @"
feat(auction): add order settlement on cap price

BullMQ creates order when auction settles at cap.
"@
```

**Bash** 多行 message：

```bash
git commit -m "$(cat <<'EOF'
feat(auction): add order settlement on cap price

BullMQ creates order when auction settles at cap.
EOF
)"
```

### 4. 验证

```bash
git status
```

若 hook 失败：读错误 → 修复 → **新 commit**（不要 amend，除非满足 amend 条件）。

---

## 推送（Push）

仅在用户要求时：

```bash
git push -u origin HEAD    # 新分支首次推送
git push                     # 已有 upstream
```

推送前确认：无未提交密钥文件、分支名正确。

---

## 分支

```bash
git branch --show-current
git switch -c feature/<name>    # 新建并切换
git switch main
git merge feature/<name>        # 仅用户要求时
```

默认 base 分支：`main`。

---

## Pull Request（GitHub）

使用 `gh` 命令。仅在用户要求创建 PR 时执行。

### 1. 并行收集

```bash
git status
git diff
git branch -vv
git log --oneline main..HEAD
git diff main...HEAD
```

### 2. 创建 PR

```bash
git push -u origin HEAD   # 若尚未推送

gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...
EOF
)"
```

PowerShell body 示例：

```powershell
$body = @"
## Summary
- Add order module and mock payment API

## Test plan
- [ ] Seed + go-live + bid + pay-mock
"@
gh pr create --title "feat: order module" --body $body
```

完成后返回 **PR URL**。

---

## 常用只读命令

| 场景 | 命令 |
|------|------|
| 当前分支 | `git branch --show-current` |
| 远程状态 | `git status -sb` |
| 某文件历史 | `git log -3 --oneline -- <path>` |
| 暂存区 | `git diff --staged` |
| 与 main 差异 | `git diff main...HEAD` |

---

## 本项目勿提交

参考 [.gitignore](../../../.gitignore)：

- `.env` / `.env.local`
- `node_modules/`、`dist/`、`coverage/`
- `*.log`

`.cursor/skills/` 和 `scripts/` **应提交**（团队共享 Agent 能力）。

---

## Agent 检查清单

**Commit 请求：**

```
- [ ] 用户明确要求提交
- [ ] status + diff + log 已查看
- [ ] 无密钥/无关文件
- [ ] message 符合仓库风格
- [ ] commit 后 git status 验证
```

**Push / PR 请求：**

```
- [ ] 用户明确要求
- [ ] commit 已完成（或用户只要 push 已有 commit）
- [ ] 分支与 remote 状态已确认
- [ ] PR 含 Summary + Test plan
```

## 示例

**用户：** 「帮我把订单模块的改动提交了」

1. `git status` / `git diff` / `git log -3`
2. `git add apps/api/src/order/ ...`
3. `git commit -m "feat(order): add order list and mock payment"`
4. `git status` 确认 clean

**用户：** 「提交并 push，开个 PR」

1. 完成 commit 流程
2. `git push -u origin HEAD`
3. `gh pr create ...` → 返回 URL
