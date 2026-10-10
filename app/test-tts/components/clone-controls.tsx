'use client';

import type { UploadedFile } from '../hooks';

export function CloneControls({
  uploadedFile,
  referenceText,
  referenceTextDisabled,
  recognizing,
  loading,
  onUpload,
  onReferenceTextChange,
  onRemove,
}: {
  uploadedFile: UploadedFile | null;
  referenceText: string;
  referenceTextDisabled: boolean;
  recognizing: boolean;
  loading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReferenceTextChange: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-white/10 bg-emerald-400/6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-200">
            克隆模式
          </span>
          <span className="text-xs text-slate-400">上传样本后会尝试自动识别原文，但不是必需步骤</span>
        </div>

        {uploadedFile ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-emerald-200">样本已上传</p>
                <p className="text-sm text-slate-200">文件名：{uploadedFile.name}</p>
                <p className="text-sm text-slate-300">大小：{uploadedFile.size}</p>
              </div>
              <button
                onClick={onRemove}
                className="rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/15"
              >
                移除
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 p-4">
            <input
              type="file"
              accept="audio/*"
              onChange={onUpload}
              disabled={loading}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-emerald-300"
            />
            <p className="mt-2 text-xs text-slate-400">支持 WAV、MP3、AAC、M4A、FLAC，最大 10MB</p>
          </div>
        )}
      </div>

      <div className={`mb-6 ${!uploadedFile ? 'opacity-50' : ''}`}>
        <label htmlFor="referenceText" className="mb-3 block text-sm font-medium text-slate-200">
          参考音频原文
        </label>
        <textarea
          id="referenceText"
          value={referenceText}
          onChange={(e) => onReferenceTextChange(e.target.value)}
          rows={4}
          disabled={referenceTextDisabled || !uploadedFile}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/30 disabled:opacity-60"
          placeholder={recognizing ? '正在尝试自动识别音频内容...' : '系统已预填示例文本，你可以直接使用或稍作修改'}
        />
        <p className="mt-2 text-xs text-slate-400">
          这一步不是必须自动完成。你可以直接手动输入参考文本；文字越接近样本原文，克隆出来的节奏和断句通常越稳。
        </p>
      </div>
    </>
  );
}