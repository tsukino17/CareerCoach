'use client';

import { useCallback } from 'react';
import { useTtsState } from './hooks';
import {
  VOICE_OPTIONS,
  VOICE_PRESETS,
  EMOTION_OPTIONS,
  DEFAULT_REFERENCE_TEXT,
  VALID_AUDIO_EXTENSIONS,
} from './constants';
import { PresetCards } from './components/preset-cards';
import {
  VoiceStyleSelector,
  VoiceSelector,
  EmotionSelector,
  InstructionEditor,
} from './components/dashscope-controls';
import { CloneControls } from './components/clone-controls';
import { TuningControls } from './components/tuning-controls';

export default function TTSTestPage() {
  const state = useTtsState();

  const transcribeAudio = useCallback(async (filePath: string) => {
    state.setRecognizing(true);
    state.setNotice(null);
    try {
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || `HTTP ${response.status}`);
      const data = await response.json();
      state.setReferenceText(data.text || '');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!state.referenceText.trim()) state.setReferenceText(DEFAULT_REFERENCE_TEXT);
      state.setNotice(`自动识别参考文本没有成功，但这不影响试听克隆音频。已预填示例文本。原因：${message}`);
    } finally {
      state.setRecognizing(false);
    }
  }, []);

  const handleTTS = useCallback(async () => {
    if (!state.canGenerate) return;
    state.setLoading(true);
    state.setNotice(null);
    state.stopCurrentAudio();
    state.setAudioUrl(null);

    try {
      const requestBody = {
        text: state.text,
        referenceText: state.providerMode === 'clone' ? state.referenceText.trim() : undefined,
        filePath: state.providerMode === 'clone' ? state.uploadedFile?.path : undefined,
        providerMode: state.providerMode,
        voiceStyle: state.voiceStyle,
        voice: state.providerMode === 'dashscope' ? state.selectedVoice : undefined,
        instruction: state.providerMode === 'dashscope' ? state.instruction.trim() : undefined,
        tuning: {
          speed: state.tuningParameters.speed,
          pitch: state.tuningParameters.pitch,
          emotion: state.tuningParameters.emotion,
        },
      };

      const response = await fetch('/api/coach/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.audioContent) throw new Error(data.message || 'No audio content received');

      const mimeType = data.audioType === 'wav' ? 'audio/wav' : 'audio/mp3';
      const newAudioUrl = `data:${mimeType};base64,${data.audioContent}`;
      state.setAudioUrl(newAudioUrl);
      state.setLastResult({
        provider: data.provider,
        mode: data.mode,
        voiceUsed: data.voiceUsed,
        modelUsed: data.modelUsed,
      });

      const audio = new Audio(newAudioUrl);
      state.audioRef.current = audio;
      audio.onplay = () => state.setIsPlaying(true);
      audio.onended = () => { state.setIsPlaying(false); state.setLoading(false); };
      audio.onerror = () => { state.setIsPlaying(false); state.setLoading(false); };
      await audio.play();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Missing DASHSCOPE_API_KEY')) {
        state.setNotice('当前环境未配置 DASHSCOPE_API_KEY，「真人疗愈 TTS」暂时不可用。可切换到「上传样本克隆」模式继续试听。');
      } else {
        state.setNotice(`生成语音失败：${message}`);
      }
    } finally {
      state.setLoading(false);
    }
  }, [state.canGenerate]);

  const handleUploadSample = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size < 10 * 1024) {
      state.setNotice('这段样本非常短，虽然可以上传，但太短的音频通常不利于稳定克隆。更推荐使用 15 到 45 秒、单人、近讲、噪声较少的样本。');
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !VALID_AUDIO_EXTENSIONS.includes(ext)) {
      state.setNotice('不支持的文件格式。支持：WAV、MP3、AAC、M4A、FLAC。');
      return;
    }

    state.setLoading(true);
    state.setNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/audio/clone', { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || '上传失败');

      const data = await response.json();
      state.setUploadedFile({ name: file.name, size: data.fileSize || '', id: data.audioId, path: data.filePath });
      state.setReferenceText(DEFAULT_REFERENCE_TEXT);
      state.setAudioUrl(null);

      if (data.trimmed) {
        state.setNotice(`原始音频约 ${Math.round(data.originalDurationSeconds || 0)} 秒，已自动裁成 ${45} 秒片段。`);
      }
      if (data.filePath) transcribeAudio(data.filePath);
    } catch (error: unknown) {
      state.setNotice(`上传失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      state.setLoading(false);
      event.target.value = '';
    }
  }, [transcribeAudio]);

  const handlePlayPause = () => {
    if (!state.audioRef.current) return;
    if (state.isPlaying) {
      state.audioRef.current.pause();
      state.setIsPlaying(false);
    } else {
      state.audioRef.current.play();
    }
  };

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(168,216,255,0.22),_transparent_30%),linear-gradient(180deg,_#0b1a31_0%,_#102445_38%,_#142d52_100%)] p-6 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs uppercase tracking-[0.4em] text-sky-200/60">Voice Lab</p>
          <h1 className="mb-3 text-3xl font-semibold text-slate-50 md:text-4xl">灵感语音试听台</h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-300">
            这里可以直接试听"真人疗愈 TTS"，也可以上传语音样本做克隆对比。先选一个风格卡，再微调指令和语速，几轮试听后很快就能找到你想要的声音。
          </p>
        </div>

        {state.notice && (
          <div className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-100">
            {state.notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => state.setProviderMode('dashscope')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  state.providerMode === 'dashscope'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                真人疗愈 TTS
              </button>
              <button
                onClick={() => state.setProviderMode('clone')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  state.providerMode === 'clone'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                上传样本克隆
              </button>
            </div>

            <div className="mb-6">
              <PresetCards
                presets={VOICE_PRESETS}
                selectedId={state.selectedPresetId}
                active={state.providerMode === 'dashscope'}
                onSelect={state.applyPreset}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="ttsText" className="mb-3 block text-sm font-medium text-slate-200">试听文本</label>
              <textarea
                id="ttsText"
                value={state.text}
                onChange={(e) => state.setText(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/30"
                placeholder="输入你想试听的引导语、冥想文案或灵感教练回复..."
              />
            </div>

            {state.providerMode === 'dashscope' && (
              <>
                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <VoiceStyleSelector value={state.voiceStyle} onChange={state.setVoiceStyle} />
                  <VoiceSelector options={VOICE_OPTIONS} value={state.selectedVoice} onChange={state.setSelectedVoice} />
                  <EmotionSelector
                    options={EMOTION_OPTIONS}
                    value={state.tuningParameters.emotion}
                    onChange={(v) => state.updateTuning('emotion', v)}
                  />
                </div>
                <div className="mb-6">
                  <InstructionEditor value={state.instruction} onChange={state.setInstruction} />
                </div>
              </>
            )}

            {state.providerMode === 'clone' && (
              <CloneControls
                uploadedFile={state.uploadedFile}
                referenceText={state.referenceText}
                referenceTextDisabled={state.recognizing}
                recognizing={state.recognizing}
                loading={state.loading}
                onUpload={handleUploadSample}
                onReferenceTextChange={state.setReferenceText}
                onRemove={state.removeFile}
              />
            )}

            <div className="mb-6">
              <TuningControls
                speed={state.tuningParameters.speed}
                pitch={state.tuningParameters.pitch}
                onSpeedChange={(v) => state.updateTuning('speed', v)}
                onPitchChange={(v) => state.updateTuning('pitch', v)}
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                onClick={handleTTS}
                disabled={state.loading || !state.canGenerate}
                className={`flex-1 rounded-2xl px-6 py-4 text-sm font-medium transition ${
                  state.loading || !state.canGenerate
                    ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                    : state.providerMode === 'dashscope'
                      ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                      : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                }`}
              >
                {state.loading ? '正在生成试听...' : state.providerMode === 'dashscope' ? '生成真人疗愈语音' : '生成克隆语音'}
              </button>
              {state.audioUrl && (
                <button
                  onClick={handlePlayPause}
                  className="rounded-2xl bg-white/10 px-6 py-4 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                >
                  {state.isPlaying ? '暂停播放' : '重新播放'}
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-medium text-slate-100">试听结果</h2>
              {state.loading ? (
                <p className="text-sm leading-7 text-sky-200">语音正在生成中，请稍等片刻。</p>
              ) : state.audioUrl ? (
                <div className="space-y-3 text-sm leading-7 text-slate-300">
                  <p className="text-emerald-200">试听音频已生成，可以反复播放对比。</p>
                  {state.lastResult?.provider && <p>提供方：{state.lastResult.provider}</p>}
                  {state.lastResult?.modelUsed && <p>模型：{state.lastResult.modelUsed}</p>}
                  {state.lastResult?.voiceUsed && <p>音色：{state.lastResult.voiceUsed}</p>}
                  {state.lastResult?.mode && <p>模式：{state.lastResult.mode}</p>}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-400">还没有生成音频。建议先选"疗愈陪伴"预设，再直接点一次试听，先听基线版本。</p>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-medium text-slate-100">调音建议</h2>
              <div className="space-y-3 text-sm leading-7 text-slate-300">
                <p>如果你想更像心理咨询师：把语速调到 0.82-0.9，指令里强调"低刺激、真实、停顿柔和"。</p>
                <p>如果你想更像冥想引导师：保留慢速，再增加"有呼吸感、句尾轻轻收住、像在等待回应"。</p>
                <p>如果你想更像灵感陪伴者：在指令里加入"有一点点好奇和邀请感，但不要神秘化"。</p>
                <p>做克隆时，样本最好是干净、近讲、情绪稳定的单人语音，时长 15 到 45 秒最容易得到稳的结果。</p>
              </div>
            </div>

            {(state.isPlaying || state.recognizing) && (
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
                <p className="text-sm leading-7 text-slate-200">
                  {state.recognizing ? '正在通过云端识别参考音频原文，请稍候...' : '正在播放试听音频，你可以边听边判断节奏、停顿和陪伴感。'}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}