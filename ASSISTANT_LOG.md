# AI 助手合作日志

## 2026-06-22

- **生产聊天响应热修跟进**:
  - 修复 `/chat` 顶部版本标识仍显示旧版本的问题，并将聊天模型默认切到 `qwen-turbo`、减少工具轮次，降低普通对话首字等待。
  - 为分布式限流 RPC 增加 900ms 超时兜底；Supabase 或跨区网络抖动时会退回本地内存限流，避免发送消息后先卡在限流检查。
  - 验证：热修已推送到 `origin/v4.5-sharing`；线上 `https://echotalent.fun/chat` 仍显示 `V4.5.1 SHARE`，说明生产部署尚未使用这条热修分支，需要继续确认 Vercel 生产分支或合并到生产分支后再验收。
  - 用户反馈生产 `/chat` 仍出现通用对话错误后，撤回未经质量确认的 `qwen-turbo` 默认模型，恢复为 `qwen-plus` 与 `maxSteps: 5`，优先保证会话质量和工具调用稳定性。
  - 为聊天流式响应增加服务端 `[chat stream error]` 日志与中文错误提示，避免后续只在前端看到 `An error occurred.` 而无法定位真实模型/流式错误。

- **报告分享图文字排版修复**:
  - 修复 [app/report/page.tsx](/Users/sue/Documents/trae_projects/career/app/report/page.tsx) 的 Canvas 分享图换行逻辑：从逐字切分改为 token 级换行，英文单词/数字组合保持整体，中文按字排版，标点跟随上一段文本，避免行首标点和英文被截断。
  - 调整分享图摘要删减策略：优先保留完整句和完整分句，放不下时用省略号标记摘录，不再把半句话硬切后补成句号，减少“莫名插入标点”或语义不完整却看似完整的情况。
  - 分享图缓存 key 升级到 `sharecard-a-v30`，避免用户继续看到旧缓存图。
  - 验证：用户从实际服务入口生成分享图后确认显示基本正常；本地 `tsc --noEmit` 仍被项目中既有的其他页面/API 类型问题阻断，未作为本次修改的通过信号。

