# EchoTalent · 天赋回声

> 从一次真诚的对话开始，理解你的职业优势，并把它转化为可以验证的现实路径。

当前版本：**v4.5.4**

## 项目介绍

EchoTalent 是一个 AI 职业探索产品。它不只给出一份静态测评结果，而是通过对话帮助用户梳理经历、兴趣、能力和工作偏好，生成结构化职业报告，再把报告延伸为现实岗位、验证问题、准备重点和行动线索。

产品的核心闭环是：

```text
真实对话 → 职业报告 → 路径预览 → 邮箱注册/登录 → 保存个人资料与报告 → 现实路径地图
```

## 主要功能

### 1. AI 职业探索对话

- 通过自然对话识别用户的优势、动机、经验和工作偏好。
- 支持继续追问、新对话和报告入口管理。
- 对话内容优先保持完整、清晰和有上下文，不把功能指令误当成职业素材。

### 2. 结构化职业报告

- 输出职业画像、核心能力、优势描述、推荐方向和下一步思考。
- 支持岗位方向详情、职业对比和报告分享图。
- 报告生成优先保证内容质量，异常时提供有限的安全兜底。

### 3. 现实路径地图 `/path`

- 将报告中的方向翻译为现实岗位和可验证的工作场景。
- 展示岗位日常、常见要求、能力证据、资源、经验和待验证问题。
- 通过现实路径教练继续讨论岗位、JD、准备度和行动选择。
- 新版 `/path` 是当前唯一的现实路径地图入口，旧的 `/coach/path` 不再作为产品入口。

### 4. 邮箱注册与资料同步

- 使用 Supabase Auth 和 Resend 完成邮箱注册、验证邮件和登录。
- 验证后保存用户显示名、头像、协议版本和训练授权。
- 登录后自动保存对话、消息、职业报告、路径预览、人才画像和上下文资料。
- 未登录用户生成的报告会先保存为匿名草稿，注册或登录后自动认领。
- 报告认领采用事务和幂等设计，重复回跳不会产生重复资料。

### 5. 用户中心与数据沉淀

- 查看已保存的职业资料和路径内容。
- 支持会话持久化与 token 自动续期，刷新页面后保持登录状态。
- 用户可以管理个人资料，并在需要时删除账户。

## 建议使用流程

1. 打开 `/chat`，先用自然语言描述你的经历、兴趣、擅长的事情和当前困惑。
2. 根据 AI 的追问补充真实例子，尽量说明你做过什么、怎么做、结果如何。
3. 生成职业报告，查看职业画像、能力和推荐方向。
4. 点击“查看路径预览”，先浏览主选方向、备选方向和现实验证问题。
5. 如果希望进入完整的现实路径地图，在 `/path` 完成邮箱注册或登录。
6. 打开验证邮件并完成回跳，系统会自动保存用户资料并认领刚刚生成的报告。
7. 在路径地图中继续与现实路径教练对话，核对岗位日常、能力证据、资源和下一步行动。

## 最新版本 · v4.5.4

### Auth & Career Path

- 完成 Resend + Supabase 邮箱注册、验证邮件、登录和回跳链路。
- 修复登录后先初始化用户资料、再进入路径地图的流程顺序。
- 新增匿名报告草稿保存和注册后自动认领。
- 新增报告认领事务、过期校验、冲突保护和幂等处理。
- 登录后保存对话、消息、路径预览、人才画像和用户上下文。
- 统一 `package.json`、`package-lock.json`、README、CHANGELOG 和 `/chat` 版本角标。
- 增加本地预览脚本，启动时清理旧 Next.js 进程和缓存，并检查 CSS 是否正常加载。

## 本地运行

### 环境要求

- Node.js 20+
- npm
- Supabase 项目
- 已配置的 AI 服务密钥

### 安装与启动

```bash
npm install
npm run preview
```

本地预览地址：`http://127.0.0.1:3000`

开发调试可使用：

```bash
npm run dev
```

### 关键环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
DASHSCOPE_API_KEY=
```

涉及邮箱注册和报告认领时，请先执行对应的 Supabase migration，尤其是：

- `supabase/migrations/20260510_000009_career_path_drafts.sql`
- `supabase/migrations/20260717_000010_career_draft_claim_idempotency.sql`

## 发布检查

每次发布必须同步检查以下版本信息：

- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `/chat` 页面版本角标

发布前建议执行：

```bash
npm run check:fonts
npm run build
```

推送 GitHub 后，还需要在 Vercel 中确认 Production deployment 为 `Ready`，并检查正式域名的 `/chat`、`/path`、邮箱回跳和报告认领接口。

## 技术栈

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth、Postgres 和 REST/RPC
- Resend SMTP via Supabase Auth
- Vercel AI SDK
- 阿里云 DashScope / Qwen

## 项目结构

```text
app/chat/                 AI 职业探索对话
app/report/               职业报告
app/path/                 现实路径地图
app/auth/                 邮箱验证回跳与认证错误页
app/api/auth/             用户资料初始化和认证接口
app/api/career-path/      报告草稿、认领和资料接口
components/               共享 UI 与认证组件
lib/                      Supabase、路径预览和业务逻辑
supabase/migrations/      数据库迁移
docs/                     发布与 Supabase 配置文档
```

## 相关文档

- [变更日志](CHANGELOG.md)
- [部署清单](DEPLOY_CHECKLIST.md)
- [Supabase 报告认领迁移](docs/supabase-career-path-claim-migration.sql)
- [项目协作规则](AGENTS.md)
