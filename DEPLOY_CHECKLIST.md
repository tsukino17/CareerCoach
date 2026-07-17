# Deploy Checklist

这份清单用于之后每次上线时快速自检，尽量把发布流程固定下来，避免临时挑文件、临时补变量、临时排查 GitHub 或 Vercel。

## 日常开发规则

1. 新功能默认在独立分支开发：
   - `feature/...`
   - `fix/...`
   - `release/...`
2. `main` 只保留可以直接上线的代码。
3. 实验功能不要混入准备发布的分支：
   - GPT-SoVITS
   - test pages
   - 未收口的 coach/path/action 实验页
4. 每次准备上线前，先确认本次发布范围，不在脏工作区里临时挑文件。

## 推荐分支流程

1. 平时开发用 `feature/...` 或 `fix/...`
2. 自测通过后提 PR 到 `main`
3. 在 GitHub 上解决 conflict
4. Merge 到 `main`
5. 等待 Vercel 自动部署 production
6. 做一次 3 分钟冒烟测试

## 上线前检查

每次发布前至少确认：

1. `npm run build` 通过
2. 本次发布不包含明显未完成功能
3. 关键环境变量已经存在于 Vercel Production
4. PR 没有 conflict
5. 如果有数据库变更，Supabase schema/migration 已执行

### GitHub 推送前安全检查

推送前必须检查暂存范围和完整工作区，确认没有隐私密钥或本地凭据：

```bash
git diff --cached --check
git status --short
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' \
  '(SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|DASHSCOPE_API_KEY|OPENAI_API_KEY|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|access_token|refresh_token|password\s*=)' .
```

如果发现真实密钥，必须先从提交范围移除并完成密钥轮换，再继续推送。`.env*`、浏览器凭据、邮箱凭据和本地生成数据不得进入 GitHub。

## Vercel 关键环境变量

当前项目上线时最关键的是这些：

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAILS
NEXT_PUBLIC_APP_URL
```

如果涉及语音能力，再额外确认：

```bash
DASHSCOPE_API_KEY
```

## 上线后冒烟测试

至少检查这几项：

1. 首页 `/` 返回 200
2. 聊天页 `/chat` 返回 200
3. 聊天接口 `/api/chat` 在线
4. 管理后台 `/admin` 返回 200
5. 游客埋点接口 `/api/analytics/event` 返回 `{ "ok": true }`
6. 管理后台接口在未登录时返回 `Admin login required`

## 管理后台验收

上线后用管理员邮箱登录 `/admin`，确认：

1. 能发送管理员登录链接
2. 登录后能进入后台
3. 今日访问数据开始出现
4. 匿名游客访问/停留/来源有记录
5. 原始对话页能打开

## 遇到问题时先看什么

### `/admin` 404

- 多半是 PR 还没 merge 到 `main`
- 或 Vercel production 还没部署最新 commit

### `/api/admin/insights` 500

- 优先检查：
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `ADMIN_EMAILS`

### `/api/analytics/event` 返回 `analytics_not_configured`

- 说明生产环境没读到：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### GitHub merge conflict

- 优先保留 `main` 的稳定 UI/字体/基础结构
- 再手动加入本次发布需要的新导入、新组件、新埋点逻辑
- 不要盲点 `Accept current` 或 `Accept incoming`

## 发布节奏建议

以后建议：

1. 小功能随时进 `feature/...`
2. 准备上线时合成一个清晰的 PR
3. 每次上线只做一件明确的版本目标
4. 不把依赖升级、实验功能、核心业务发布混在一个 PR 里