- **Chat 续聊与报告入口修复**:
  - 将 `/chat` 页“继续聊聊”从固定用户示例句改为 UI 控制指令，前端只展示“继续聊聊”，后端明确要求 AI 承接上一轮真实上下文，不再误读“有细节想补充”的示意文案。
  - 报告入口改为解锁后持久可见：真实对话足够或模型触发报告工具后，右上角“职业报告”、底部“生成报告”和续聊后的轻量提示都会保留，避免用户继续聊后找不到报告入口。
  - 报告生成链路过滤 UI 控制消息，避免污染报告素材；同时加强提示词，禁止 AI 在聊天正文里直接输出完整报告。
  - 报告生成增加防重复触发、超时/失败恢复提示和定时器清理，降低进度条卡住后用户无反馈的风险。
  - 优化报告生成等待体验：进度条不再快速冲到 99% 后假性卡住，长等待时展示耗时说明，并提供“继续等待 / 停止并返回对话”的选择；报告接口减少模型输入上下文并记录生成耗时，便于后续定位慢点。
  - 精简报告页路径承接：移除底部重复的“下一步：把这份理解带进真实选择”CTA，保留“查看路径预览”作为后续路径、保存和登录承接的统一入口。
  - 调整报告生成架构为“基础报告优先”：首轮报告不再要求模型生成具体岗位场景；岗位详情延后到用户点击职业时生成；报告生成超时或失败时自动进入本地基础报告页，并缓存轻量画像摘要，为登录后的长对话画像和报告缓存打基础。
  - 在报告页职业标签区域增加轻量操作提示：标题旁提示“点开职业看细节，选 2 个可对比”，选择职业后浮动操作条根据已选数量提示“再选 1 个职业进行对比”或“已选择 2 个，查看对比”。
  - 按 v3.1 视觉参考微调报告页职业选择浮层：选择 1 个职业时恢复“已选择 1 个职业方向”和“深度解析该职业”，并保留更浅的小字提示“可再选一个职业进行对比”。
  - 调整报告生成进度策略：默认等待完整版报告，不再展示用户手动中断入口或“基础版”标记；仅当模型等待超过 20 秒时自动兜底进入基础报告。
  - 新增稳定本地预览入口 `npm run preview`：自动停止 3000/3001 端口残留 Next 进程、清理 `.next` 缓存，并固定启动到 `127.0.0.1:3000`；同时把该规则写入 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md)，后续需要预览时默认使用该入口，减少 stale chunk、缺失模块和热更新缓存问题。
  - 强化报告素材准入逻辑：将“生成/查看报告”“总结一下”“不想聊了”等操作语义从画像素材中过滤，只作为报告入口触发信号，避免轻量报告把用户的功能请求当作职业画像证据；报告生成兜底超时调整为 30 秒。
  - 调整 `/chat` 报告入口策略：推广期默认 5 次真实用户表达后展示底部“继续聊聊 / 生成报告”，用户点击“继续聊聊”后进入沉浸对话模式，只有再次表达收束或查看报告意图时才显示底部按钮。
  - 优化路径预览卡片：主选/备选方向文案从后台匹配口吻改为“为什么推荐、如何现实验证”的用户指导口吻；路径预览保存 CTA 回到柔和深色底，保留醒目但不使用纯黑。
  - 修复 `/chat` 新对话与输入框体验：点击右上角“新对话”会清空当前会话的底部报告按钮和续聊状态，避免历史报告解锁泄漏到新会话；输入框支持中文 IME 合成态，拼音候选期间按 Enter 不再误发送，并改为发送时立即清空输入框以减少网络延迟造成的文字残留。
  - 调整报告兜底优先级：前端不再因普通等待主动中断正式报告请求，60 秒只提示仍在生成完整版，约 110 秒仍无结果才临时进入轻量版；后端报告接口执行上限放宽到 120 秒，正式版稍后返回时会自动覆盖轻量版缓存，确保轻量版只作为真正报错或卡死时的兜底。
  - 恢复正式报告的具体岗位场景质量：正式版 `superpowers` 再次要求生成 2-4 个具体岗位或工作场景，进度条体感上限从 94% 调回 99%；轻量版仍保持兜底定位。
  - 升级路径预览文案：新增 `/api/career-path/preview` 模型润色流程，先用方向库稳定选择主选/备选方向，再由模型改写“为什么优先验证/为什么作为备选”的解释，减少模板化和后台匹配感；报告页和路径地图页都会异步升级为模型文案。
  - 精简路径地图保存卡片文案：去掉重复的“登录后解锁完整版”提示，并将保存说明收束到“对话记录、职业报告和路径预览会自动归入个人资料”。

## 2026-06-08

- **发布与上线流程固化**:
  - 新增 [DEPLOY_CHECKLIST.md](/Users/sue/Documents/trae_projects/career/DEPLOY_CHECKLIST.md)，整理后续固定发布流程、Vercel 环境变量、上线前检查项和冒烟测试项。
  - 新增 [GITHUB_SETUP.md](/Users/sue/Documents/trae_projects/career/GITHUB_SETUP.md)，整理 GitHub 一次性 SSH/CLI 登录方案，减少后续 push 时反复卡在认证。
  - 验证 `v4.5.2` 线上主站、聊天页、管理员后台路由和匿名游客埋点链路；最终确认生产匿名埋点已恢复正常。
  - 将仓库 `origin` 切换为 SSH 路径，并确认后续发布默认不再依赖 GitHub 设备码登录。

- **效率复盘**:
  - 本次最耗时的不是代码实现，而是发布链路中的认证、冲突解决和生产环境变量补齐。
  - 后续效率最高的做法是：固定使用 SSH push、保持 `main` 仅承载可上线代码、上线前先核对 Vercel 环境变量，而不是在发布后再补。
  - 对于管理员后台和埋点类功能，生产验收要优先区分三类问题：页面路由未上线、接口鉴权正常拦截、服务端环境变量未读取。

