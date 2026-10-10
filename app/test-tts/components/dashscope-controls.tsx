'use client';

import type { VoiceOption, VoiceStyle } from '../constants';

export function VoiceStyleSelector({
  value,
  onChange,
}: {
  value: VoiceStyle;
  onChange: (v: VoiceStyle) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">语音方向</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: 'inspiration' as VoiceStyle, label: '灵感引导' },
          { value: 'coach' as VoiceStyle, label: '稳定教练' },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`rounded-xl px-4 py-3 text-sm transition ${
              value === item.value ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VoiceSelector({
  options,
  value,
  onChange,
}: {
  options: VoiceOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">音色选择</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((voice) => (
          <button
            key={voice.value}
            onClick={() => onChange(voice.value)}
            className={`rounded-xl px-4 py-3 text-left text-sm transition ${
              value === voice.value ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            <div className="font-medium">{voice.label}</div>
            <div className={`text-xs ${value === voice.value ? 'text-slate-800/80' : 'text-slate-400'}`}>
              {voice.subtitle}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmotionSelector({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">情绪基调</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((emotion) => (
          <button
            key={emotion.value}
            onClick={() => onChange(emotion.value)}
            className={`rounded-xl px-4 py-3 text-sm transition ${
              value === emotion.value ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            {emotion.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InstructionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-slate-300">自定义语音指令</label>
        <span className="text-xs text-slate-400">决定"像谁在说话"</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/30"
        placeholder="例如：请用温暖真实的中文女声朗读，像一位擅长心理支持与冥想陪伴的引导师..."
      />
    </div>
  );
}