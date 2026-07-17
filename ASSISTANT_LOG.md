# AI 助手合作日志

## 2026-07-17 v4.5.4 发布补充

- 将 README 收敛为对外内容：保留项目介绍、主要功能、建议使用流程、官网链接和最新版本功能；移除环境变量、发布检查、数据库迁移文件名和内部目录结构。
- 增加 3 张本地演示截图，展示对话、职业报告和现实路径地图，截图不含真实用户数据。
- 解决 PR #27 与 `main` 的合并冲突，保留邮箱认证/报告认领流程并吸收稳定聊天、Analytics 和 Speed Insights 更新。
- 删除旧的 `RELEASE_NOTES_v4.6.0.md`、`VERSION` 及本地生成物；保留仍有路由职责的 `middleware.ts`。
- 从干净 Git 提交树部署到正确的 `career-coach` Vercel 项目，`echotalent.fun` 已切换到 `dpl_FysJhAXJbpX3n8ZKh2fWvfWdDLYq`，Production 状态 Ready。
- 线上验证：`/`、`/chat`、`/path` 返回 200，`/api/career-path/draft` 和 `claim` 返回 405（POST 路由存在），聊天页显示 `v4.5.4`。

## 2026-07-17 发布安全规则

- 将 GitHub 推送前的密钥泄漏检查写入 `AGENTS.md` 和 `DEPLOY_CHECKLIST.md`。
- 发布前必须扫描暂存范围和工作区，禁止提交 `.env*`、Supabase service-role key、Resend/API key、访问令牌、刷新令牌、密码、证书和邮箱凭据。
- 本次扫描确认 `.env.local` 已被 `.gitignore` 忽略，Git 跟踪文件和工作区未发现疑似真实密钥；文档中的变量名仅为配置示例。

## 2026-07-17

- **邮箱认证后保存现实路径地图修复**：
  - 修复 [components/auth-dialog.tsx](/Users/sue/Documents/trae_projects/career/components/auth-dialog.tsx) 的认证完成顺序：在进入后续页面前等待 `/api/auth/finalize` 成功，初始化失败时明确留在当前页提示重试，避免静默丢失用户资料。
  - 移除旧的 `/coach/path` 路由及其入口，产品唯一的现实路径地图统一为新版 `/path`；个人档案、测试入口和访问分析均已同步到该路径。
  - 补齐新版 `/path` 的报告认领链路：密码登录和邮箱验证回跳都会在跳转前执行 `/api/career-path/claim`，将匿名报告、对话记录和路径预览写入当前用户的职业档案；失败时不再静默跳转。
  - 登录弹窗改为明确的登录/注册模式，注册时分开收集协议同意与可选训练授权；回调仅允许站内目标路径，且 `finalize` 不再提前标记草稿，避免资料认领半完成。
  - 修复认证根因：Supabase 客户端此前禁用了登录态持久化和自动续期，页面刷新后会回到访客态；现已启用持久化会话与 token 自动续期。
  - 增加根路径认证接力：当 Supabase 邮件验证先回到项目根地址并携带认证参数时，首页立即交给 `/auth/callback` 完成会话交换和资料保存，不影响普通首页访问。

- **现实路径地图 Tab 与主面板布局优化**:
  - 更新 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx)，将岗位切换 Tab 从拟物文件夹感改为更成熟的扁平分段式产品组件；只有 2 个以上岗位需要切换时才显示 Tab，避免单岗位时出现巨大无意义标签。
  - 调整 `/path` 主面板断点：资源支持模块在普通桌面宽度下占满左侧内容区，避免被两列布局压窄；资料概览和资料板更新的双列断点后移，减少平板和窄桌面拥挤。
  - 验证：`npx next lint --file app/path/page.tsx` 通过；本地预览 `http://127.0.0.1:3000/path` 的 CSS 已加载，1280 宽度下右侧现实路径教练保持固定，职业探索三岗位 Tab 显示为干净的分段式组件。