- **日志维护规则更新**:
  - 在 [AGENTS.md](file:///Users/sue/Documents/trae_projects/career/AGENTS.md) 中新增 `Project Logs` 规则。
  - 约定后续有意义的项目更新后记录 [ASSISTANT_LOG.md](file:///Users/sue/Documents/trae_projects/career/ASSISTANT_LOG.md)，版本升级、发布准备或版本提交后记录 [CHANGELOG.md](file:///Users/sue/Documents/trae_projects/career/CHANGELOG.md)。
  - 明确避免为临时实验、失败草稿或已立即回退的更改制造噪音日志。

## 2026-03-05 18:42

- **品牌重塑 (Rebranding to EchoTalent)**:
  - 更新 [page.tsx](file:///Users/sue/Documents/trae_projects/career/app/page.tsx) 首页标题为“听见你的天赋回声”，副标题优化为“通过轻松的对话，让 AI 帮你剥离迷雾，精准定位你的职业天赋与热爱”，按钮更新为“开启探索之旅”。
  - 更新 [layout.tsx](file:///Users/sue/Documents/trae_projects/career/app/layout.tsx) 网站标题为 `EchoTalent | 天赋回声`。
  - 清理全站遗留的 "Deep Mirror" 文案，包括 [route.ts](file:///Users/sue/Documents/trae_projects/career/app/api/chat/route.ts) (API)、[auth-dialog.tsx](file:///Users/sue/Documents/trae_projects/career/components/auth-dialog.tsx) (认证弹窗) 及 [report/page.tsx](file:///Users/sue/Documents/trae_projects/career/app/report/page.tsx) (报告页)。
  - 更新 [chat/page.tsx](file:///Users/sue/Documents/trae_projects/career/app/chat/page.tsx) 顶部版本号为 `v4.2 newbrand`。
- **移动端布局优化 (Mobile Compatibility)**:
  - 修复 iOS 键盘弹起导致页面缩放的问题：将 `textarea` 字号提升至 `16px` (text-base)，阻止 iOS 自动缩放引起的宽度偏移。
  - 锁定按钮：为发送按钮添加 `shrink-0`，确保在窄屏下不被挤压。
  - 视口保护：在 [layout.tsx](file:///Users/sue/Documents/trae_projects/career/app/layout.tsx) 中配置 `viewport` 禁止自动缩放，确保布局稳定性。
- **基础设施维护**:
  - 定位并协助解决了 Supabase 项目被暂停导致的 `Failed to fetch` 报错。
  - 制定了 `v4.2-fix` 分支预览部署策略，确保线上正式环境稳定性。

## 2026-03-05 16:00 (Previous)

- **任务**: 协助用户完成一次大规模的代码提交，将项目从本地版本升级到 v4 云同步版本。
- **合作亮点**:
  - 分析了 [layout.tsx](file:///Users/sue/Documents/trae_projects/career/app/layout.tsx), [page.tsx](file:///Users/sue/Documents/trae_projects/career/app/page.tsx), [chat/page.tsx](file:///Users/sue/Documents/trae_projects/career/app/chat/page.tsx), [prompt-versions.ts](file:///Users/sue/Documents/trae_projects/career/lib/prompt-versions.ts) 四个文件的重大修改。
  - 撰写了详细的 Git Commit Message，总结了包括 Supabase 集成、UI/UX 重构、品牌更新在内的各项特性。
  - 遇到了终端执行 `git` 命令持续失败的问题，切换策略，通过直接写 `.git/COMMIT_EDITMSG` 文件的方式帮助用户准备提交。
  - 根据用户要求，调整了沟通风格并切换回中文。
  - 创建了此日志文件，用于记录未来的合作概要。
- **后续**: 用户将自行在编辑器中完成最终的提交操作。
