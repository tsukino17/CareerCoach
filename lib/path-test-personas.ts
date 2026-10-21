import type { CareerReport } from '@/lib/career-path';
import type { LegoPath } from '@/lib/path-lego';
import type { EvidenceCard, RealityConstraints } from '@/lib/path-evidence';

/**
 * 现实路径教练测试人物画像库
 *
 * 设计目标：最大化覆盖价值观、能力维度、工作节奏偏好的差异
 * - 商科（文科）：意义驱动 + 自主节奏 + 中等收入预期
 * - 理工科：专业深度 + 安全稳定 + 高收入预期
 * - 艺术（自然）：创造表达 + 多样新鲜 + 低收入容忍度
 *
 * 每个画像都包含：
 * - report: 天赋教练生成的报告（现实路径教练的输入）
 * - persona: 人物背景与核心价值观标签（用于测试 Step 2 价值观匹配）
 * - expectedPath: 预期现实路径走向（用于验证教练引导是否合理）
 */

export type PathTestPersona = {
  id: string;
  name: string;
  age: number;
  background: string;
  currentRole: string;
  yearsOfExperience: number;
  domain: 'business' | 'engineering' | 'art';
  coreValues: Array<
    | 'impact'         // 影响与意义
    | 'mastery'        // 专业深度
    | 'autonomy'       // 自主与节奏
    | 'belonging'      // 连接与归属
    | 'security'       // 安全与稳定
    | 'variety'        // 多样与新鲜
    | 'creativity'     // 创造与表达
    | 'integrity'      // 公正与一致
  >;
  stabilityPreference: 'high' | 'medium' | 'low'; // 能接受的职业稳定性
  incomeExpectation: 'high' | 'medium' | 'low';   // 收入优先级
  pacePreference: 'structured' | 'flexible' | 'burst'; // 工作节奏偏好
  idealRoles: string[];   // 用户心中的理想职业方向（模糊）
  /** 积木③利基主题：细分领域（不是具体岗位名），首选项 */
  nicheTheme: string;
  /** 积木③利基主题候选：市场/行业/赛道语言，1-3 个（nicheTheme 为首选） */
  nicheThemes: string[];
  report: CareerReport;   // 天赋教练生成的报告
  expectedPath: {
    step1RealisticRoles: string[]; // Step 1 现实翻译器应该给出的 5 个相邻岗位
    valuesConflictScenario: string; // Step 2 价值观匹配时可能出现的冲突场景
    valuesAlignedRole: string;     // 价值观最匹配的现实岗位
  };
  /** 乐高组合路径预期（教练在 Step 1b 应碰撞出的组合，用于测试对照） */
  legoPaths: LegoPath[];
  /** 现实约束：时间预算 / 收入断档缓冲 / 不可协商项 / 已有自发行动 */
  realityConstraints: RealityConstraints;
  /** 能力证据卡初始状态（覆盖不同熟练度与确认状态，用于测试确认卡交互） */
  evidenceCards: EvidenceCard[];
};