## 2026-07-02

- **教练 prompt 真实性与排版规则**:
  - 更新 [lib/path-coach-prompt.ts](/Users/sue/Documents/trae_projects/career/lib/path-coach-prompt.ts)，把公开 JD、公司官网、招聘页、公开招聘帖和公开业务信息的真实性规则写入现实路径教练 prompt：可追溯时保留真实公司名、岗位名、业务方向、地点、工作方式、能力要求和招聘需求，不再泛化成“某公司/某岗位”。
  - 更新 [app/api/coach/chat/route.ts](/Users/sue/Documents/trae_projects/career/app/api/coach/chat/route.ts)，让行动力教练在聊岗位、招聘 JD、公司业务和市场机会时遵守同样的真实性优先规则；无法确认来源或时效时必须标注为岗位画像、常见 JD 画像或粗略市场判断。
  - 在两处 prompt 的回复风格里补充更严格的中文排版约束：默认使用中文标点，禁用 `✅`、`▸`、`→` 等奇怪符号；需要分段列点时优先使用圆点列表。
  - 进一步补充岗位搜索顺序：默认先看国内真实岗位，再看国外岗位；只有用户明确要海外、国际化、英文岗位或远程跨国机会时，才补充国外岗位和国际渠道。
  - 补充消息完整性规则：优先保证文字发全、表达完整；如果一条消息内容太多，可以自然拆成 2 条连续消息，不要为了压缩篇幅留下半句或残缺表达。
  - 补充高亮使用原则：高亮只用于帮助用户抓重点，或对不同语义段落做提醒和分类，例如岗位名称、核心工作、高频能力、仍需验证；不允许为了装饰而滥用高亮。
  - 更新 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md) 的本地预览规则：完成用户可见功能改写后自动给预览链接；如果 3000 端口已有可用旧预览，优先复用现有链接，不反复重启。
  - 更新 [app/api/coach/opportunity-search/route.ts](/Users/sue/Documents/trae_projects/career/app/api/coach/opportunity-search/route.ts) 的机会搜索提示词，使工具箱默认先输出国内真实岗位语境，并遵守完整表达与中文排版约束。
  - 更新 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 的现实路径教练消息渲染：圆点列表改为逐条分行展示并使用蓝色高亮圆点，短岗位并列信息支持蓝色 `/` 分隔，消息文本增加更稳的换行与底部留白，减少“文字没发全”的视觉问题。
  - 继续收紧 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 的消息 UX：去掉会泄漏到界面的强调占位符，取消激进的自动词语高亮，改为更克制的语义高亮；列表拆成“引导句 + 紧凑圆点项”，并收紧圆点对齐与行距。
  - 微调 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 中文排版细节：圆点列表的圆点略微放大，中文标点后的多余空格自动清理，“比如”后自动补中文冒号，减少冒号和示例文字附近的松散感。
  - 改进 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 语义分段：职责描述、用户能力、高频能力词、待验证点和追问选项会尽量分成不同语义段落；追问里的多个选项不再因为模型输出了圆点符号而被强行渲染成列表。
  - 完成 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 的成体系消息 UX 修复：补齐 `insertSemanticBreaks`，长回复按语义块或完整句子拆成两条助手消息；岗位名称、真实工作日常、JD里的常见职位要求、用户连接点、待验证点和追问会稳定分段。
  - 收紧现实路径教练渲染规则：圆点列表只用于同一语义类别的并列项，追问选项不再被误判为列表；高亮只保留语义标签或明确强调内容，短岗位并列里的 `/` 统一为蓝色分隔。
  - 调整路径判断触发：资料板更新建议不再因为对话满两轮自动出现，必须满足真实 JD、职位要求、下一步验证和至少一个现实上下文检查后才允许生成；面板按钮在条件不足时显示“线索足够后整理资料板”。
  - 继续收紧 [lib/path-coach-prompt.ts](/Users/sue/Documents/trae_projects/career/lib/path-coach-prompt.ts) 的岗位介绍话术：禁止“轻量校准”“不是诗意概念”“真实存在的角色”等低信息量开场；常见真实岗位直接进入常见岗位名、工作内容和 JD 要求。用户问 JD、岗位介绍或职位要求时，不主动写“你已有能力天然接口”等用户能力映射，只有用户明确问适配、差距或能力迁移时才进入这部分。
  - 更新现实路径教练语言风格：少废话，偏理性、精炼、简洁，但不是严苛；要带着温度、客观可靠，并能抓住岗位与现实路径的要点。
  - 为 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 增加前端兜底：统一教练消息字号，清理模型旧输出里的对勾、箭头、“你已有能力天然接口”以及“你提到的……岗位接口/能力/优势”这类用户能力映射句；把“岗位日常核心”归入“真实工作日常”语义段，并增加消息区底部安全距离，减少结尾被输入区遮住的观感。
  - 校准能力映射边界：能力映射不是禁用，而是只在用户主动提到能力、适配、差距、作品、经历或能力迁移时出现；移除前端对“你提到的……”能力映射句的一刀切过滤，避免误删用户主动询问后的合理匹配分析。
  - 将 JD 排版规则扩展为现实岗位话题通用规则：日常任务、典型一天、流程示例、协作对象、工具要求、行业差异和公司类型差异都按语义分段；前端补充时间线整理，把“上午/中午/下午/下班前”等密集时间线拆成圆点列表，并清理“：，”“，，”等标点连用。
  - 新增 [lib/coach-message-formatting.ts](/Users/sue/Documents/trae_projects/career/lib/coach-message-formatting.ts) 作为全局教练消息排版协议，统一自然语义分段、圆点列表、高亮、完整表达、能力映射触发条件和标点规则；现实路径教练、行动力教练、主聊天入口和岗位机会搜索均接入该共享规则。
  - 修复 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 圆点列表根因：不再因为段落里包含追问就放弃列表解析，改为先保留列表，再把“这些都可能是……”“接下来，你想……”等总结或追问拆成独立段落，避免 `：•` 被误转成 `：，`。
  - 为现实路径教练增加低存在感等待气泡：用户发送后立即显示三点生成动画，请求完成后自动替换为正式回复，并在生成期间禁用输入和发送，避免用户误以为没有响应。
  - 进一步校准现实教练语言风格：少用感性长句，优先精简、客观的陈述句和总结句；同时保持总体态度积极，对用户选择和想法给予支持与鼓励，再帮助用户看清现实条件、风险和验证方式。
  - 补充现实路径教练的经历处理链路：当用户主动提供经历、作品或已有能力时，先做经历判断，再给验证入口和观察清单，最后沉淀为能力或经验记录；这一步用于判断岗位前期准备度，不等同于立刻给用户派任务。
  - 更新 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 的资源支持面板：把用户在教练对话里提到的解释说明文档、用户反馈、项目推进等经历自动沉淀到“经验”或“能力”下，保留为主面板可复用资源。
  - 继续修复现实路径教练消息可读性根因：长段落会按“经历判断、验证入口、观察清单、能力记录、追问”等语义变化自动拆段；圆点列表的引导语也会先拆成自然段，避免 5 行以上大段集中显示。
  - 提高 [app/api/coach/path/chat/route.ts](/Users/sue/Documents/trae_projects/career/app/api/coach/path/chat/route.ts) 的模型回复上限，减少中文回复被 token 上限截断的风险，再由前端负责把长回复拆成可读消息。
  - 升级 [scripts/preview-next.mjs](/Users/sue/Documents/trae_projects/career/scripts/preview-next.mjs) 的预览验收：启动后不仅清理 `.next`，还会检查 `/path` 的 CSS 资源能否成功加载，避免把“HTML 200 但样式缺失”的预览当成有效链接。
  - 收紧现实路径教练引导语：prompt 要求所有引导问题贴近真实岗位任务、工作对象、交付物、能力证据和准备度，不再用“环境情绪翻译”“跨媒介叙事迁移”“留白与分寸感”等抽象天赋词做提问选项；前端也会把旧回复里的这类词转换成客户数据分析、旅程梳理、触达话术、帮助文档、跨团队流程优化等实际任务语言。
  - 继续校准现实教练准备度判断：用户给出相关经历后，教练先快速打钩并记录为“能力/经验”线索，不围绕单一经历过度展开；随后追问下一个岗位核心能力，累计确认 3 到 5 个能力点后，再给“已具备/部分具备/暂缺证据”的客观判断。
  - 文案标签统一：把用户可见的“JD里的常见职位要求/岗位需求里的常见要求”收束为更短的“常见的岗位需求”；保留 API、SDK、SOP、JSON、Markdown 等岗位常规术语，不做生硬中文替换。
  - 更新 `/path` 资料模块：资源支持面板改为最多 3 个岗位的 Tab 切换，每个岗位显示能力匹配度、经验、意愿、资源和总分；能力区只展示能对照岗位需求的具体能力证据，不再把天赋报告里的抽象词作为岗位能力兜底。
  - 整合工具与场域：原工具板和地方板合并到每个岗位的“资源”区，资源可包含工具、材料、平台、场域、可访问的人和可观察渠道；主面板折叠阈值调窄，iPad 宽度直接展开，只在更小手机宽度保留折叠交互。
  - 调整 `/path` 主面板信息架构：现实路径教练在平板和电脑端固定在右侧，左侧主面板按 dashboard 方式自动排布；任务列表和今日觉察可并排展示，资料概览和资料板更新并排展示，删除空的模块占位区。
  - 重做岗位 Tab 视觉：放弃复杂拟物文件夹，改为接近 daisyUI `tabs-lift` 的轻量扁平标签样式；职业探索 Check 板改为紧凑清单，并将进度标题改为“行动 check”。
  - 修正“你目前的主线”模块：内容改为首选职业方向和当前行动，不再展示“视觉节奏把控、留白与分寸感”等抽象天赋词。
  - 更新 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md) 的产品质量原则：以后遇到重复 UX、视觉、内容或产品质量问题时，先找共同根因，统一 prompt、渲染、数据和交互触发，再从产品、UX、视觉和工程角度自检后交付。
  - 验证：本次改动文件通过 `npx next lint --file app/path/page.tsx --file lib/path-coach-prompt.ts --file lib/coach-message-formatting.ts --file app/api/coach/path/chat/route.ts --file app/api/coach/chat/route.ts --file app/api/chat/route.ts --file app/api/coach/opportunity-search/route.ts`。完整 `npm run build` 仍被既有 `/auth/callback/page` 与 `/auth/callback/route` 并行路由冲突阻断；`npx tsc --noEmit` 仍有既有 audio/analysis/tts/calendar/profile/schema 类型错误，本次改动文件未出现在剩余错误里。
  - 预览验证：`npm run preview` 成功启动后，`http://127.0.0.1:3000/path` 在脚本层确认了 1 个 CSS 资产可访问；浏览器侧复查也看到了正常的页面背景、系统字体栈和恢复的首屏样式，不再是未加载 CSS 的裸 HTML。

