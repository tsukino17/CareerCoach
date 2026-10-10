'use client';

export function TuningControls({
  speed,
  pitch,
  onSpeedChange,
  onPitchChange,
}: {
  speed: number;
  pitch: number;
  onSpeedChange: (v: number) => void;
  onPitchChange: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-4 text-sm font-medium text-slate-200">微调参数</h3>
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <label className="text-slate-300">语速</label>
            <span className="font-mono text-sky-200">{speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.2"
            step="0.01"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-sky-400"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>0.70x 更慢</span>
            <span>1.20x 更自然</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <label className="text-slate-300">音调参考</label>
            <span className="font-mono text-sky-200">{pitch.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.2"
            step="0.01"
            value={pitch}
            onChange={(e) => onPitchChange(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-sky-400"
          />
        </div>
      </div>
    </div>
  );
}