export const PATH_TEST_PERSONAS: PathTestPersona[] = [
  // ────────────────────────────────────────────────────────────────
  // 画像 1：林晓雨（商科 · 文科）— 意义驱动 + 自主节奏 + 中等收入
  // ────────────────────────────────────────────────────────────────
  {
    id: 'persona_lin_xiaoyu',
    name: '林晓雨',
    age: 28,
    background: '985 高校中文系本科，4 年互联网内容运营经验，最近半年对"为流量写标题党"感到疲惫，开始关注心理学和生涯咨询',
    currentRole: '互联网内容运营',
    yearsOfExperience: 4,
    domain: 'business',
    coreValues: ['impact', 'autonomy', 'integrity'],
    stabilityPreference: 'medium',
    incomeExpectation: 'medium',
    pacePreference: 'flexible',
    idealRoles: ['心理咨询师', '生涯咨询师'],
    nicheTheme: '心理与疗愈行业',
    nicheThemes: ['心理与疗愈行业', '心理健康内容与科普', '生涯成长赛道'],
    report: {
      archetype: '共情表达者',
      skills: ['共情', '表达', '洞察', '连接'],
      rpg_stats: [
        { name: '共情', value: 88 },
        { name: '表达', value: 85 },
        { name: '洞察', value: 76 },
        { name: '执行', value: 62 },
        { name: '逻辑', value: 70 },
      ],
      superpowers: [
        {
          name: '从文字里读出人的真实感受',
          description: '你不只是在写内容，而是能感知到读者在文字背后没被说出口的情绪，然后用语言触达那个位置。',
          potential_roles: ['心理咨询', '生涯咨询', '内容策划'],
        },
        {
          name: '把抽象感受变成可理解的表达',
          description: '你擅长把模糊的、情绪化的体验，翻译成结构化的语言，让别人能"看见"自己的感受。',
          potential_roles: ['心理学科普', '用户研究', '生涯教练'],
        },
      ],
      summary: '你过去 4 年做内容运营，看似在写文案，实际上一直在做"理解人"的工作。你对标题党的疲惫不是能力不够，而是价值观在提醒你：你想做的不是"抓眼球"，而是"真正帮到具体的人"。',
      target_roles: ['心理咨询师', '生涯咨询师', '心理健康内容策划'],
      generated_by: 'model',
    },
    expectedPath: {
      step1RealisticRoles: [
        '员工援助计划专员（EAP）',
        '心理健康内容运营',
        '高校心理中心咨询师',
        '用户研究员（心理学背景岗）',
        '生涯规划师',
      ],
      valuesConflictScenario: '如果教练推荐"互联网大厂员工心理专员"（高薪但 996、KPI 导向），用户的"自主与节奏"价值观会冲突。教练应该指出这个冲突，并推荐"独立生涯咨询师"或"高校心理中心"作为价值观更合的替代。',
      valuesAlignedRole: '独立生涯咨询师 / 高校心理中心咨询师',
    },
    legoPaths: [
      {
        id: 'lin_lego_01',
        title: '线上情绪陪伴倾听师',
        feasibility: 'build',
        narrative: '为高压程序员、新手妈妈等群体提供固定时段的一对一线上倾听陪伴',
        superpower: '深度倾听与共情',
        deliveryFormat: 'project',
        niche: '情绪疗愈',
        quadrant: 'nomad',
        marketDensity: 'created',
        incomeReality: '按次/包月计费起步，前 3 个月客源不稳定，建议保留主业过渡',
      },
      {
        id: 'lin_lego_02',
        title: '心理健康内容策展人',
        feasibility: 'ready',
        narrative: '运营心理科普 Newsletter 或账号，把模糊的情绪体验翻译成大众能懂的表达',
        superpower: '把抽象感受变成可理解的表达',
        deliveryFormat: 'productized',
        niche: '心理科普',
        quadrant: 'nomad',
        marketDensity: 'created',
      },
      {
        id: 'lin_lego_03',
        title: '疗愈工作坊主理人',
        feasibility: 'build',
        narrative: '从助教做起，逐步主理线下正念/书写疗愈工作坊与垂直成长社群',
        superpower: '建立信任与连接',
        deliveryFormat: 'project',
        niche: '身心疗愈',
        quadrant: 'embodied',
        marketDensity: 'created',
        incomeReality: '需要场地与招生投入，建议先在数字游民象限积累受众与现金流',
      },
      {
        id: 'lin_lego_04',
        title: 'EAP 服务专员（受雇起步）',
        feasibility: 'ready',
        narrative: '加入 EAP 服务商或大厂员工关怀团队，把倾听能力用在企业场景',
        superpower: '深度倾听与共情',
        deliveryFormat: 'employment',
        niche: '职场心理健康',
        quadrant: 'embodied',
        marketDensity: 'common',
        incomeReality: '薪资稳定但节奏受 KPI 约束，与你的自主偏好有张力',
      },
      {
        id: 'lin_lego_05',
        title: '高校心理中心咨询师（受雇）',
        feasibility: 'learn',
        narrative: '进入教育系统做心理咨询，与理想职业最接近的体制内落点',
        superpower: '深度倾听与共情',
        deliveryFormat: 'employment',
        niche: '校园心理服务',
        quadrant: 'embodied',
        marketDensity: 'niche',
        incomeReality: '通常要求心理咨询师资质或心理学相关背景，存在门槛',
      },
      {
        id: 'lin_lego_06',
        title: '心理健康内容运营（受雇）',
        feasibility: 'ready',
        narrative: '加入心理健康平台或医疗健康公司，做心理科普内容与用户社群运营，转型期最稳的现实锚点',
        superpower: '把抽象感受变成可理解的表达',
        deliveryFormat: 'employment',
        niche: '心理健康内容',
        quadrant: 'nomad',
        marketDensity: 'common',
        incomeReality: '薪资与现在持平左右，内容岗 KPI 在于流量，注意与"不写标题党"的底线协商边界',
      },
      {
        id: 'lin_lego_07',
        title: '职场叙事教练',
        feasibility: 'build',
        narrative: '帮职场人把散乱的经历翻译成有说服力的简历故事、面试叙事与个人主页文案——你 4 年"替别人把话说到心里"的能力，换个对象就是高单价的专业服务',
        superpower: '把抽象感受变成可理解的表达',
        deliveryFormat: 'project',
        niche: '个人品牌叙事',
        quadrant: 'expert',
        marketDensity: 'created',
        incomeReality: '单次服务可达 500-1500 元，但需先积累 3-5 个口碑案例才能定价',
      },
      {
        id: 'lin_lego_08',
        title: '情绪日记陪伴模板（数字产品）',
        feasibility: 'build',
        narrative: '把心理科普笔记里验证过的方法，做成结构化的情绪日记模板与自助工具包，一次创作反复售卖——你的粉丝已经在为"被看见"付费了',
        superpower: '从文字里读出人的真实感受',
        deliveryFormat: 'productized',
        niche: '情绪自助工具',
        quadrant: 'ai-leveraged',
        marketDensity: 'created',
        incomeReality: '单件定价低但可复售，先在 1200 粉丝里验证付费意愿再投入',
      },
    ],
    realityConstraints: {
      weeklyHours: '每周 6 小时左右（工作日晚间 1 小时 + 周末半天）',
      financialRunway: '约 6 个月（存款 8 万，无房贷，月支出约 6 千）',
      paceIntent: '双线并行——先用心理相关内容岗稳住现金流，同时积累倾听实践与个案小时数',
      hardNo: ['996 或长期加班', '纯销售性质岗位（背业绩指标拉单）', '再写标题党式流量内容'],
      selfInitiated: [
        '已报 3 门心理学网课，完成 2 门',
        '在小红书发心理科普笔记 4 个月，粉丝约 1200',
      ],
    },
    evidenceCards: [
      {
        id: 'lin_evidence_01',
        capability: '用户洞察与内容选题',
        experienceSummary: '运营公司公众号 3 年，从 0 做到 10 万粉，多篇爆款选题来自评论区用户情绪的挖掘',
        reusableAbility: '从大量真实反馈里识别未被满足的需求，并转成可执行的内容选题',
        targetAction: '用户研究：从客户反馈、社群讨论里提炼痛点，形成洞察报告或内容方向',
        proficiency: 'methodized',
        artifact: '公众号后台数据截图 + 代表作《为什么你越努力越焦虑》',
        status: 'confirmed',
        createdAt: '2026-10-19T10:00:00.000Z',
      },
      {
        id: 'lin_evidence_02',
        capability: '一对一深度倾听',
        experienceSummary: '做过半年公司内部新员工 buddy，每周和新人固定聊一次',
        reusableAbility: '在安全氛围里让对方说出真实想法',
        targetAction: '心理服务场景里的倾听与陪伴式面谈',
        proficiency: 'repeated',
        artifact: null,
        status: 'partial',
        userAmendment: '场景是公司内部导师制带新人（每周一次、坚持了半年），还没到专业倾听训练——但真实倾听发生过，先按部分证实记录，个案往后继续攒',
        createdAt: '2026-10-19T10:05:00.000Z',
      },
      {
        id: 'lin_evidence_03',
        capability: '心理学科普写作',
        experienceSummary: '在小红书持续发心理科普笔记 4 个月，把咨询理论写成普通人能看懂的小短文',
        reusableAbility: '把专业概念翻译成大众语言，降低理解门槛',
        targetAction: '心理健康内容创作与科普栏目策划',
        proficiency: 'single',
        artifact: '小红书账号 4 个月笔记记录',
        status: 'pending',
        createdAt: '2026-10-19T10:10:00.000Z',
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // 画像 2：陈树（理工科）— 专业深度 + 安全稳定 + 高收入
  // ────────────────────────────────────────────────────────────────
  {
    id: 'persona_chen_shu',
    name: '陈树',
    age: 32,
    background: '清华计算机本科 + 中科院 AI 方向硕士，6 年大厂算法工程师经验，最近开始思考"做技术到底是为了什么"，想转向 AI 产品经理但担心收入下降',
    currentRole: 'AI 算法工程师',
    yearsOfExperience: 6,
    domain: 'engineering',
    coreValues: ['mastery', 'security', 'impact'],
    stabilityPreference: 'high',
    incomeExpectation: 'high',
    pacePreference: 'structured',
    idealRoles: ['AI 产品经理', '技术战略顾问'],
    nicheTheme: 'AI 与跨境出海',
    nicheThemes: ['AI 与跨境出海', '企业智能化服务', 'B 端效率工具赛道'],
    report: {
      archetype: '系统建构者',
      skills: ['逻辑', '结构化', '洞察', '推进'],
      rpg_stats: [
        { name: '逻辑', value: 92 },
        { name: '结构化', value: 88 },
        { name: '洞察', value: 78 },
        { name: '推进', value: 82 },
        { name: '共情', value: 58 },
      ],
      superpowers: [
        {
          name: '把复杂技术问题拆解成可执行方案',
          description: '你能在技术复杂度、业务目标、资源约束之间找到平衡点，把"看似不可能"的需求拆解成"分阶段可落地"的方案。',
          potential_roles: ['AI 产品经理', '技术架构师', '技术战略'],
        },
        {
          name: '用技术视角看业务问题',
          description: '你不只是在写代码，而是能从业务问题出发，判断"哪些能用技术解决、哪些不能、技术方案的真实成本是什么"。',
          potential_roles: ['技术咨询', 'AI 产品战略', '技术布道'],
        },
      ],
      summary: '你过去 6 年在大厂做算法，看似在执行需求，实际上一直在做"技术判断"的工作。你对"做技术到底为了什么"的困惑不是厌倦技术，而是在寻找技术创造的真正价值。',
      target_roles: ['AI 产品经理', '技术战略顾问', 'AI 解决方案架构师'],
      generated_by: 'model',
    },
    expectedPath: {
      step1RealisticRoles: [
        'AI 产品经理（B 端）',
        'AI 解决方案架构师',
        '技术战略分析师',
        'AI 技术布道师',
        '技术投资人（早期 AI 项目）',
      ],
      valuesConflictScenario: '如果教练推荐"独立 AI 咨询师"（高自主性但收入波动大），用户的"安全与稳定" + "高收入"价值观会冲突。教练应该指出这个冲突，并推荐"大厂 AI 产品经理"或"AI 解决方案架构师"作为价值观更合的替代。',
      valuesAlignedRole: '大厂 AI 产品经理 / AI 解决方案架构师',
    },
    legoPaths: [
      {
        id: 'chen_lego_01',
        title: '垂直行业 AI 工作流搭建者',
        feasibility: 'build',
        narrative: '为中小出海/电商公司搭建自动化内容或数据工作流，按项目或订阅收费',
        superpower: '把复杂问题拆解成可执行方案',
        deliveryFormat: 'productized',
        niche: '跨境出海工具',
        quadrant: 'ai-leveraged',
        marketDensity: 'created',
        incomeReality: '可规模化但需要先做出 1-2 个标杆案例，建议在职过渡',
      },
      {
        id: 'chen_lego_02',
        title: '小微出海企业 AI 外脑',
        feasibility: 'build',
        narrative: '以顾问身份帮小微企业判断"哪些环节值得上 AI、真实成本多少"',
        superpower: '用技术视角看业务问题',
        deliveryFormat: 'project',
        niche: 'AI 战略咨询',
        quadrant: 'expert',
        marketDensity: 'created',
        incomeReality: '单价高但获客靠口碑，前 6 个月现金流断档是常态，与你的稳定性要求冲突需评估',
      },
      {
        id: 'chen_lego_03',
        title: '远程技术顾问（多雇主承接）',
        feasibility: 'ready',
        narrative: '在职期间以副业形态远程承接 2-3 家公司的技术评审/方案咨询',
        superpower: '结构化技术判断',
        deliveryFormat: 'project',
        niche: '技术咨询',
        quadrant: 'nomad',
        marketDensity: 'niche',
        incomeReality: '注意与主雇的利益冲突与竞业边界',
      },
      {
        id: 'chen_lego_04',
        title: 'AI 产品经理（受雇内部转岗）',
        feasibility: 'ready',
        narrative: '在现公司内部转岗 AI 产品，收入与稳定性延续，转型摩擦最小',
        superpower: '技术判断 + 业务理解',
        deliveryFormat: 'employment',
        niche: 'AI 产品',
        quadrant: 'ai-leveraged',
        marketDensity: 'common',
      },
      {
        id: 'chen_lego_05',
        title: 'AI 解决方案架构师（受雇）',
        feasibility: 'build',
        narrative: '云厂商或 AI 服务商的解决方案岗，做技术判断 + 客户沟通，薪资与稳定性都符合你的底线',
        superpower: '用技术视角看业务问题',
        deliveryFormat: 'employment',
        niche: 'AI 解决方案',
        quadrant: 'expert',
        marketDensity: 'common',
        incomeReality: '薪资普遍高于纯产品岗，但有一定客户现场支持，可谈远程比例',
      },
      {
        id: 'chen_lego_06',
        title: 'AI 技术工作坊讲师（线下社区）',
        feasibility: 'build',
        narrative: '给技术社群、企业内训或行业沙龙做线下 AI 工作坊——把"把复杂问题讲明白"放到面对面的教学场景，技术判断力换一种交付形态。放在这里是想让你看见：重人际不等于放弃专业',
        superpower: '把复杂技术问题拆解成可执行方案',
        deliveryFormat: 'project',
        niche: 'AI 技术布道',
        quadrant: 'embodied',
        marketDensity: 'created',
        incomeReality: '单场课酬可观但场次不稳定，与稳定偏好有张力，适合作为主业之外的存在感副线',
      },
    ],
    realityConstraints: {
      weeklyHours: '每周 4 小时（只有工作日晚上，周末要陪家人）',
      financialRunway: '12 个月以上（存款充足），但要求转岗后薪资不低于现在的 80%',
      paceIntent: '短期优先——12 个月内完成转岗，副业只做低摩擦验证，不冒险断收',
      hardNo: ['长期驻场出差', '纯行政协调型岗位（不碰技术判断）', '初创公司用高风险期权换低薪'],
      selfInitiated: [
        '在公司内部已发起过 2 次 AI 工具落地方案评审',
        '维护着一个 800 人的 AI 出海技术交流群',
      ],
    },
    evidenceCards: [
      {
        id: 'chen_evidence_01',
        capability: '技术方案拆解与分期推进',
        experienceSummary: '主导过推荐系统改版项目，把模糊的业务目标拆成 3 期可落地技术方案并推动上线',
        reusableAbility: '在技术复杂度与业务目标之间找平衡，把模糊需求拆成分期可执行的方案',
        targetAction: 'AI 产品经理的需求拆解、优先级判断与分期规划',
        proficiency: 'methodized',
        // 内部技术方案与 PPT 属公司机密，不可公开展示，不作为可展示产物
        artifact: null,
        status: 'confirmed',
        createdAt: '2026-10-19T11:00:00.000Z',
      },
      {
        id: 'chen_evidence_02',
        capability: '跨部门领导力',
        experienceSummary: '拉通过算法、产品、运营三方对齐一个数据口径问题',
        reusableAbility: '跨职能推动共识',
        targetAction: 'AI 产品的跨团队协作与推进',
        proficiency: 'single',
        artifact: null,
        status: 'rejected',
        userAmendment: '我只是拉了个会推动对齐，算不上领导力，别写成带团队',
        createdAt: '2026-10-19T11:05:00.000Z',
      },
      {
        id: 'chen_evidence_03',
        capability: 'AI 能力边界判断',
        experienceSummary: '多次给业务方判断"这个需求值不值得上模型、真实成本多少"，替团队拦下过 3 个伪 AI 需求',
        reusableAbility: '判断哪些问题适合用 AI 解决、哪些用规则更省钱',
        targetAction: 'AI 产品的可行性评估与方案选型',
        proficiency: 'repeated',
        // 内部评审邮件不可公开分享，不作为可展示产物；拦截伪需求的经历本身就是经验证据
        artifact: null,
        status: 'pending',
        createdAt: '2026-10-19T11:10:00.000Z',
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // 画像 3：苏茉（艺术 · 自然）— 创造表达 + 多样新鲜 + 低收入容忍
  // ────────────────────────────────────────────────────────────────
  {
    id: 'persona_su_mo',
    name: '苏茉',
    age: 26,
    background: '美院插画本科 + 英国艺术硕士，2 年商业插画师经验，最近开始厌倦"为品牌画同质化插画"，想做"更有个人表达的作品"但担心生存压力',
    currentRole: '商业插画师',
    yearsOfExperience: 2,
    domain: 'art',
    coreValues: ['creativity', 'variety', 'autonomy'],
    stabilityPreference: 'low',
    incomeExpectation: 'low',
    pacePreference: 'burst',
    idealRoles: ['独立艺术家', '绘本作家'],
    nicheTheme: '生活美学与视觉创作',
    nicheThemes: ['生活美学与视觉创作', '艺术疗愈与文创', '独立出版与周边赛道'],
    report: {
      archetype: '体验创造者',
      skills: ['创造', '表达', '洞察', '共情'],
      rpg_stats: [
        { name: '创造', value: 90 },
        { name: '表达', value: 86 },
        { name: '洞察', value: 74 },
        { name: '共情', value: 80 },
        { name: '结构化', value: 55 },
      ],
      superpowers: [
        {
          name: '用视觉语言讲故事',
          description: '你不只是在"画画"，而是能用图像节奏、色彩情绪、构图张力，讲出文字说不出的故事和感受。',
          potential_roles: ['绘本创作', '艺术疗愈', '独立动画'],
        },
        {
          name: '在日常里发现被忽略的美',
          description: '你有一种能力，能在别人觉得"普通"的场景里看到诗意，并用创作把它放大。',
          potential_roles: ['插画师', '生活美学内容', '艺术教育'],
        },
      ],
      summary: '你过去 2 年做商业插画，看似在"按需求画图"，实际上一直在探索"个人表达 vs 商业需求"的边界。你对同质化商单的厌倦不是能力问题，而是在提醒你：你需要更大的创作空间和更多元的表达方式。',
      target_roles: ['独立绘本作家', '艺术疗愈师', '生活美学内容创作者'],
      generated_by: 'model',
    },
    expectedPath: {
      step1RealisticRoles: [
        '儿童绘本插画师',
        '艺术疗愈工作坊导师',
        '生活美学内容创作者',
        '独立动画短片导演',
        '高校插画课讲师',
      ],
      valuesConflictScenario: '如果教练推荐"广告公司美术指导"（高薪稳定但创作空间小），用户的"创造与表达" + "多样与新鲜"价值观会冲突。教练应该指出这个冲突，并推荐"绘本作家"或"艺术疗愈师"作为价值观更合的替代。',
      valuesAlignedRole: '独立绘本作家 / 艺术疗愈师',
    },
    legoPaths: [
      {
        id: 'su_lego_01',
        title: '独立美学 Newsletter 策展人',
        feasibility: 'ready',
        narrative: '以个人视角策展日常里被忽略的美，积累受众与个人 IP',
        superpower: '在日常里发现被忽略的美',
        deliveryFormat: 'productized',
        niche: '生活美学',
        quadrant: 'nomad',
        marketDensity: 'created',
        incomeReality: '订阅/赞助收入爬坡慢，匹配你的低收入容忍度，但要有 6-12 个月心理预期',
      },
      {
        id: 'su_lego_02',
        title: '插画素材与模板数字产品',
        feasibility: 'build',
        narrative: '把商业插画经验产品化：素材包、模板、贴纸，一次创作多次售卖',
        superpower: '用视觉语言讲故事',
        deliveryFormat: 'productized',
        niche: '创意素材市场',
        quadrant: 'ai-leveraged',
        marketDensity: 'created',
      },
      {
        id: 'su_lego_03',
        title: '商业插画远程多雇主承接',
        feasibility: 'ready',
        narrative: '同时服务 2-3 家品牌方，项目制接单，保留爆发式工作节奏',
        superpower: '视觉表达',
        deliveryFormat: 'project',
        niche: '品牌插画',
        quadrant: 'nomad',
        marketDensity: 'niche',
        incomeReality: '接单平台抽成 10-20%，收入随项目波动',
      },
      {
        id: 'su_lego_04',
        title: '小众美学空间主理人',
        feasibility: 'build',
        narrative: '与主理人合作策划展览/市集，长期可经营自己的美学社群空间',
        superpower: '审美判断与视觉叙事',
        deliveryFormat: 'project',
        niche: '线下美学体验',
        quadrant: 'embodied',
        marketDensity: 'created',
        incomeReality: '启动成本最高，建议先在轻内容象限积累现金流与受众再考虑',
      },
      {
        id: 'su_lego_05',
        title: '小众品牌视觉策略顾问',
        feasibility: 'build',
        narrative: '远期为有审美的独立品牌提供视觉策略，从执行者升级为顾问',
        superpower: '审美判断',
        deliveryFormat: 'project',
        niche: '品牌咨询',
        quadrant: 'expert',
        marketDensity: 'created',
        incomeReality: '需要 3-5 年作品集与行业口碑积累，属远期路径',
      },
      {
        id: 'su_lego_06',
        title: '儿童绘本插画师（受雇）',
        feasibility: 'learn',
        narrative: '加入出版社或童书品牌做签约插画，收入稳定，是离绘本创作最近的受雇落点',
        superpower: '用视觉语言讲故事',
        deliveryFormat: 'employment',
        niche: '儿童绘本',
        quadrant: 'nomad',
        marketDensity: 'common',
        incomeReality: '薪资稳定但选题由编辑主导，个人表达空间有限，适合作为过渡期锚点',
      },
      {
        id: 'su_lego_07',
        title: '在线教育平台视觉设计（受雇）',
        feasibility: 'ready',
        narrative: '为教育产品做课程视觉与插画物料，稳定现金流 + 与美学相关的日常创作',
        superpower: '视觉表达',
        deliveryFormat: 'employment',
        niche: '教育视觉设计',
        quadrant: 'nomad',
        marketDensity: 'common',
        incomeReality: '薪资稳定，注意与副业接单的时间边界，避免竞业冲突',
      },
      {
        id: 'su_lego_08',
        title: 'AI 辅助定制头像工作室',
        feasibility: 'build',
        narrative: '以你的个人风格为底稿、用 AI 工具完成初稿与批量处理，让定制头像/宠物插画的接单量放大而不牺牲风格——效率杠杆不等于放弃创作主导权',
        superpower: '创造有个人审美的视觉表达',
        deliveryFormat: 'productized',
        niche: '定制头像与轻插画',
        quadrant: 'ai-leveraged',
        marketDensity: 'created',
        incomeReality: 'AI 提效后单量可放大 2-3 倍，注意平台对 AI 辅助作品的标注规则',
      },
    ],
    realityConstraints: {
      weeklyHours: '每周 15 小时以上（自由职业时间自主，但商单忙季会被挤占）',
      financialRunway: '约 3 个月（接单收入不稳定，存款只够撑 3 个月）',
      paceIntent: '中长期探索——愿意用 3 个月缓冲试错，但要尽快验证出一条能养活自己的组合',
      hardNo: ['坐班打卡', '赶稿常态化（连续一个月每天出图）', '纯执行型美工（无创作空间）'],
      selfInitiated: [
        '自费参加了 2 个艺术疗愈工作坊（一个线上一个线下）',
        '个人 zine 已独立做 3 期，每期印 100 本在市集卖',
      ],
    },
    evidenceCards: [
      {
        id: 'su_evidence_01',
        capability: '商业项目里的视觉叙事',
        experienceSummary: '2 年里给 10+ 品牌画过整套 campaign 插画，从 brief 到交付独立完成',
        reusableAbility: '把品牌的抽象情绪词翻译成具体画面，并按时按规格交付',
        targetAction: '绘本创作中的图文节奏把控 / 商业项目的视觉方案落地',
        proficiency: 'repeated',
        artifact: '个人作品集网站 + 3 个完整 campaign 案例',
        status: 'confirmed',
        createdAt: '2026-10-19T12:00:00.000Z',
      },
      {
        id: 'su_evidence_02',
        capability: '线下带领创作体验',
        experienceSummary: '在一次市集摆摊时带过路人做过 10 分钟小画练习',
        reusableAbility: '设计并带领短小的创作体验活动',
        targetAction: '艺术疗愈工作坊的暖场与带领环节',
        proficiency: 'single',
        artifact: null,
        status: 'partial',
        userAmendment: '那次更像市集互动小游戏，只做过一次，不能算工作坊经验',
        createdAt: '2026-10-19T12:05:00.000Z',
      },
      {
        id: 'su_evidence_03',
        capability: '个人表达型创作',
        experienceSummary: '自费做了 3 期个人 zine，主题是城市里被忽略的日常瞬间，从选题到印制独立完成',
        reusableAbility: '从个人视角发起并完成完整的创作项目',
        targetAction: '独立绘本的选题、创作与出版流程',
        proficiency: 'repeated',
        artifact: '3 期实体 zine 样本',
        status: 'pending',
        createdAt: '2026-10-19T12:10:00.000Z',
      },
    ],
  },
];

/**
 * 根据 persona id 获取测试画像
 */
export function getPathTestPersona(id: string): PathTestPersona | undefined {
  return PATH_TEST_PERSONAS.find((p) => p.id === id);
}

/**
 * 获取所有测试画像的简要列表（用于测试选择器）
 */
export function listPathTestPersonas() {
  return PATH_TEST_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
    currentRole: p.currentRole,
    coreValues: p.coreValues,
    stabilityPreference: p.stabilityPreference,
    incomeExpectation: p.incomeExpectation,
    pacePreference: p.pacePreference,
  }));
}

/**
 * 核心价值观标签 → 中文映射（用于测试报告显示）
 */
export const CORE_VALUE_LABELS: Record<PathTestPersona['coreValues'][number], string> = {
  impact: '影响与意义',
  mastery: '专业深度',
  autonomy: '自主与节奏',
  belonging: '连接与归属',
  security: '安全与稳定',
  variety: '多样与新鲜',
  creativity: '创造与表达',
  integrity: '公正与一致',
};