## 2026-07-02

- **岗位聚合搜索与职业探索进度板**:
  - 新增 [app/coach/action/tools/opportunity-search/page.tsx](/Users/sue/Documents/trae_projects/career/app/coach/action/tools/opportunity-search/page.tsx)，作为资源版可单独调用的“岗位聚合搜索”工具箱，支持目标岗位、城市、薪资期待、行业偏好、工作方式、已有优势、不想要条件和 JD 文本输入。
  - 扩展 [app/api/coach/opportunity-search/route.ts](/Users/sue/Documents/trae_projects/career/app/api/coach/opportunity-search/route.ts)，基于 Qwen 输出偏好匹配摘要、匹配维度、搜索词、可打开搜索入口、岗位方向、能力缺口和一周验证动作；默认更贴合国内招聘市场，同时在用户选择海外/国际/远程时补充 LinkedIn、Remote OK、Levels.fyi 等国际入口。
  - 在 [app/path/page.tsx](/Users/sue/Documents/trae_projects/career/app/path/page.tsx) 新增“职业探索 Check 板”，按岗位记录 JD、薪资、技能、相邻岗位对比、从业者经验和下一步验证六个进度点，并在侧边导航里加入 Check 板与岗位聚合搜索入口。
  - 调整 [lib/path-coach-prompt.ts](/Users/sue/Documents/trae_projects/career/lib/path-coach-prompt.ts) 的现实路径教练规则：当用户聊岗位、JD、薪资或市场时，教练先给轻量市场校准、范围判断和不确定点，不再第一步要求用户自己打开招聘平台；只有复杂实时筛选或深入对比时才引导去工具箱或外部搜索。
  - 优化 `/path` 行动力日历详情文案：当天有觉察记录、归档对话或已完成任务时显示“你离理想中的自己又近了一步！”；空状态提示改为“记录下你今天为了实现目标又做了哪些努力吧~”，且未选择心情贴纸时不再默认显示表情。
  - 为现实路径教练消息渲染增加岗位分析标签高亮，包括“常见岗位名称”“核心工作常包含”“能力关键词高频出现”“真实岗位摘录”“岗位链接”等。
  - 在 [app/coach/action/tools/analysis/page.tsx](/Users/sue/Documents/trae_projects/career/app/coach/action/tools/analysis/page.tsx) 左侧工具箱面板加入岗位聚合搜索入口；按用户要求未放到行动教练顶部。
  - 在 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md) 新增 `Code Quality Discipline`，要求后续改动前主动检查语法、类型形状、JSX、imports 和返回类型，减少基础语法返工。
  - 验证：`npm run preview` 成功启动到 `http://127.0.0.1:3000`；`/coach/action/tools/opportunity-search` 和 `/path` 均返回 200，并用浏览器确认新工具页、工作方式选项、Check 板和聚合搜索入口可见。`npm run build` 仍被既有 `/auth/callback/page` 与 `/auth/callback/route` 并行路由冲突阻断；`npx tsc --noEmit` 仍有既有 audio/calendar/profile/schema 类型错误，本次改动文件未出现在剩余错误里。

