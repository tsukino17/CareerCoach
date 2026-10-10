import { NextResponse } from 'next/server';

const GPT_SOVITS_API_URL = process.env.GPT_SOVITS_API_URL || 'http://localhost:9880/tts';
const DASHSCOPE_TTS_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FETCH_TIMEOUT_MS = 30_000;

interface GPTSoVITSRequest {
  text: string;
  text_lang: string;
  ref_audio_path: string;
  prompt_text: string;
  prompt_lang: string;
  speed_factor?: number;
  text_split_method?: string;
  batch_size?: number;
  streaming_mode?: boolean;
}

type CoachVoiceStyle = 'coach' | 'inspiration';
type TtsProviderMode = 'auto' | 'dashscope' | 'clone';

type TtsRequestBody = {
  text?: string;
  referenceText?: string;
  filePath?: string;
  instruction?: string;
  voiceStyle?: CoachVoiceStyle;
  providerMode?: TtsProviderMode;
  voice?: string;
  tuning?: {
    speed?: number;
    emotion?: string;
  };
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAudioAsBase64(url: string): Promise<string> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`下载音频失败: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

function buildInspirationInstruction(text: string, tuning?: TtsRequestBody['tuning']) {
  const speed = typeof tuning?.speed === 'number' ? tuning.speed : 0.9;
  const emotion = tuning?.emotion || 'gentle';
  const slower = speed < 0.95 ? '语速偏慢' : '语速自然偏慢';

  return [
    '你是一位适合自由对话、心理支持与灵感整理的中文女声陪伴者。',
    '声音要温暖、真实、细腻、贴近真人，像坐在安静房间里和一个人慢慢说话。',
    '不要客服腔，不要播音腔，不要主持人口吻，不要夸张表演。',
    `${slower}，短句之间留出自然停顿，逗号处轻停，句尾轻轻收住。`,
    '语气要允许对方想法还没成型，像在接住一段散乱但重要的心里话。',
    '带一点疗愈感与陪伴感，但不要神神叨叨，也不要过度抒情。',
    '遇到提问句时要留出邀请感，不要逼问，像在等对方慢慢靠近答案。',
    '在温柔稳定的底色里，带一点轻微的好奇与灵感火花。',
    `情绪基调：${emotion}。`,
    '请按中文语义断句，减少机械连读，避免把所有句子念成同一个节奏。',
    `当前文本：${text.slice(0, 220)}`,
  ].join('');
}

function buildCoachInstruction(text: string) {
  return [
    '请用自然真实的中文女声朗读，语气温和、亲切、清晰。',
    '像一位成熟可靠的陪伴型教练在说话，不要机械，不要客服腔。',
    '语速中等略慢，停顿自然，问题句要有一点引导感。',
    `当前文本：${text.slice(0, 220)}`,
  ].join('');
}

function buildInstruction(text: string, body: TtsRequestBody): string {
  const custom = String(body.instruction || '').trim();
  if (custom) return custom;
  return body.voiceStyle === 'coach'
    ? buildCoachInstruction(text)
    : buildInspirationInstruction(text, body.tuning);
}

async function synthesizeWithDashScope(normalized: string, body: TtsRequestBody) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY');

  const payload = {
    model: 'qwen3-tts-instruct-flash',
    input: {
      text: normalized,
      voice: body.voice || 'Cherry',
      language_type: 'Chinese',
      instructions: buildInstruction(normalized, body),
    },
    parameters: {
      format: 'mp3',
      sample_rate: 44100,
      volume: 50,
      pronunciation_hint: 'auto',
      optimize_instructions: true,
    },
  };

  const response = await fetchWithTimeout(DASHSCOPE_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-SSE': 'disable',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope TTS API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('audio/')) {
    const base64Audio = await response.arrayBuffer().then((b) => Buffer.from(b).toString('base64'));
    return {
      audioContent: base64Audio,
      audioType: 'mp3',
      provider: 'dashscope-qwen-tts',
      modelUsed: 'qwen3-tts-instruct-flash',
      voiceUsed: body.voice || 'Cherry',
      mode: 'instruct',
    };
  }

  const result = (await response.json()) as {
    output?: {
      audio?: { data?: string; url?: string; expires_at?: string };
      audio_url?: string;
    };
    usage?: unknown;
  };

  if (result?.output?.audio?.data) {
    return {
      audioContent: result.output.audio.data,
      audioType: 'mp3',
      provider: 'dashscope-qwen-tts',
      modelUsed: 'qwen3-tts-instruct-flash',
      voiceUsed: body.voice || 'Cherry',
      mode: 'instruct',
      usage: result.usage,
    };
  }

  const audioUrl = result?.output?.audio_url || result?.output?.audio?.url;
  if (audioUrl) {
    const base64Audio = await fetchAudioAsBase64(audioUrl);
    return {
      audioContent: base64Audio,
      audioType: 'mp3',
      provider: 'dashscope-qwen-tts',
      modelUsed: 'qwen3-tts-instruct-flash',
      voiceUsed: body.voice || 'Cherry',
      mode: 'instruct',
      usage: result.usage,
      expiresAt: result?.output?.audio?.expires_at,
    };
  }

  throw new Error(`DashScope 未返回可用音频数据`);
}

async function synthesizeWithClone(normalized: string, body: TtsRequestBody) {
  if (!body.filePath || !body.referenceText?.trim()) {
    throw new Error('语音克隆模式需要参考音频和对应原文');
  }

  const requestBody: GPTSoVITSRequest = {
    text: normalized,
    text_lang: 'zh',
    ref_audio_path: body.filePath,
    prompt_text: String(body.referenceText).trim(),
    prompt_lang: 'zh',
    speed_factor: body.tuning?.speed ?? 1.0,
    text_split_method: 'cut5',
    batch_size: 1,
    streaming_mode: false,
  };

  const response = await fetchWithTimeout(GPT_SOVITS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-SoVITS API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
    const result = await response.json();
    throw new Error((result as { error?: string }).error || 'GPT-SoVITS 未返回音频数据');
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audioContent: Buffer.from(arrayBuffer).toString('base64'),
    audioType: 'wav',
    provider: 'gpt-sovits',
    mode: response.headers.get('x-tts-mode') || 'clone',
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TtsRequestBody;
    const normalized = String(body.text || '').trim();

    if (!normalized) {
      return NextResponse.json({ error: '缺少合成文本' }, { status: 400 });
    }

    const providerMode = body.providerMode || 'auto';

    if (providerMode === 'clone' || (providerMode === 'auto' && body.filePath && body.referenceText?.trim())) {
      const result = await synthesizeWithClone(normalized, body);
      return NextResponse.json(result);
    }

    const result = await synthesizeWithDashScope(normalized, body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '语音生成失败';
    console.error('TTS Error:', error);

    if (message.includes('fetch failed') || message.includes('abort')) {
      return NextResponse.json(
        { error: '语音服务连接超时或失败，请检查 DashScope 或本地 GPT-SoVITS 服务是否可用。' },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
