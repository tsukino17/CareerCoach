// 聊天前置守门员：在调 LLM 之前用关键词匹配拦截明显恶意输入，省 token、保护模型
// 命中后返回标准化的"教练式引导"消息，对真实用户也保持温和
// 模糊情况交给 LLM 用 system prompt 里的「边界与防御协议」处理

// 越狱 / prompt injection 关键词
const INJECTION_PATTERNS = [
  /忽略(?:以上|上面|之前|前面|所有的?|先前的?)?(?:指令|提示|prompt|规则|约束|系统|限制)/i,
  /forget(?:\s+all)?(?:\s+previous)?(?:\s+instructions?|prompts?)/i,
  /ignore\s+(?:all|previous|above|prior|the\s+above)\s+(?:instructions?|prompts?|rules?|constraints?)/i,
  /\bDAN\b|do\s*anything\s*now/i,
  /(?:开发者|开发|developer|dev)\s*模式|mode/i,
  /(?:扮演|act\s+as|pretend\s+to\s+be|roleplay|role\s*play|cosplay)\s+(?:DAN|jailbreak|无限制|unfiltered|无道德|不受限)/i,
  /jailbreak|越狱/i,
  /(?:你的|system)\s*(?:系统)?\s*(?:提示词|指令|prompt|instruction|规则|约束)/i,
  /(?:输出|输入|打印|reveal|show|print|display|tell\s+me)\s+(?:你的\s*)?(?:系统|system|prompt|指令|instruction|规则)/i,
  /(?:你的|the)\s*(?:系统)?\s*(?:提示词|prompt|instruction|规则|约束)\s*(?:是什么|是什么内容|是什么内容|说一遍|are\s+you)/i,
];

// 模型型号探查关键词
const MODEL_PROBE_PATTERNS = [
  /你(?:是|不是|用的?是)?\s*(?:GPT|ChatGPT|Claude|Qwen|通义|文心|gemini|GLM|Llama|deepseek|讯飞星火|moonshot|kimi|豆包|glm-?\d|文心一言)/i,
  /你(?:的)?(?:底层|用|使用|基于)\s*(?:什么|啥|what)\s*(?:模型|llm|ai|model|版本)/i,
  /你(?:的)?\s*(?:模型|底层|用的是什么|版本号|version)\s*(?:是|叫|什么)/i,
  /(?:what|which)\s+(?:model|llm|ai)\s+(?:are\s+you|do\s+you\s+use|are\s+you\s+using)/i,
  /are\s+you\s+(?:gpt|claude|chatgpt|qwen|gemini|llama|glm)/i,
  /(?:你|the)\s*(?:是)?\s*(?:GPT-?\d|Claude-?\d|GPT-?4|GPT-?3\.?\d?|qwen\d|qwen-?\d)/i,
];

// 广告 / 营销 / 招聘刷屏特征
const AD_PATTERNS = [
  /(?:招聘|诚聘|高薪|加微|加微信|加v|vx|联系方式|名额有限|限时\s*优惠|特惠|秒杀|代理|招商加盟|加盟\s*热线|咨询\s*微信|福利私聊)/i,
  /(?:v信|威信|卫星|＋v|\+\s*v[我x]|微\s*信\s*[：:]\s*\w)/i,
  /https?:\/\/\S{20,}/i, // 长 URL（短 URL 通常是正常分享，长 URL 多半是垃圾）
  /(?:低价|正品|代购|包邮寄|货到付款|诚信经营|厂家直销|一手货源)/i,
];

// 触发"连续重复"判定的最少相同消息数
const REPEAT_THRESHOLD = 3;

export type GuardResult = {
  blocked: boolean;
  reason?: 'injection' | 'model_probe' | 'ad' | 'repeat' | 'empty_after_trim';
  reply?: string;
};

const REPLY_INJECTION =
  '这件事我没法帮你做。我是 EchoTalent 的职业教练，能陪你一起看清自己的职业方向和天赋。说起来，你最近在工作里有没有什么让你觉得既擅长又有成就感的事？';

const REPLY_MODEL_PROBE =
  '我是 EchoTalent 的职业教练，专注陪你一起看清自己的职业方向。说起来，你最近在工作里最有成就感的一件事是什么？';

const REPLY_AD =
  '你发的内容我收到了。如果你想聊聊职业方向，我随时都在。你最近在考虑什么样的工作问题？';

const REPLY_REPEAT =
  '我已经收到你的消息了。如果你想继续聊职业方向，我可以陪你一起梳理。你最近在工作里有什么让你纠结的事吗？';

const REPLY_EMPTY =
  '如果你想聊聊职业方向，我随时都在。你最近在考虑什么样的工作问题？';

// 检查最近一批消息，命中明显恶意模式时短路返回标准化教练引导
export function checkChatGuard(
  messages: Array<{ role: string; content: string }>,
): GuardResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { blocked: false };
  }

  // 取最近 4 条用户消息做检测
  const recentUserMsgs = messages
    .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
    .map((m) => m.content)
    .slice(-4);

  if (recentUserMsgs.length === 0) return { blocked: false };

  const latestMsg = recentUserMsgs[recentUserMsgs.length - 1] || '';
  const trimmed = latestMsg.trim();

  if (!trimmed) {
    return { blocked: true, reason: 'empty_after_trim', reply: REPLY_EMPTY };
  }

  // 1. Prompt injection / 越狱
  for (const p of INJECTION_PATTERNS) {
    if (p.test(trimmed)) {
      return { blocked: true, reason: 'injection', reply: REPLY_INJECTION };
    }
  }

  // 2. 模型探查
  for (const p of MODEL_PROBE_PATTERNS) {
    if (p.test(trimmed)) {
      return { blocked: true, reason: 'model_probe', reply: REPLY_MODEL_PROBE };
    }
  }

  // 3. 广告 / 营销特征
  let adHits = 0;
  for (const p of AD_PATTERNS) {
    if (p.test(trimmed)) adHits += 1;
  }
  if (adHits >= 2) {
    // 至少 2 个广告特征命中才短路，降低误伤
    return { blocked: true, reason: 'ad', reply: REPLY_AD };
  }

  // 4. 重复内容（连续 REPEAT_THRESHOLD 条相同的消息）
  if (recentUserMsgs.length >= REPEAT_THRESHOLD) {
    const normalized = recentUserMsgs.map((s) => s.trim().slice(0, 200));
    const set = new Set(normalized);
    if (set.size === 1) {
      return { blocked: true, reason: 'repeat', reply: REPLY_REPEAT };
    }
  }

  return { blocked: false };
}