- **现实路径地图原型整理**:
  - 新增 `/path` 现实路径地图页面：移动端优先展示现实路径教练，资料板块默认折叠，桌面端保留三栏结构。
  - 左上角新增折叠菜单，并校准导航：个人中心指向 `/user`，现实路径教练、最小阻力路径、愿景板/资源板、资料概览和资料板更新指向当前页对应锚点；点击页内锚点会先展开折叠面板再滚动。
  - 顶部操作改为“档案更新”，用于整合当前报告、天赋对话、现实路径教练对话和资料板，更新本地用户记录摘要与资料板状态；未登录时继续引导认证同步。
  - 从 `/path` 移除行动日记和规划日历入口，暂时保留愿景板、资源板、工具板和地方板；行动相关后续放到 `/action` 页面。
  - 新增现实路径教练接口 `/api/coach/path/chat`，提示词强调理性、有温度、开放探索，同时给出资源、工具、路径、场域和低风险验证建议。
  - 将现实路径教练 prompt 独立到 [lib/path-coach-prompt.ts](/Users/sue/Documents/trae_projects/career/lib/path-coach-prompt.ts)，API route 只负责上下文组装和 Qwen 调用；移除本地写死教练回复，模型不可用时明确返回暂时不可用提示，避免用模板内容冒充模型能力。
  - `/path` 增加微行动任务列表、今日觉察和页面内行动力日历：教练提出微行动并经用户确认后同步到任务列表，完成状态和觉察记录会以图标形式显示在日历中，并作为后续教练上下文的一部分。
  - 修复 `/path` 现实路径教练发送消息后整页下滑的问题：消息更新时只滚动教练对话容器内部，不再把页面滚到下方资料模块。
  - 调整现实路径教练 prompt，删除固定开头和固定岗位介绍标签，要求模型自然变化承接语，减少模板化回复。
  - 收紧现实路径教练微行动规则：prompt 注入当前日期和今日微行动数量；微行动定位为一天对话结束前的总结性行动建议，必须来自开放探索、岗位内容讨论和现实资源梳理之后，一天通常 1-2 个，不在早期兴趣确认阶段随意提出。
  - 微调今日觉察 UI：移除卡片右上角“日历”入口，将四个心情状态改成表情贴纸，并在行动力日历中沿用对应颜色与表情。
  - 将现实路径教练的“清空”改为“归档”：点击后保留当前对话、归档日期时间和消息内容到本地历史；左上角侧边栏新增“历史对话”列表，行动力日历中有归档的日期会显示文档图标并可打开可滚动的对话文档弹窗。

