import { useCallback, useMemo, useRef, useState } from 'react';
import type { ProviderMode, TuningState, VoiceStyle } from './constants';
import {
  DEFAULT_REFERENCE_TEXT,
  DEFAULT_SYNTHESIS_TEXT,
  VOICE_PRESETS,
} from './constants';

export interface UploadedFile {
  name: string;
  size: string;
  id: string;
  path: string;
}

export interface TtsResult {
  provider?: string;
  mode?: string;
  voiceUsed?: string;
  modelUsed?: string;
}

export function useTtsState() {
  const [text, setText] = useState(DEFAULT_SYNTHESIS_TEXT);
  const [referenceText, setReferenceText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [providerMode, setProviderMode] = useState<ProviderMode>('dashscope');
  const [selectedVoice, setSelectedVoice] = useState('Cherry');
  const [selectedPresetId, setSelectedPresetId] = useState(VOICE_PRESETS[0].id);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>(VOICE_PRESETS[0].voiceStyle);
  const [instruction, setInstruction] = useState(VOICE_PRESETS[0].instruction);
  const [tuningParameters, setTuningParameters] = useState<TuningState>({
    speed: VOICE_PRESETS[0].speed,
    pitch: 1.0,
    emotion: VOICE_PRESETS[0].emotion,
  });
  const [lastResult, setLastResult] = useState<TtsResult | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canGenerate = useMemo(() => {
    if (!text.trim()) return false;
    if (providerMode === 'clone') return !!uploadedFile && !!referenceText.trim();
    return true;
  }, [text, providerMode, uploadedFile, referenceText]);

  const stopCurrentAudio = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = VOICE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setProviderMode('dashscope');
    setVoiceStyle(preset.voiceStyle);
    setInstruction(preset.instruction);
    setTuningParameters((prev) => ({ ...prev, speed: preset.speed, emotion: preset.emotion }));
  }, []);

  const updateTuning = useCallback((key: keyof TuningState, value: string | number) => {
    setTuningParameters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setReferenceText('');
    setAudioUrl(null);
    stopCurrentAudio();
  }, [stopCurrentAudio]);

  return {
    text, setText,
    referenceText, setReferenceText,
    isPlaying, setIsPlaying,
    loading, setLoading,
    recognizing, setRecognizing,
    audioUrl, setAudioUrl,
    notice, setNotice,
    uploadedFile, setUploadedFile,
    providerMode, setProviderMode,
    selectedVoice, setSelectedVoice,
    selectedPresetId,
    voiceStyle, setVoiceStyle,
    instruction, setInstruction,
    tuningParameters, setTuningParameters,
    lastResult, setLastResult,
    audioRef,
    canGenerate,
    stopCurrentAudio,
    applyPreset,
    updateTuning,
    removeFile,
  };
}