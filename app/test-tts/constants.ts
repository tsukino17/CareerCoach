export type ProviderMode = 'dashscope' | 'clone';
export type VoiceStyle = 'inspiration' | 'coach';

export interface TuningState {
  speed: number;
  pitch: number;
  emotion: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  voiceStyle: VoiceStyle;
  speed: number;
  emotion: string;
  instruction: string;
}

export interface VoiceOption {
  value: string;
  label: string;
  subtitle: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { value: 'Cherry', label: 'Cherry', subtitle: '自然明亮女声' },
  { value: 'Serena', label: 'Serena', subtitle: '温柔疗愈女声' },
  { value: 'Ethan', label: 'Ethan', subtitle: '温暖陪伴男声' },
  { value: 'Chelsie', label: 'Chelsie', subtitle: '轻盈二次元女声' },
];

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'healing',
    name: '疗愈陪伴',
    description: '最适合灵感模式，温柔、慢、真实，像一位安静陪伴的引导师。',
    voiceStyle: 'inspiration',
    speed: 0.9,
    emotion: 'gentle',
    instruction:
      '请用温暖真实的中文女声朗读，像一位擅长心理支持与冥想陪伴的引导师。语速偏慢，停顿柔和自然，有呼吸感，不要客服腔，不要播音腔，不要夸张。句尾轻轻收住，提问句要有邀请感。',
  },
  {
    id: 'deep-calm',
    name: '深夜安抚',
    description: '更低刺激、更沉静，适合情绪起伏大或睡前场景。',
    voiceStyle: 'inspiration',
    speed: 0.82,
    emotion: 'calm',
    instruction:
      '请用低刺激、沉静、真实的中文女声朗读。像深夜里轻声陪伴来访者的心理支持者。语速很慢，停顿更长，气息平稳，声音柔软但不虚弱，不要表演感。',
  },
  {
    id: 'inspiration-guide',
    name: '灵感火花',
    description: '温柔里带一点轻轻发亮的好奇感，最接近"会聊天的灵感教练"。',
    voiceStyle: 'inspiration',
    speed: 0.91,
    emotion: 'hopeful',
    instruction:
      '请用温柔细腻、真实自然的中文女声朗读，像一位很会陪人慢慢靠近内心的灵感教练。整体要柔和、低刺激、有呼吸感，但在稳定的底色里带一点轻轻发亮的好奇与灵感火花。语速自然偏慢，停顿柔和，提问句要像在邀请对方继续往里看一点，不要神秘化，不要像主持人，也不要像上课。',
  },
  {
    id: 'grounded-coach',
    name: '稳定教练',
    description: '更清晰、更可靠，适合需要安定感和边界感的对话。',
    voiceStyle: 'coach',
    speed: 0.96,
    emotion: 'steady',
    instruction:
      '请用自然、稳定、可信赖的中文女声朗读，像一位成熟的陪伴型教练。表达清晰，有温度但不过度抒情，语速中等偏慢，停顿自然，不要机械。',
  },
];

export const EMOTION_OPTIONS = [
  { value: 'gentle', label: '温柔' },
  { value: 'calm', label: '平静' },
  { value: 'hopeful', label: '有希望感' },
  { value: 'steady', label: '稳定' },
];

export const DEFAULT_SYNTHESIS_TEXT =
  '先不用急着把答案想清楚。让肩膀轻轻落下来，慢慢吸气四拍，再把气呼长一点。等心里安静一点点以后，你会发现，那里好像正有一个很小的念头在发亮。它现在更像一句话，一个画面，还是一种感觉？';

export const DEFAULT_REFERENCE_TEXT =
  '你好，今天想和你分享一件小事。最近我一直在慢慢调整自己的状态，也想试着把心里的想法更清楚地说出来。';

export const VALID_AUDIO_EXTENSIONS = ['wav', 'mp3', 'aac', 'm4a', 'flac'];