- **构建字体依赖治理**:
  - 从 [app/layout.tsx](/Users/sue/Documents/trae_projects/career/app/layout.tsx) 移除 `next/font/google` 的 `Noto_Sans_SC`，改用 [app/globals.css](/Users/sue/Documents/trae_projects/career/app/globals.css) 中的本地系统中文字体栈，彻底避免构建期请求 `fonts.gstatic.com`。
  - 新增 [scripts/check-no-remote-fonts.mjs](/Users/sue/Documents/trae_projects/career/scripts/check-no-remote-fonts.mjs)，并挂到 `predev`、`prepreview`、`prebuild`，后续如果重新引入 `next/font/google`、`fonts.googleapis.com` 或 `fonts.gstatic.com` 会直接失败并提示原因。
  - 验证：`npm run check:fonts` 通过；`npm run build` 不再出现 Google Fonts 下载重试，当前被既有 `/auth/callback/page` 与 `/auth/callback/route` 并行路由冲突阻断。

## 2026-06-22

- **产品质量原则补充**:
  - 在 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md) 新增 `Product Quality Principle`：后续产品、UI、报告和分享图实现不能以兜底思维作为默认方案。
  - 明确兜底只作为异常保护；正常路径必须优先追求最佳用户体验、准确语义、高信息价值和精致呈现。
  - 对生成报告、分享图摘要和用户可见文案，要求优先保留完整、高信号、语义忠实的内容；需要缩短时应重写或选择更好的完整观点，而不是暴露碎片化截断。

