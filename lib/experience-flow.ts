import { REPORT_STORAGE_KEY } from '@/lib/career-path';

export const ACTION_COACH_RECORDS_KEY = 'career_action_coach_records';
export const ACTION_VISION_STORAGE_KEY = 'career_action_identity_vision';
export const ACTION_COACH_MEMORY_KEY = 'career_action_coach_memory';
export const TALENT_REDO_NUDGE_KEY = 'career_talent_redo_nudge_v1';

export type ExperienceStage =
  | 'new'
  | 'report_ready'
  | 'direction_ready'
  | 'active'
  | 'stale';

export type ExperienceSnapshot = {
  hasReport: boolean;
  hasVision: boolean;
  hasRecords: boolean;
  hasMemory: boolean;
  recentRecordAt: string | null;
  recentMemoryAt: string | null;
  recordCount: number;
  memoryCount: number;
};

export type TalentRedoNudge = {
  shouldSuggest: boolean;
  reason: string;
};

export function readExperienceSnapshot(): ExperienceSnapshot {
  if (typeof window === 'undefined') {
    return {
      hasReport: false,
      hasVision: false,
      hasRecords: false,
      hasMemory: false,
      recentRecordAt: null,
      recentMemoryAt: null,
      recordCount: 0,
      memoryCount: 0,
    };
  }

  const report = safeParse(window.localStorage.getItem(REPORT_STORAGE_KEY));
  const vision = safeParse(window.localStorage.getItem(ACTION_VISION_STORAGE_KEY));
  const records = safeParse(window.localStorage.getItem(ACTION_COACH_RECORDS_KEY));
  const memory = safeParse(window.localStorage.getItem(ACTION_COACH_MEMORY_KEY));

  const normalizedRecords = Array.isArray(records) ? records : [];
  const normalizedMemory = Array.isArray(memory) ? memory : [];
  const recentRecordAt = getRecentDate(normalizedRecords, 'createdAt');
  const recentMemoryAt = getRecentDate(normalizedMemory, 'createdAt');

  return {
    hasReport: Boolean(report),
    hasVision: Boolean(vision),
    hasRecords: normalizedRecords.length > 0,
    hasMemory: normalizedMemory.length > 0,
    recentRecordAt,
    recentMemoryAt,
    recordCount: normalizedRecords.length,
    memoryCount: normalizedMemory.length,
  };
}

export function resolveExperienceStage(snapshot: ExperienceSnapshot): ExperienceStage {
  if (!snapshot.hasReport) return 'new';
  if ((snapshot.hasRecords || snapshot.hasMemory) && isRecent(snapshot.recentRecordAt || snapshot.recentMemoryAt, 5)) {
    return 'active';
  }
  if (snapshot.hasVision || snapshot.hasRecords || snapshot.hasMemory) {
    return 'stale';
  }
  return 'report_ready';
}

export function getExperienceNextPath(snapshot: ExperienceSnapshot): string {
  const stage = resolveExperienceStage(snapshot);
  if (stage === 'new') return '/chat';
  if (stage === 'report_ready') return '/path';
  if (stage === 'active') return '/path';
  if (snapshot.hasVision) return '/path';
  return '/path';
}

function safeParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getRecentDate(items: Array<Record<string, unknown>>, key: string) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const value = items[i]?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

function isRecent(rawDate: string | null, withinDays: number) {
  if (!rawDate) return false;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;
  const diff = Date.now() - date.getTime();
  return diff <= withinDays * 24 * 60 * 60 * 1000;
}

function daysSince(rawDate: string | null) {
  if (!rawDate) return null;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function getTalentRedoNudge(snapshot: ExperienceSnapshot): TalentRedoNudge {
  if (!snapshot.hasReport) {
    return { shouldSuggest: false, reason: '' };
  }

  const lastActiveDays = daysSince(snapshot.recentRecordAt || snapshot.recentMemoryAt);
  const hasEnoughHistory = snapshot.recordCount >= 4 || snapshot.memoryCount >= 3;

  if (hasEnoughHistory && lastActiveDays !== null && lastActiveDays >= 14) {
    return {
      shouldSuggest: true,
      reason: '你之前已经行动过一段时间，最近又停了一阵。如果现在的自己和最初做报告时已经有些不同，重新做一次天赋对话会更容易重新对齐方向。',
    };
  }

  if (snapshot.hasVision && hasEnoughHistory && lastActiveDays !== null && lastActiveDays >= 21) {
    return {
      shouldSuggest: true,
      reason: '你已经走到愿景和行动阶段了。如果现在反复犹豫、判断不稳，重新做一次天赋对话可以帮助你更新对自己的理解，而不是只在原地硬推。',
    };
  }

  return { shouldSuggest: false, reason: '' };
}

export function shouldDisplayTalentRedoNudge() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(TALENT_REDO_NUDGE_KEY);
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw) as { dismissedAt?: string };
    if (!parsed.dismissedAt) return true;
    const days = daysSince(parsed.dismissedAt);
    return days === null || days >= 14;
  } catch {
    return true;
  }
}

export function dismissTalentRedoNudge() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    TALENT_REDO_NUDGE_KEY,
    JSON.stringify({ dismissedAt: new Date().toISOString() })
  );
}
