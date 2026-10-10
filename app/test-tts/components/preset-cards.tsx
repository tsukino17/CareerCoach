'use client';

import type { VoicePreset } from '../constants';

export function PresetCards({
  presets,
  selectedId,
  active,
  onSelect,
}: {
  presets: VoicePreset[];
  selectedId: string;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-sky-400/20 px-3 py-1 text-xs font-medium text-sky-200">风格预设</span>
        <span className="text-xs text-slate-400">建议先点一张卡片再试听</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedId === preset.id && active
                ? 'border-sky-300 bg-sky-300/12'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-base font-medium text-slate-100">{preset.name}</span>
              <span className="text-xs text-sky-200/80">{preset.speed.toFixed(2)}x</span>
            </div>
            <p className="text-sm leading-6 text-slate-300">{preset.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}