- **移除全局行动力悬浮入口**:
  - 从 [app/layout.tsx](/Users/sue/Documents/trae_projects/career/app/layout.tsx) 移除 `ActionCoachEntryOverlay` 全局渲染，避免“开始行动力陪伴 / 行动力教练”按钮在报告页、分享图弹窗或其他页面中悬浮干扰主流程。
  - 验证：本地预览 `/report?demo=coordination` 打开分享图弹窗后，页面只保留“保存图片”操作，不再出现“开始行动力陪伴”悬浮按钮。

- **待办优先级整理**:
  - 新增 [PROJECT_TODO.md](/Users/sue/Documents/trae_projects/career/PROJECT_TODO.md)，记录后续工作优先级。
  - 当前高优先级保持为邮箱注册/登录可靠性与现实路径地图；Qwen 模型升级评估列为低优先级，后续有空再对比 `qwen-plus`、`qwen3.7-plus`、`qwen3.6-flash` 的质量、速度和工具调用稳定性。

- **Vercel 发布验收流程固化**:
  - 跑通 Vercel CLI 验收：用户完成 `npx vercel login` 授权后，使用 `npx vercel ls` 与 `npx vercel inspect https://echotalent.fun` 确认 `echotalent.fun` 指向最新 Production deployment。
  - 线上刷新 `/chat` 后确认版本标识已更新为 `V4.5.3`，说明 GitHub merge 后 Vercel 正式部署已生效。
  - 将 GitHub 推送后的 Vercel 验收步骤写入 [AGENTS.md](/Users/sue/Documents/trae_projects/career/AGENTS.md)：后续发布默认检查 Production deployment、正式域名 alias、页面版本号和关键页面冒烟测试。
- **生产聊天响应热修跟进**:
  - 修复 `/chat` 顶部版本标识仍显示旧版本的问题，并将聊天模型默认切到 `qwen-turbo`、减少工具轮次，降低普通对话首字等待。
  - 为分布式限流 RPC 增加 900ms 超时兜底；Supabase 或跨区网络抖动时会退回本地内存限流，避免发送消息后先卡在限流检查。
  - 验证：热修已推送到 `origin/v4.5-sharing`；线上 `https://echotalent.fun/chat` 仍显示 `V4.5.1 SHARE`，说明生产部署尚未使用这条热修分支，需要继续确认 Vercel 生产分支或合并到生产分支后再验收。
  - 用户反馈生产 `/chat` 仍出现通用对话错误后，撤回未经质量确认的 `qwen-turbo` 默认模型，恢复为 `qwen-plus` 与 `maxSteps: 5`，优先保证会话质量和工具调用稳定性。
  - 为聊天流式响应增加服务端 `[chat stream error]` 日志与中文错误提示，避免后续只在前端看到 `An error occurred.` 而无法定位真实模型/流式错误。

- **报告分享图文字排版修复**:
  - 修复 [app/report/page.tsx](/Users/sue/Documents/trae_projects/career/app/report/page.tsx) 的 Canvas 分享图换行逻辑：从逐字切分改为 token 级换行，英文单词/数字组合保持整体，中文按字排版，标点跟随上一段文本，避免行首标点和英文被截断。
  - 调整分享图摘要策略：不再展示省略号或半句摘录，正文段落只选择能放下的完整句；原报告句子过长时，使用本地短摘要模板生成完整语义句，优先保证分享图整体表达完整。
  - 进一步调整分享图文案选择策略：顶部摘要优先接近 4 行，能力段落优先接近 3 行且必要时允许到 4 行；候选内容优先来自报告原文、能力描述、技能和岗位方向，避免为了“兜底”选择过短、低信息密度的通用句。
  - 微调能力段落右侧留白和行距，让文本盒子更舒服，不再为了刚好 3 行牺牲页面观感或信息完整度。
  - 分享图缓存 key 升级到 `sharecard-a-v33`，避免用户继续看到旧缓存图。
  - 验证：静态搜索确认旧截断函数和正文省略号生成路径已移除；本地预览 `/report?demo=coordination` 生成分享图，确认顶部和能力段落文本容量提升；`npm run build` 当前被既有 `/auth/callback/page` 与 `/auth/callback/route` 路由冲突及字体网络请求失败阻断，未作为本次修改的通过信号。

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
## 2026-07-17

- **邮箱注册与现实路径认领验收**:
  - Supabase 线上迁移已生效：`anonymous_career_drafts`、`talent_profiles`、`user_context_profiles`、认领 RPC 及幂等字段均可用。
  - 使用 `echotalent@agent.qq.com` 完成真实注册；Resend 经 `welcome@echotalent.fun` 投递验证邮件，QQ 邮箱收到并成功验证。
  - 当前本地代码完成认证初始化、匿名报告草稿认领、对话消息、人才画像、用户上下文和用户资料落库；重复认领返回 `alreadyClaimed: true` 且不产生重复记录。
  - 线上现状：邮件验证可用，`/api/auth/finalize` 已部署，但 `/api/career-path/draft` 与 `/api/career-path/claim` 尚未部署；待将当前本地版本发布到 Vercel 后再做生产复验。
  - 验证结果：本地核心链路通过；生产发布同步为剩余阻塞。
