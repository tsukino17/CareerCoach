'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  ArrowLeft,
  Sparkles,
  Target,
  Star,
  Activity,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  X,
  Wallet,
  Building2,
  Zap,
  HeartHandshake,
  Clock,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanCard } from '@/components/plan-card';

const REPORT_STORAGE_KEY = 'career_report_v1';

interface RPGStat {
  name: string;
  value: number;
}

interface ReportData {
  archetype: string;
  skills: string[];
  rpg_stats?: RPGStat[];
  superpowers: (string | { name: string; description: string; potential_roles?: string[] })[];
  summary: string;
  target_roles?: string[]; // Added for selected roles
}

interface RoleAnalysis {
  responsibilities: string[];
  daily_routine: string;
  why_fit: string;
  salary_range: string;
  industries_companies: string[];
  core_competencies: string[];
  selection_advice: string;
}

interface RoleComparison {
  role1_analysis: {
    role_name: string;
    salary_range: string;
    match_score: number;
    pros: string[];
    cons: string[];
  };
  role2_analysis: {
    role_name: string;
    salary_range: string;
    match_score: number;
    pros: string[];
    cons: string[];
  };
  comparison_summary: string;
  recommendation: string;
}

interface ActionPlanData {
  goal: string;
  duration: string;
  phases: Array<{
    week: string;
    theme: string;
    tasks: Array<{
      day: string;
      action: string;
      type: 'learning' | 'action' | 'connection' | 'reflection';
    }>;
  }>;
}

type SharePower = {
  name: string;
  description: string;
  roles: string[];
};

function buildSharePowers(report: ReportData): SharePower[] {
  return (report.superpowers || [])
    .map((p) => {
      if (typeof p === 'string') {
        return {
          name: '天赋能力',
          description: p,
          roles: [],
        };
      }

      return {
        name: p.name,
        description: p.description,
        roles: p.potential_roles || [],
      };
    })
    .filter((p) => p.description)
    .slice(0, 3);
}

function buildShareDescription(summary: string): string {
  const normalized = (summary || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const hardLimit = 180;
  if (normalized.length <= hardLimit) return normalized;

  const windowStart = Math.max(0, hardLimit - 60);
  const windowText = normalized.slice(windowStart, hardLimit);
  const match = windowText.match(/.*[。！？；;]/);
  if (match && match[0]) {
    const cut = windowStart + match[0].length;
    return normalized.slice(0, cut).trim();
  }

  const lastComma = Math.max(windowText.lastIndexOf('，'), windowText.lastIndexOf(','));
  if (lastComma > 20) {
    return (normalized.slice(0, windowStart + lastComma).trimEnd() + '。').trim();
  }

  const lastSpace = windowText.lastIndexOf(' ');
  if (lastSpace > 30) {
    return (normalized.slice(0, windowStart + lastSpace).trimEnd() + '。').trim();
  }

  return (normalized.slice(0, hardLimit).trimEnd() + '。').trim();
}

function RadarChart({ stats }: { stats: RPGStat[] }) {
  const [size, setSize] = useState(260);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setSize(mq.matches ? 320 : 260);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!stats || stats.length === 0) return null;

  const center = size / 2;
  const edgePadding = Math.round(size * 0.08);
  const labelRadius = center - edgePadding;
  const radius = Math.round(labelRadius * 0.62);
  const levels = 4;

  const clampValue = (v: number) => Math.max(0, Math.min(100, v));

  const angleForIndex = (index: number, total: number) =>
    (Math.PI * 2 * index) / total - Math.PI / 2;

  const buildPoint = (value: number, index: number, total: number) => {
    const angle = angleForIndex(index, total);
    const r = radius * (clampValue(value) / 100);
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return `${x},${y}`;
  };

  const points = stats
    .map((stat, index) => buildPoint(stat.value, index, stats.length))
    .join(' ');

  const levelPolygons = Array.from({ length: levels }).map((_, levelIndex) => {
    const levelRadius = radius * ((levelIndex + 1) / levels);
    const levelPoints = stats
      .map((_, index) => {
        const angle = angleForIndex(index, stats.length);
        const x = center + levelRadius * Math.cos(angle);
        const y = center + levelRadius * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <polygon
        key={levelIndex}
        points={levelPoints}
        fill="none"
        stroke="rgba(148, 163, 184, 0.4)"
        strokeWidth={0.5}
      />
    );
  });

  const axes = stats.map((_, index) => {
    const angle = angleForIndex(index, stats.length);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return (
      <line
        key={index}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="rgba(148, 163, 184, 0.5)"
        strokeWidth={0.5}
      />
    );
  });

  const labels = stats.map((stat, index) => {
    const angle = angleForIndex(index, stats.length);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const textAnchor: 'start' | 'middle' | 'end' = cos > 0.22 ? 'start' : cos < -0.22 ? 'end' : 'middle';
    const dominantBaseline: 'middle' | 'hanging' | 'text-after-edge' =
      sin > 0.75 ? 'hanging' : sin < -0.75 ? 'text-after-edge' : 'middle';
    const isSmall = size < 300;
    const labelOffset = Math.round(size * (isSmall ? 0.045 : 0.07));
    const r = radius + labelOffset;
    const x = center + r * cos;
    const y = center + r * sin;
    const dy = sin > 0.75 ? 6 : sin < -0.75 ? -6 : Math.round(sin * (isSmall ? 4 : 6));
    const fontSize = isSmall ? (stat.name.length >= 6 ? 10 : 11) : 13;

    return (
      <text
        key={stat.name}
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
        className="fill-slate-600"
        style={{ fontSize, fontWeight: 400 }}
        dy={dy}
      >
        {stat.name}
      </text>
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto overflow-visible"
    >
      <g>
        {levelPolygons}
        {axes}
        <polygon
          points={points}
          fill="rgba(59, 130, 246, 0.25)"
          stroke="rgba(37, 99, 235, 0.9)"
          strokeWidth={1.5}
        />
        {stats.map((stat, index) => {
          const angle = angleForIndex(index, stats.length);
          const r = radius * (clampValue(stat.value) / 100);
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);
          return (
            <circle
              key={stat.name}
              cx={x}
              cy={y}
              r={3}
              fill="rgba(37, 99, 235, 1)"
            />
          );
        })}
        {labels}
      </g>
    </svg>
  );
}

 function FormatSummary({ text }: { text: string }) {
  if (!text) return null;
  // Split by straight or curly quotes
  const parts = text.split(/['‘’]/);
  
  return (
     <p className="mt-6 text-sm leading-relaxed text-foreground/90 font-normal text-justify">
      {parts.map((part, index) => {
        // Odd indices are the quoted (emphasized) parts
        if (index % 2 === 1) {
          return (
            <span key={index} className="text-primary font-bold mx-0.5">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function JobListItem({ text, dotClass }: { text: React.ReactNode; dotClass?: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-foreground/80 leading-7">
      <span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", dotClass || "bg-primary/40")} />
      <span>{text}</span>
    </li>
  );
}

function LoadingState({ type = 'single' }: { type?: 'single' | 'comparison' }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = type === 'single' ? [
    "正在检索行业数据...",
    "正在分析岗位核心职责...",
    "正在匹配您的核心优势...",
    "正在生成典型工作场景...",
    "正在整理薪资与发展前景..."
  ] : [
    "正在对比两个职位的核心差异...",
    "正在评估薪资与发展潜力...",
    "正在分析优劣势匹配度...",
    "正在生成最终建议..."
  ];

  useEffect(() => {
    const duration = 20000; // 20 seconds total expected wait
    const interval = 100;
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev; // Stall at 95% until done
        return prev + increment;
      });
    }, interval);

    const messageTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000); // Change message every 3 seconds

    return () => {
      clearInterval(timer);
      clearInterval(messageTimer);
    };
  }, [messages.length]);

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-6 p-8">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
      </div>
      
      <div className="w-full max-w-xs space-y-2 text-center">
        <p className="text-sm font-medium text-foreground/80 animate-pulse">
          {messages[messageIndex]}
        </p>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground pt-1">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [analyzingRole, setAnalyzingRole] = useState<string | null>(null);
  const [roleAnalysis, setRoleAnalysis] = useState<RoleAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysisRequest, setLastAnalysisRequest] = useState<{ role: string; context: string } | null>(null);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [planData, setPlanData] = useState<ActionPlanData | null>(null);

  const [comparisonData, setComparisonData] = useState<RoleComparison | null>(null);
  const [showComparisonSheet, setShowComparisonSheet] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [lastComparisonRequest, setLastComparisonRequest] = useState<string[] | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [isRenderingShare, setIsRenderingShare] = useState(false);
  const [shareImgUrl, setShareImgUrl] = useState<string | null>(null);
  const shareImgKeyRef = useRef<string | null>(null);

  const shareUrl = useMemo(() => {
    return 'https://echotalent.fun/';
  }, []);
  const reportArchetype = report?.archetype ?? '';

  useEffect(() => {
    const savedReport = localStorage.getItem(REPORT_STORAGE_KEY);
    if (savedReport) {
      try {
        setReport(JSON.parse(savedReport));
      } catch (e) {
        console.error('Failed to parse report:', e);
      }
    } else {
      router.push('/chat');
    }
  }, [router]);

  const postJsonWithTimeout = async <T,>(url: string, body: unknown, timeoutMs = 45000, retry = 1): Promise<T> => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error('请求失败');
      }
      return (await res.json()) as T;
    } catch (e) {
      if (retry > 0) {
        return postJsonWithTimeout<T>(url, body, timeoutMs, retry - 1);
      }
      throw e;
    }
  };

  const toggleRoleSelection = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    } else {
      if (selectedRoles.length >= 2) {
        // Optional: Show toast "Max 2 roles"
        return;
      }
      setSelectedRoles(prev => [...prev, role]);
    }
  };

  const analyzeRole = async (role: string, context: string) => {
    setAnalyzingRole(role);
    setShowRoleSheet(true);
    setRoleAnalysis(null);
    setAnalysisError(null);
    setLastAnalysisRequest({ role, context });
    
    try {
      const data = await postJsonWithTimeout<RoleAnalysis>('/api/analyze-role', {
        role,
        archetype: report?.archetype,
        context,
      });
      setRoleAnalysis(data);
    } catch (error) {
      console.error('Failed to analyze role:', error);
      setAnalysisError('当前网络较慢或服务拥堵。请稍后重试。');
      setAnalyzingRole(null);
    } finally {
      // Keep analyzingRole set so sheet knows what we're looking at
    }
  };

  const compareRoles = async (roles: string[]) => {
    setShowComparisonSheet(true);
    setComparisonData(null);
    setComparisonError(null);
    setLastComparisonRequest(roles);
    setAnalyzingRole('comparison');

    try {
      const data = await postJsonWithTimeout<RoleComparison>('/api/compare-roles', {
        roles,
        archetype: report?.archetype,
        context: report?.superpowers,
      });
      setComparisonData(data);
    } catch (error) {
      console.error('Failed to compare roles:', error);
      setComparisonError('当前网络较慢或服务拥堵。请稍后重试。');
    } finally {
      setAnalyzingRole(null);
    }
  };

  const getRoleContext = () => {
    const first = report?.superpowers?.[0];
    if (typeof first === 'string') return 'User selected role';
    if (first && typeof first === 'object') {
      const name = (first as { name?: unknown })?.name;
      if (typeof name === 'string' && name.trim()) return name;
    }
    return 'User selected role';
  };

  const analyzeRoles = async () => {
    if (selectedRoles.length === 0) return;

    if (selectedRoles.length === 1) {
      // Analyze single role
      const role = selectedRoles[0];
      const context = getRoleContext();
      analyzeRole(role, context);
    } else {
      // Compare 2 roles
      await compareRoles(selectedRoles);
    }
  };

  const renderShareImage = useMemo(() => {
    const fnv1a = (str: string) => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };

    const isWeChat = () =>
      typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent || '');

    const blobToDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
      });

    const buildShareCacheKey = (data: ReportData, url: string) => {
      const powers = buildSharePowers(data).map((p) => ({
        n: p.name,
        d: p.description,
        r: (p.roles || []).slice(0, 5),
      }));
      const rawRoles = buildSharePowers(data)
        .flatMap((p) => p.roles)
        .filter(Boolean)
        .map((r) => r.replace(/（.*?）|\(.*?\)/g, '').trim())
        .filter(Boolean);
      const roles = Array.from(new Set(rawRoles)).slice(0, 5);
      const payload = JSON.stringify({
        v: 29,
        a: data.archetype || '',
        s: buildShareDescription(data.summary || ''),
        p: powers,
        r: roles,
        u: url,
      });
      return `sharecard-a-v29:${fnv1a(payload)}`;
    };

    const shareCacheRequest = (key: string) =>
      new Request(`https://sharecard.local/${encodeURIComponent(key)}.png`, {
        method: 'GET',
      });

    const getCachedBlobUrl = async (key: string) => {
      if (typeof window === 'undefined') return null;
      if (!('caches' in window)) return null;
      try {
        const cache = await caches.open('career-sharecard-v1');
        const res = await cache.match(shareCacheRequest(key));
        if (!res) return null;
        const blob = await res.blob();
        if (isWeChat()) return blobToDataUrl(blob);
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    };

    const putCachedBlob = async (key: string, blob: Blob) => {
      if (typeof window === 'undefined') return;
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('career-sharecard-v1');
        await cache.put(
          shareCacheRequest(key),
          new Response(blob, {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
          })
        );
      } catch {
        return;
      }
    };

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });

    const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
      const lines: string[] = [];
      const normalized = (text || '').replace(/\s+/g, ' ').trim();
      if (!normalized) return lines;

      const forbiddenLineStart = new Set([
        '，',
        '。',
        '、',
        '；',
        '：',
        '！',
        '？',
        '）',
        '】',
        '』',
        '”',
        '’',
        ',',
        '.',
        ';',
        '!',
        '?',
        '%',
        '…',
      ]);
      const openingChars = new Set(['“', '‘', '（', '【', '《', '"', "'"]);

      let line = '';
      for (const ch of normalized.split('')) {
        const next = line + ch;
        if (ctx.measureText(next).width <= maxWidth) {
          line = next;
          continue;
        }

        if (line && forbiddenLineStart.has(ch)) {
          let moved = '';
          while (line.length > 1 && ctx.measureText(line + ch).width > maxWidth) {
            moved = line.slice(-1) + moved;
            line = line.slice(0, -1);
          }
          if (ctx.measureText(line + ch).width <= maxWidth) {
            lines.push(line + ch);
            line = moved || '';
            continue;
          }
        }

        if (line && openingChars.has(line.slice(-1))) {
          const open = line.slice(-1);
          const rest = line.slice(0, -1);
          if (rest) lines.push(rest);
          line = open + ch;
          continue;
        }

        if (line) lines.push(line);
        line = ch;
      }
      if (line) lines.push(line);

        for (let i = 1; i < lines.length; i++) {
        let curr = lines[i] || '';
        let prev = lines[i - 1] || '';
        if (!curr || !prev) continue;

        const needsFix = () => curr.length <= 1 || forbiddenLineStart.has(curr[0]);
        let guard = 0;
          while (guard < 10 && needsFix() && prev.length > 1) {
          let take = curr.length <= 1 ? 2 : 1;
            take = Math.min(Math.max(take, prev.length === 2 ? 2 : 1), prev.length - 1);
          let segment = prev.slice(-take);
          while (segment && forbiddenLineStart.has(segment[0]) && take < prev.length - 1) {
            take += 1;
            segment = prev.slice(-take);
          }
          if (!segment) break;

          const nextPrev = prev.slice(0, -take);
          const nextCurr = segment + curr;

            if ((nextPrev || '').trim().length < 2) break;
          if (ctx.measureText(nextCurr).width > maxWidth) break;
          if (forbiddenLineStart.has(nextCurr[0])) break;

          prev = nextPrev;
          curr = nextCurr;
          guard += 1;
        }

        lines[i - 1] = prev;
        lines[i] = curr;
      }

      return lines;
    };

    const roundRectPath = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const drawShareCardA = async (data: ReportData) => {
      const W = 1080;
      const H = 1600;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      const archetype = (data.archetype || '').trim();
      const powers = buildSharePowers(data).slice(0, 3);
      const rawRoles = buildSharePowers(data)
        .flatMap((p) => p.roles)
        .filter(Boolean)
        .map((r) => r.replace(/（.*?）|\(.*?\)/g, '').trim())
        .filter(Boolean);
      const roles = Array.from(new Set(rawRoles)).slice(0, 5);

      const paletteKey = (() => {
        const t = `${archetype}`;
        if (/(灵光|洞察|直觉|创意|想象)/.test(t)) return 'spark';
        if (/(执行|行动|冲刺|推进|落地)/.test(t)) return 'execute';
        if (/(共情|疗愈|温柔|连接|照护)/.test(t)) return 'empathy';
        if (/(系统|逻辑|秩序|结构|规划)/.test(t)) return 'system';
        return 'sunrise';
      })();

      const palette = (() => {
        if (paletteKey === 'spark') {
          return {
            bgA: '#FFFBF9',
            bgB: '#F2EAE0',
            blob1: '#B4D3D9',
            blob2: '#BDA6CE',
            text: '#1A3263',
            muted: '#547792',
            hero: '#1A3263',
            card: 'rgba(255,255,255,0.40)',
            cardHi: 'rgba(255,255,255,0.18)',
            tagBg: 'rgba(255,255,255,0.38)',
            tagText: '#1A3263',
            accents: ['#547792', '#9B8EC7', '#6b7a8f'],
            dots: ['rgba(180,211,217,0.9)', 'rgba(189,166,206,0.75)', 'rgba(242,234,224,0.9)'],
          };
        }
        if (paletteKey === 'execute') {
          return {
            bgA: '#FFFBF9',
            bgB: '#F5E9D8',
            blob1: '#FFC570',
            blob2: '#EFD2B0',
            text: '#1A3263',
            muted: '#547792',
            hero: '#1A3263',
            card: 'rgba(255,255,255,0.38)',
            cardHi: 'rgba(255,255,255,0.16)',
            tagBg: 'rgba(255,255,255,0.34)',
            tagText: '#1A3263',
            accents: ['#547792', '#1A3263', '#6b6b6b'],
            dots: ['rgba(255,197,112,0.75)', 'rgba(239,210,176,0.9)', 'rgba(84,119,146,0.35)'],
          };
        }
        if (paletteKey === 'empathy') {
          return {
            bgA: '#FFFBF9',
            bgB: '#FFFBF1',
            blob1: '#FFF2D0',
            blob2: '#FFB2B2',
            text: '#2C2C2C',
            muted: '#612D53',
            hero: '#612D53',
            card: 'rgba(255,255,255,0.38)',
            cardHi: 'rgba(255,255,255,0.16)',
            tagBg: 'rgba(255,255,255,0.34)',
            tagText: '#612D53',
            accents: ['#612D53', '#853953', '#2C2C2C'],
            dots: ['rgba(255,178,178,0.8)', 'rgba(255,242,208,0.9)', 'rgba(227,106,106,0.45)'],
          };
        }
        return {
          bgA: '#FFFBF9',
          bgB: '#F2EAE0',
          blob1: '#B4D3D9',
          blob2: '#BDA6CE',
          text: '#1A3263',
          muted: '#547792',
          hero: '#1A3263',
          card: 'rgba(255,255,255,0.40)',
          cardHi: 'rgba(255,255,255,0.18)',
          tagBg: 'rgba(255,255,255,0.38)',
          tagText: '#1A3263',
          accents: ['#547792', '#9B8EC7', '#6b7a8f'],
          dots: ['rgba(180,211,217,0.9)', 'rgba(189,166,206,0.75)', 'rgba(242,234,224,0.9)'],
        };
      })();

      const ensureSentenceEnd = (text: string) => {
        const t = (text || '').replace(/\s+/g, ' ').trim();
        if (!t) return '';
        if (/[。！？；;.!?…]$/.test(t)) return t;
        if (t.length <= 12) return t;
        if (/[，,、]$/.test(t)) return (t.slice(0, -1).trimEnd() + '。').trim();
        return (t + '。').trim();
      };

      const normalizeShareTextBase = (text: string) => {
        let t = (text || '').replace(/\s+/g, ' ').trim();
        if (!t) return '';
        t = t.replace(/‘/g, '“');
        t = t.replace(/’/g, '”');
        t = t.replace(/[—–]{2,}/g, '，');
        t = t.replace(/\s+/g, ' ').trim();
        return t;
      };

      const compressShareText = (text: string) => {
        let t = normalizeShareTextBase(text);
        if (!t) return '';
        t = t.replace(/（[^）]*）|\([^)]*\)/g, '');
        t = t.replace(/某种程度上|一定程度上|相对来说|总体而言|整体来看|从某种意义上说/g, '');
        t = t.replace(/能够/g, '能');
        t = t.replace(/可以/g, '可');
        t = t.replace(/不断|持续/g, '');
        t = t.replace(/同时|并且|而且/g, '');
        t = t.replace(/你不是([^，。]{2,28})[，,]\s*而是/g, '你并非$1，更像是');
        t = t.replace(/不是([^，。]{2,28})[，,]\s*而是/g, '并非$1，更像是');
        t = t.replace(/\s+/g, ' ').trim();
        t = t.replace(/。{2,}/g, '。');
        return t;
      };

      const takeMeaningful = (text: string, hardLimit: number) => {
        const normalized = (text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';
        if (normalized.length <= hardLimit) return ensureSentenceEnd(normalized);
        const windowStart = Math.max(0, hardLimit - 60);
        const windowText = normalized.slice(windowStart, hardLimit);
        const match = windowText.match(/.*[。！？；;]/);
        if (match && match[0]) {
          const cut = windowStart + match[0].length;
          return ensureSentenceEnd(normalized.slice(0, cut).trim());
        }
        const lastComma = Math.max(windowText.lastIndexOf('，'), windowText.lastIndexOf(','));
        if (lastComma > 20) {
          return ensureSentenceEnd(normalized.slice(0, windowStart + lastComma).trimEnd());
        }
        const lastSpace = windowText.lastIndexOf(' ');
        if (lastSpace > 30) {
          return ensureSentenceEnd(normalized.slice(0, windowStart + lastSpace).trimEnd());
        }
        return ensureSentenceEnd(normalized.slice(0, hardLimit).trimEnd());
      };

      const fitTextToMaxLines = (text: string, maxWidth: number, maxLines: number, initialLimit: number) => {
        const normalized = compressShareText(text);
        if (!normalized) return [];

        const firstSentenceMatch = normalized.match(/^[\s\S]*?[。！？；;]/);
        const candidates = [
          firstSentenceMatch?.[0]?.trim() ? ensureSentenceEnd(firstSentenceMatch[0].trim()) : '',
          normalized,
        ].filter(Boolean);

        for (const base of candidates) {
          let limit = initialLimit;
          for (let i = 0; i < 28; i++) {
            const excerpt = takeMeaningful(base, limit);
            const lines = wrapLines(ctx, excerpt, maxWidth);
            if (lines.length <= maxLines) return lines;
            limit = Math.max(24, limit - 8);
          }
        }

        let limit = Math.min(80, initialLimit);
        while (limit >= 12) {
          const excerpt = takeMeaningful(normalized, limit);
          const lines = wrapLines(ctx, excerpt, maxWidth);
          if (lines.length <= maxLines) return lines;
          limit -= 2;
        }

        for (let hard = 10; hard >= 4; hard--) {
          const tiny = takeMeaningful(normalized, hard);
          const lines = wrapLines(ctx, tiny, maxWidth);
          if (lines.length <= maxLines) return lines;
        }

        return [ellipsizeToWidth(ensureSentenceEnd(normalized), maxWidth)];
      };

      const fitTextToPreferLines = (
        text: string,
        maxWidth: number,
        maxLines: number,
        initialLimit: number,
        minLines: number
      ) => {
        const normalized = compressShareText(text);
        if (!normalized) return [];

        let best: { lines: string[]; length: number } | null = null;
        let limit = initialLimit;
        for (let i = 0; i < 36; i++) {
          const excerpt = takeMeaningful(normalized, limit);
          const lines = wrapLines(ctx, excerpt, maxWidth);
          if (lines.length <= maxLines) {
            if (lines.length >= minLines) return lines;
            const len = excerpt.length;
            if (!best || lines.length > best.lines.length || (lines.length === best.lines.length && len > best.length)) {
              best = { lines, length: len };
            }
          }
          limit = Math.max(36, limit - 10);
        }

        return best?.lines ?? fitTextToMaxLines(normalized, maxWidth, maxLines, Math.min(initialLimit, 220));
      };

      const fitTextToPreferLinesWithTracking = (
        text: string,
        maxWidth: number,
        maxLines: number,
        initialLimit: number,
        minLines: number,
        tracking: number
      ) => {
        const normalized = compressShareText(text);
        if (!normalized) return [];

        let best: { lines: string[]; length: number } | null = null;
        let limit = initialLimit;
        for (let i = 0; i < 36; i++) {
          const excerpt = takeMeaningful(normalized, limit);
          const lines = wrapLinesWithTracking(excerpt, maxWidth, tracking);
          if (lines.length <= maxLines) {
            if (lines.length >= minLines) return lines;
            const len = excerpt.length;
            if (!best || lines.length > best.lines.length || (lines.length === best.lines.length && len > best.length)) {
              best = { lines, length: len };
            }
          }
          limit = Math.max(36, limit - 10);
        }

        if (best) return best.lines;
        return [ellipsizeToWidthWithTracking(ensureSentenceEnd(normalized), maxWidth, tracking)];
      };

      const fitFontSizeToWidth = (
        text: string,
        maxWidth: number,
        base: { weight: number; size: number; family: string },
        minSize: number
      ) => {
        let size = base.size;
        while (size >= minSize) {
          ctx.font = `${base.weight} ${size}px ${base.family}`;
          if (ctx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      };

      const measureTextWithTracking = (text: string, tracking: number) => {
        const chars = (text || '').split('');
        if (chars.length === 0) return 0;
        let w = 0;
        for (let i = 0; i < chars.length; i++) {
          w += ctx.measureText(chars[i]).width;
          if (i < chars.length - 1) w += tracking;
        }
        return w;
      };

      const wrapLinesWithTracking = (text: string, maxWidth: number, tracking: number) => {
        const lines: string[] = [];
        const normalized = (text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return lines;

        const forbiddenLineStart = new Set([
          '，',
          '。',
          '、',
          '；',
          '：',
          '！',
          '？',
          '）',
          '】',
          '』',
          '”',
          '’',
          ',',
          '.',
          ';',
          '!',
          '?',
          '%',
          '…',
        ]);
        const openingChars = new Set(['“', '‘', '（', '【', '《', '"', "'"]);

        let line = '';
        for (const ch of normalized.split('')) {
          const next = line + ch;
          if (measureTextWithTracking(next, tracking) <= maxWidth) {
            line = next;
            continue;
          }

          if (line && forbiddenLineStart.has(ch)) {
            let moved = '';
            while (line.length > 1 && measureTextWithTracking(line + ch, tracking) > maxWidth) {
              moved = line.slice(-1) + moved;
              line = line.slice(0, -1);
            }
            if (measureTextWithTracking(line + ch, tracking) <= maxWidth) {
              lines.push(line + ch);
              line = moved || '';
              continue;
            }
          }

          if (line && openingChars.has(line.slice(-1))) {
            const open = line.slice(-1);
            const rest = line.slice(0, -1);
            if (rest) lines.push(rest);
            line = open + ch;
            continue;
          }

          if (line) lines.push(line);
          line = ch;
        }
        if (line) lines.push(line);

        for (let i = 1; i < lines.length; i++) {
          let curr = lines[i] || '';
          let prev = lines[i - 1] || '';
          if (!curr || !prev) continue;

          const needsFix = () => curr.length <= 1 || forbiddenLineStart.has(curr[0]);
          let guard = 0;
          while (guard < 10 && needsFix() && prev.length > 1) {
            let take = curr.length <= 1 ? 2 : 1;
            take = Math.min(Math.max(take, prev.length === 2 ? 2 : 1), prev.length - 1);
            let segment = prev.slice(-take);
            while (segment && forbiddenLineStart.has(segment[0]) && take < prev.length - 1) {
              take += 1;
              segment = prev.slice(-take);
            }
            if (!segment) break;

            const nextPrev = prev.slice(0, -take);
            const nextCurr = segment + curr;

            if ((nextPrev || '').trim().length < 2) break;
            if (measureTextWithTracking(nextCurr, tracking) > maxWidth) break;
            if (forbiddenLineStart.has(nextCurr[0])) break;

            prev = nextPrev;
            curr = nextCurr;
            guard += 1;
          }

          lines[i - 1] = prev;
          lines[i] = curr;
        }

        return lines;
      };

      const fitFontSizeToWidthWithTracking = (
        text: string,
        maxWidth: number,
        base: { weight: number; size: number; family: string; tracking: number },
        minSize: number
      ) => {
        let size = base.size;
        while (size >= minSize) {
          ctx.font = `${base.weight} ${size}px ${base.family}`;
          if (measureTextWithTracking(text, base.tracking) <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      };

      const drawTextWithTracking = (text: string, x: number, y: number, tracking: number) => {
        let cx = x;
        for (const ch of (text || '').split('')) {
          ctx.fillText(ch, cx, y);
          cx += ctx.measureText(ch).width + tracking;
        }
      };

      const ellipsizeToWidthWithTracking = (text: string, maxWidth: number, tracking: number) => {
        const t = (text || '').trim();
        if (!t) return '';
        if (measureTextWithTracking(t, tracking) <= maxWidth) return t;
        const ell = '…';
        if (measureTextWithTracking(ell, tracking) > maxWidth) return ell;
        let lo = 0;
        let hi = t.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const candidate = t.slice(0, mid) + ell;
          if (measureTextWithTracking(candidate, tracking) <= maxWidth) lo = mid;
          else hi = mid - 1;
        }
        return t.slice(0, lo) + ell;
      };

      const ellipsizeToWidth = (text: string, maxWidth: number) => {
        const t = (text || '').trim();
        if (!t) return '';
        if (ctx.measureText(t).width <= maxWidth) return t;
        const ell = '…';
        if (ctx.measureText(ell).width > maxWidth) return ell;
        let lo = 0;
        let hi = t.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const candidate = t.slice(0, mid) + ell;
          if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
          else hi = mid - 1;
        }
        return t.slice(0, lo) + ell;
      };

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = palette.bgA;
      ctx.fillRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, palette.bgA);
      bg.addColorStop(1, palette.bgB);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const blob = (x: number, y: number, r: number, c: string, a = 0.7) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      blob(240, 280, 520, palette.blob1, 0.32);
      blob(900, 420, 560, palette.blob2, 0.28);
      blob(220, 1240, 520, palette.blob2, 0.18);
      blob(980, 1320, 560, palette.blob1, 0.18);

      const cardX = 70;
      const cardY = 80;
      const cardW = 940;
      const cardH = 1440;
      const cardR = 30;

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;
      roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.fillStyle = palette.card;
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
      ctx.clip();
      const sheen = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      sheen.addColorStop(0, palette.cardHi);
      sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.10)');
      ctx.fillStyle = sheen;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.restore();

      const pad = 64;
      const innerX = cardX + pad;
      const innerY = cardY + pad;
      const innerW = cardW - pad * 2;

      ctx.fillStyle = palette.muted;
      ctx.font =
        '500 30px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('你的职业原型是', innerX, innerY + 16);

      ctx.fillStyle = palette.hero;
      const heroFamily = '"Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      const heroTracking = 0.8;
      const heroMinSize = 84;
      const heroSize = fitFontSizeToWidthWithTracking(
        archetype,
        innerW,
        { weight: 800, size: 98, family: heroFamily, tracking: heroTracking },
        heroMinSize
      );
      ctx.font = `800 ${heroSize}px ${heroFamily}`;
      const heroText =
        measureTextWithTracking(archetype, heroTracking) > innerW
          ? ellipsizeToWidthWithTracking(archetype, innerW, heroTracking)
          : archetype;
      drawTextWithTracking(heroText, innerX, innerY + 150, heroTracking);

      ctx.fillStyle = palette.muted;
      ctx.font =
        '400 28px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      const subtitleSource = [data.summary || '', powers[0]?.description || ''].filter(Boolean).join(' ');
      const subtitleMaxLines = 5;
      const subtitleMinLines = 4;
      const subtitleForbiddenStart = new Set([
        '，',
        '。',
        '、',
        '；',
        '：',
        '！',
        '？',
        '）',
        '】',
        '』',
        '”',
        '’',
        ',',
        '.',
        ';',
        '!',
        '?',
        '%',
        '…',
      ]);
      const hasBadLine = (ls: string[]) =>
        ls.some((l) => {
          const t = (l || '').trim();
          if (!t) return true;
          if (t.length <= 1) return true;
          return subtitleForbiddenStart.has(t[0]);
        });
      const wrapByTracking = (text: string, tracking: number) =>
        tracking ? wrapLinesWithTracking(text, innerW, tracking) : wrapLines(ctx, text, innerW);

      const pickSubtitle = (raw: string) => {
        const base = normalizeShareTextBase(raw);
        const fullTry = wrapByTracking(base, 0);
        if (fullTry.length <= subtitleMaxLines && fullTry.length >= subtitleMinLines && !hasBadLine(fullTry)) {
          return { lines: fullTry, tracking: 0 };
        }

        const trackings = [0, -0.4, -0.8, -1.2];
        for (const tracking of trackings) {
          const baseLines = wrapByTracking(base, tracking);
          if (baseLines.length <= subtitleMaxLines && baseLines.length >= subtitleMinLines && !hasBadLine(baseLines)) {
            return { lines: baseLines, tracking };
          }
        }

        const compressed = compressShareText(raw);
        const sentenceCuts: number[] = [];
        for (let i = 0; i < compressed.length; i++) {
          const ch = compressed[i];
          if (ch === '。' || ch === '！' || ch === '？' || ch === '；' || ch === '…') sentenceCuts.push(i + 1);
        }
        const clauseCuts: number[] = [];
        for (let i = 0; i < compressed.length; i++) {
          const ch = compressed[i];
          if (ch === '，' || ch === '、' || ch === '：') clauseCuts.push(i + 1);
        }
        const candidates = Array.from(new Set<number>([...sentenceCuts, ...clauseCuts, compressed.length])).sort(
          (a, b) => a - b
        );

        for (const tracking of trackings) {
          let best: { lines: string[]; len: number } | null = null;
          for (const cut of candidates) {
            let excerpt = compressed.slice(0, cut).trim();
            if (!excerpt) continue;
            if (!/[。！？；;.!?…]$/.test(excerpt)) excerpt = ensureSentenceEnd(excerpt);
            const ls = wrapByTracking(excerpt, tracking);
            if (ls.length > subtitleMaxLines) continue;
            if (hasBadLine(ls)) continue;
            if (ls.length >= subtitleMinLines) {
              best = { lines: ls, len: excerpt.length };
            } else if (!best || ls.length > best.lines.length || (ls.length === best.lines.length && excerpt.length > best.len)) {
              best = { lines: ls, len: excerpt.length };
            }
          }
          if (best && best.lines.length >= subtitleMinLines) return { lines: best.lines, tracking };
        }

        const fallbackTracking = -0.8;
        const fallbackLines = wrapByTracking(ensureSentenceEnd(compressed), fallbackTracking);
        return { lines: fallbackLines.slice(0, subtitleMaxLines), tracking: fallbackTracking };
      };

      const pickBlockText = (raw: string, maxWidth: number, maxLines: number, minLines: number) => {
        const forbiddenStart = subtitleForbiddenStart;
        const hasBad = (ls: string[]) =>
          ls.some((l) => {
            const t = (l || '').trim();
            if (!t) return true;
            if (t.length <= 1) return true;
            return forbiddenStart.has(t[0]);
          });
        const wrapAt = (text: string, tracking: number) =>
          tracking ? wrapLinesWithTracking(text, maxWidth, tracking) : wrapLines(ctx, text, maxWidth);

        const base = normalizeShareTextBase(raw);
        const trackings = [0, -0.4, -0.8, -1.2];

        for (const tracking of trackings) {
          const lines = wrapAt(base, tracking);
          if (lines.length <= maxLines && !hasBad(lines) && lines.length >= minLines) {
            return { lines, tracking };
          }
          if (lines.length <= maxLines && !hasBad(lines) && minLines <= 1) {
            return { lines, tracking };
          }
        }

        const compressed = compressShareText(raw);
        const sentenceCuts: number[] = [];
        const clauseCuts: number[] = [];
        for (let i = 0; i < compressed.length; i++) {
          const ch = compressed[i];
          if (ch === '。' || ch === '！' || ch === '？' || ch === '；' || ch === '…') sentenceCuts.push(i + 1);
          if (ch === '，' || ch === '、' || ch === '：') clauseCuts.push(i + 1);
        }
        const unique = (arr: number[]) => Array.from(new Set<number>(arr)).sort((a, b) => a - b);
        const candidatesSentence = unique([...sentenceCuts, compressed.length]);
        const candidatesClause = unique([...clauseCuts, ...sentenceCuts, compressed.length]);

        const pickByCuts = (cuts: number[], tracking: number) => {
          let best: { lines: string[]; len: number } | null = null;
          for (const cut of cuts) {
            let excerpt = compressed.slice(0, cut).trim();
            if (!excerpt) continue;
            if (!/[。！？；;.!?…]$/.test(excerpt)) excerpt = ensureSentenceEnd(excerpt);
            const ls = wrapAt(excerpt, tracking);
            if (ls.length > maxLines) continue;
            if (hasBad(ls)) continue;
            if (!best || excerpt.length > best.len) best = { lines: ls, len: excerpt.length };
          }
          return best?.lines ?? null;
        };

        for (const tracking of trackings) {
          const bySentence = pickByCuts(candidatesSentence, tracking);
          if (bySentence && bySentence.length >= minLines) return { lines: bySentence, tracking };
        }
        for (const tracking of trackings) {
          const byClause = pickByCuts(candidatesClause, tracking);
          if (byClause && byClause.length >= minLines) return { lines: byClause, tracking };
        }

        for (const tracking of trackings) {
          for (let limit = 220; limit >= 60; limit -= 12) {
            const excerpt = takeMeaningful(compressed, limit);
            const ls = wrapAt(excerpt, tracking);
            if (ls.length > maxLines) continue;
            if (hasBad(ls)) continue;
            if (ls.length >= minLines) return { lines: ls, tracking };
          }
        }

        const fallbackTracking = -0.8;
        const fallbackLines = wrapAt(ensureSentenceEnd(compressed), fallbackTracking);
        return { lines: fallbackLines.slice(0, maxLines), tracking: fallbackTracking };
      };

      const subtitlePicked = pickSubtitle(subtitleSource);
      const descLines = subtitlePicked.lines;
      const subtitleTracking = subtitlePicked.tracking;
      let dy = innerY + 220;
      for (const line of descLines) {
        if (subtitleTracking) drawTextWithTracking(line, innerX, dy, subtitleTracking);
        else ctx.fillText(line, innerX, dy);
        dy += 46;
      }

      const panelsTop = Math.max(innerY + 360, dy + 18);
      const panelGap = 28;
      const leftW = 520;
      const rightW = innerW - leftW - panelGap;
      const leftX = innerX;
      const rightX = innerX + leftW + panelGap;
      const panelR = 28;

      const drawGlassPanel = (x: number, y: number, w: number, h: number) => {
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 10;
        roundRectPath(ctx, x, y, w, h, panelR);
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        roundRectPath(ctx, x, y, w, h, panelR);
        ctx.clip();
        const hlg = ctx.createLinearGradient(x, y, x, y + h);
        hlg.addColorStop(0, 'rgba(255,255,255,0.18)');
        hlg.addColorStop(0.55, 'rgba(255,255,255,0.04)');
        hlg.addColorStop(1, 'rgba(255,255,255,0.10)');
        ctx.fillStyle = hlg;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      };

      const footerY = cardY + cardH - 54;
      const rolesInset = 34;
      const rolesX = rightX + rolesInset;
      const rolesW = rightW - rolesInset * 2;

      const qrSize = 152;
      const qrBlockH = qrSize + 36;

      const maxPanelBottom = footerY - 46;
      const minLeftPanelH = 820;
      const leftPanelH = Math.min(Math.max(minLeftPanelH, 760), maxPanelBottom - panelsTop);
      const leftPanelBottom = panelsTop + leftPanelH;

      const qrX = rolesX + Math.floor((rolesW - qrSize) / 2);
      const qrY = leftPanelBottom - qrBlockH;

      const rightPanelH = Math.max(380, qrY - panelsTop - 36);

      drawGlassPanel(leftX, panelsTop, leftW, leftPanelH);
      drawGlassPanel(rightX, panelsTop, rightW, rightPanelH);

      ctx.fillStyle = palette.text;
      ctx.font =
        '800 34px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('你的天赋能力', leftX + 34, panelsTop + 68);
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX + 34, panelsTop + 86);
      ctx.lineTo(leftX + 160, panelsTop + 86);
      ctx.stroke();
      ctx.restore();

      let py = panelsTop + 148;
      for (let i = 0; i < powers.length; i++) {
        const p = powers[i];
        const tColor = palette.accents[i % palette.accents.length];
        const dColor = palette.dots[i % palette.dots.length];

        ctx.save();
        if (i === 2) {
          ctx.fillStyle = palette.accents[i % palette.accents.length];
          ctx.globalAlpha = 0.32;
        } else {
          ctx.fillStyle = dColor;
        }
        ctx.beginPath();
        ctx.arc(leftX + 42, py - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(leftX + 42, py - 10, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = tColor;
        const titleFamily =
          '"Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
        const titleMaxW = leftW - 90;
        const titleSize = fitFontSizeToWidth(p.name, titleMaxW, { weight: 650, size: 30, family: titleFamily }, 22);
        ctx.font = `650 ${titleSize}px ${titleFamily}`;
        ctx.fillText(p.name, leftX + 60, py);

        ctx.fillStyle = palette.muted;
        ctx.font =
          '400 24px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
        const picked = pickBlockText(p.description, leftW - 80, 3, 1);
        let ly = py + 46;
        for (const line of picked.lines) {
          if (picked.tracking) drawTextWithTracking(line, leftX + 60, ly, picked.tracking);
          else ctx.fillText(line, leftX + 60, ly);
          ly += 40;
        }
        py = ly + 28;
        if (py > panelsTop + leftPanelH - 80) break;
      }

      ctx.fillStyle = palette.text;
      ctx.font =
        '800 34px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('可能适合做', rightX + 34, panelsTop + 68);
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rightX + 34, panelsTop + 86);
      ctx.lineTo(rightX + 150, panelsTop + 86);
      ctx.stroke();
      ctx.restore();

      const cols = 1;
      const colGap = 0;
      const rowGap = 10;
      const colW = Math.floor((rolesW - colGap) / cols);
      const listTop = panelsTop + 126;
      const maxY = qrY - 22;

      const itemFontFamily =
        '"Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.font = `450 18px ${itemFontFamily}`;
      const tagInsetX = 16;
      const tagInsetY = 10;
      const tagTextPad = 10;
      const tagWrapWidth = colW - tagInsetX * 2 - tagTextPad * 2;
      const splitRoleLabel = (raw: string) => {
        const text = (raw || '').replace(/\s+/g, ' ').trim();
        if (!text) return { firstLine: '', secondLine: '' };
        if (ctx.measureText(text).width <= tagWrapWidth) {
          return { firstLine: ellipsizeToWidth(text, tagWrapWidth), secondLine: '' };
        }

        const addCandidate = (set: Set<number>, idx: number) => {
          const i = Math.floor(idx);
          if (i >= 2 && i <= text.length - 2) set.add(i);
        };

        const bestSplit = (() => {
          const candidates = new Set<number>();
          const bonuses = new Map<number, number>();
          const mark = (idx: number, bonus: number) => {
            const i = Math.floor(idx);
            if (i < 2 || i > text.length - 2) return;
            bonuses.set(i, Math.max(bonuses.get(i) ?? 0, bonus));
            candidates.add(i);
          };

          addCandidate(candidates, Math.floor(text.length / 2));
          addCandidate(candidates, 6);

          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === ' ' || ch === '-' || ch === '·' || ch === '/' || ch === '&') mark(i + 1, 180);
          }

          const breakAfter = [
            '职业',
            '行业',
            '教育',
            '心理',
            '产品',
            '运营',
            '市场',
            '增长',
            '安全',
            '数据',
            '项目',
            '组织',
            '人力',
            '品牌',
            '用户',
            '客户',
            '商业',
            '技术',
            '研发',
            '设计',
            '咨询',
            '内容',
            '策略',
            '体验',
          ];
          for (const kw of breakAfter) {
            let pos = text.indexOf(kw);
            while (pos !== -1) {
              mark(pos + kw.length, 280);
              pos = text.indexOf(kw, pos + 1);
            }
          }

          const breakBefore = [
            '顾问',
            '教练',
            '讲师',
            '设计师',
            '工程师',
            '经理',
            '专家',
            '分析师',
            '研究员',
            '负责人',
            '总监',
            '合伙人',
            'facilitator',
            'Facilitator',
          ];
          for (const kw of breakBefore) {
            let pos = text.indexOf(kw);
            while (pos !== -1) {
              mark(pos, 360);
              pos = text.indexOf(kw, pos + 1);
            }
          }

          const scoreAt = (idx: number) => {
            const first = text.slice(0, idx).trim();
            const second = text.slice(idx).trim();
            if (!first || !second) return null;
            const w1 = ctx.measureText(first).width;
            const w2 = ctx.measureText(second).width;
            const over1 = w1 > tagWrapWidth;
            const over2 = w2 > tagWrapWidth;
            const tooShort = first.length <= 2 || second.length <= 2;

            let score = Math.abs(w1 - w2);
            if (over1) score += 700;
            if (over2) score += 700;
            if (tooShort) score += 900;
            const bonus = bonuses.get(idx) ?? 0;
            score -= bonus;
            return { idx, first, second, score };
          };

          let best: { idx: number; first: string; second: string; score: number } | null = null;
          for (const idx of candidates) {
            const scored = scoreAt(idx);
            if (!scored) continue;
            if (!best || scored.score < best.score) best = scored;
          }
          return best;
        })();

        if (bestSplit) {
          const firstLine = ellipsizeToWidth(bestSplit.first, tagWrapWidth);
          const secondLine = ellipsizeToWidth(bestSplit.second, tagWrapWidth);
          if (secondLine) return { firstLine, secondLine };
          return { firstLine: ellipsizeToWidth(text, tagWrapWidth), secondLine: '' };
        }

        const lines = wrapLines(ctx, text, tagWrapWidth);
        const firstLineRaw = lines[0] ?? '';
        const firstLine = ellipsizeToWidth(firstLineRaw, tagWrapWidth);
        const secondRaw = lines.length > 1 ? lines.slice(1).join('') : '';
        const secondLine = secondRaw ? ellipsizeToWidth(secondRaw, tagWrapWidth) : '';
        return { firstLine, secondLine };
      };
      const roleEntries = roles
        .map((name) => {
          const { firstLine, secondLine } = splitRoleLabel(name);
          return { name, firstLine, secondLine, isLong: Boolean(secondLine) };
        })
        .sort((a, b) => Number(a.isLong) - Number(b.isLong));

      let currentY = listTop;
      for (let i = 0; i < roleEntries.length; i++) {
        const x = rolesX;
      const { firstLine, secondLine } = roleEntries[i];

        const borderColors = palette.accents.length > 0 ? palette.accents : [palette.tagText];
        const borderColor = borderColors[i % borderColors.length];

        ctx.fillStyle = palette.tagText;
        const itemH = secondLine ? 70 : 52;
        const y = currentY;
        if (y + itemH > maxY) break;

        ctx.save();
        ctx.strokeStyle = borderColor;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1;
        roundRectPath(ctx, x, y, colW, itemH, 999);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        roundRectPath(ctx, x + tagInsetX, y + tagInsetY, colW - tagInsetX * 2, itemH - tagInsetY * 2, 999);
        ctx.clip();
        ctx.textAlign = 'center';
        const cx = x + colW / 2;
        if (!secondLine) {
          ctx.textBaseline = 'middle';
          ctx.fillText(firstLine, cx, y + itemH / 2);
        } else {
          ctx.textBaseline = 'middle';
          const lineHeight = 22;
          const centerY = y + itemH / 2;
          ctx.fillText(firstLine, cx, centerY - lineHeight / 2);
          ctx.fillText(secondLine, cx, centerY + lineHeight / 2);
        }
        ctx.restore();
        ctx.textAlign = 'left';

        currentY += itemH + rowGap;
      }
      ctx.textBaseline = 'alphabetic';

      const qrImg = await loadImage(`/api/qr-site?size=260`);

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 10;
      roundRectPath(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.50)';
      ctx.fill();
      ctx.restore();

      const qrPadding = 10;
      const qrInner = qrSize - qrPadding * 2;
      ctx.drawImage(qrImg, qrX + qrPadding, qrY + qrPadding, qrInner, qrInner);

      ctx.save();
      roundRectPath(ctx, qrX, qrY, qrSize, qrSize, 20);
      ctx.strokeStyle = 'rgba(255,255,255,0.50)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
      ctx.font =
        '400 18px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      const tip = '长按开启天赋对话';
      const tipW = ctx.measureText(tip).width;
      ctx.fillText(tip, qrX + (qrSize - tipW) / 2, qrY + qrSize + 36);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.font =
        '500 18px "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('EchoTalent', cardX + pad, footerY);

      return canvas;
    };

    return async (force?: boolean) => {
      if (!report || !shareUrl || !reportArchetype) return;

      const key = buildShareCacheKey(report, shareUrl);
      if (!force && shareImgUrl && shareImgKeyRef.current === key) return;

      setIsRenderingShare(true);
      try {
        shareImgKeyRef.current = key;

        const cached = await getCachedBlobUrl(key);
        if (cached) {
          setShareImgUrl((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return cached;
          });
          return;
        }

        const canvas = await drawShareCardA(report);
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              setShareImgUrl(canvas.toDataURL('image/png'));
              resolve();
              return;
            }
            const setUrl = (url: string) => {
              setShareImgUrl((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return url;
              });
            };
            if (isWeChat()) {
              void blobToDataUrl(blob)
                .then((dataUrl) => setUrl(dataUrl))
                .catch(() => setUrl(URL.createObjectURL(blob)));
            } else {
              setUrl(URL.createObjectURL(blob));
            }
            void putCachedBlob(key, blob);
            resolve();
          }, 'image/png');
        });
      } finally {
        setIsRenderingShare(false);
      }
    };
  }, [report, reportArchetype, shareImgUrl, shareUrl]);

  const openShare = () => {
    setShareOpen(true);
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        void renderShareImage();
      });
    });
  };

  useEffect(() => {
    if (!reportArchetype || !shareUrl) return;
    if (shareImgUrl) return;

    const qrPreload = new window.Image();
    qrPreload.src = `/api/qr-site?size=260`;

    const schedule = (cb: () => void) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number })
        .requestIdleCallback;
      if (typeof ric === 'function') return ric(cb, { timeout: 1200 });
      return window.setTimeout(cb, 300);
    };

    const id = schedule(() => renderShareImage());
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (typeof cic === 'function') cic(id);
      else window.clearTimeout(id);
    };
  }, [reportArchetype, renderShareImage, shareImgUrl, shareUrl]);

  const handleSaveShareImage = async () => {
    if (!shareImgUrl) return;
    try {
      const res = await fetch(shareImgUrl);
      const blob = await res.blob();
      const fileName = 'echotalent-v4.5-sharing.png';
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });

      const nav = navigator as unknown as {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'EchoTalent', text: '我的职业全景画像' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const opened = window.open(shareImgUrl, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = shareImgUrl;
    }
  };

  if (!report) return null;

  return (
    <main className="min-h-screen text-foreground px-4 py-8 md:py-12 bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/50 relative">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
        {planData && (
          <PlanCard 
            data={planData} 
            onClose={() => setPlanData(null)} 
          />
        )}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-black/5 pb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/chat')}
              className="rounded-full hover:bg-black/5 text-muted-foreground transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                我的职业全景画像
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                My Career Panorama
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openShare}
            className="hidden md:inline-flex rounded-full bg-white/70 border-black/10 hover:bg-white"
          >
            <Share2 className="w-4 h-4 mr-2" />
            分享我的报告
          </Button>
        </div>

        <section className="grid md:grid-cols-12 gap-6 items-stretch">
          <Card className="md:col-span-7 lg:col-span-7 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 flex flex-col">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-foreground/80">职业原型</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                {report.archetype}
              </h2>
              <FormatSummary text={report.summary} />
            </CardContent>
          </Card>

          <Card className="md:col-span-5 lg:col-span-5 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 flex flex-col">
            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between gap-2 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-foreground/80">能力雷达</h3>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center py-10 px-8 md:py-10 md:px-10">
              {report.rpg_stats && report.rpg_stats.length > 0 ? (
                <div className="md:scale-110 scale-95 transform-gpu">
                  <RadarChart stats={report.rpg_stats} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <Activity className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">暂无足够数据生成图表</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid md:grid-cols-12 gap-6">
          <Card className="order-2 md:order-1 md:col-span-8 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-semibold text-foreground/80">隐藏天赋与适配场景</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {(report.superpowers || []).map((power, index) => {
                if (typeof power === 'string') {
                  return (
                    <div
                      key={index}
                      className="group flex items-start gap-4 rounded-xl bg-gradient-to-br from-emerald-50/50 to-transparent border border-emerald-100/50 p-5 hover:border-emerald-200 transition-all duration-300"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 text-sm font-bold shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <p className="text-base leading-7 text-foreground/80 pt-0.5">
                        {power}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={index}
                    className="group flex flex-col gap-3 rounded-xl bg-gradient-to-br from-emerald-50/50 to-transparent border border-emerald-100/50 p-5 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 text-sm font-bold shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div className="space-y-2">
                         <span className="text-base font-semibold text-foreground/90">{power.name}</span>
                         <p className="leading-7 text-foreground/70 text-sm">
                           {power.description}
                         </p>
                      </div>
                    </div>
                    {power.potential_roles && power.potential_roles.length > 0 && (
                        <div className="ml-12 flex flex-wrap gap-2 pt-1">
                          {power.potential_roles.map((role, j) => {
                            const isSelected = selectedRoles.includes(role);
                            return (
                              <button
                                key={j}
                                onClick={() => toggleRoleSelection(role)}
                                className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium shadow-sm transition-all duration-200 hover:scale-105",
                                  isSelected 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200 ring-offset-1" 
                                    : "bg-white border-emerald-200/60 text-emerald-700/80 hover:bg-emerald-50 hover:text-emerald-800"
                                )}
                              >
                                {isSelected && <Check className="w-3 h-3 mr-1" />}
                                {role}
                                <span 
                                  className="ml-1.5 opacity-40 hover:opacity-100 p-0.5 rounded-full hover:bg-black/5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    analyzeRole(role, typeof power === 'string' ? power : power.description);
                                  }}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="order-1 md:order-2 md:col-span-4 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 h-fit">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-foreground/80">核心技能栈</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-2.5">
                {(report.skills || []).map((skill, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors text-sm font-normal"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-lg bg-cyan-50/50 border border-cyan-100 text-xs text-cyan-800/70 leading-relaxed">
                <p>这些技能构成了你的职业护城河，建议在未来的工作中持续打磨这些核心竞争力。</p>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>

      <div className="md:hidden px-6 pb-10">
        <Button
          variant="outline"
          onClick={() => {
            openShare();
          }}
          className="w-full rounded-2xl bg-white/80 border-black/10 hover:bg-white shadow-sm"
        >
          <Share2 className="w-4 h-4 mr-2" />
          分享我的报告
        </Button>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 z-[100] bg-transparent md:bg-black/70"
            onPointerDown={() => setShareOpen(false)}
          />
          <button
            type="button"
            aria-label="关闭"
            className="absolute top-4 right-4 md:top-6 md:right-6 z-[120] rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-lg backdrop-blur px-3 py-3 pointer-events-auto"
            onPointerDown={(e) => {
              e.stopPropagation();
              setShareOpen(false);
            }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative z-[110] h-full w-full flex items-center justify-center p-4 md:p-8 pointer-events-none">
            {isRenderingShare || !shareImgUrl ? (
              <div className="flex items-center justify-center h-60 text-slate-700/70 md:text-white/70 pointer-events-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            ) : (
              <Image
                src={shareImgUrl}
                alt="分享图"
                width={1080}
                height={1600}
                unoptimized
                className="rounded-2xl shadow-2xl pointer-events-auto w-auto h-auto max-w-[92vw] max-h-[88vh]"
              />
            )}
          </div>
          <div className="absolute bottom-6 left-0 right-0 z-[120] flex justify-center pointer-events-none px-4">
            <Button
              variant="outline"
              disabled={isRenderingShare || !shareImgUrl}
              onClick={handleSaveShareImage}
              className="pointer-events-auto rounded-full bg-white/85 border-black/10 hover:bg-white shadow-lg backdrop-blur"
            >
              保存图片
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Action Bar */}
      {selectedRoles.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="glass-card bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 ring-1 ring-black/5">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                已选择 {selectedRoles.length} 个职业方向
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedRoles.map(role => (
                  <Badge 
                    key={role} 
                    variant="secondary" 
                    className="text-[10px] py-0.5 px-2 bg-primary/5 text-primary border-primary/10 flex items-center gap-1 shadow-sm"
                  >
                    {role}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        analyzeRole(role, getRoleContext()); 
                      }}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      title="查看深度解析"
                    >
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <Button 
              onClick={analyzeRoles}
              disabled={analyzingRole === 'comparison'}
              className="rounded-xl shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300 h-auto py-2.5 px-4"
            >
              {analyzingRole === 'comparison' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <div className="flex flex-col items-start">
                  <span className="flex items-center text-sm font-semibold">
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    {selectedRoles.length === 1 ? '深度解析该职业' : '对比分析这两个职业'}
                  </span>
                </div>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Custom Sheet Overlay */}
      {showRoleSheet && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 z-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
            onPointerDown={() => setShowRoleSheet(false)}
          />
          
          {/* Sheet Content */}
          <div className="relative z-10 w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 border-l border-black/5 flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between p-6 border-b border-black/5">
              <div>
                <h2 className="text-lg font-bold text-foreground">职业深度解析</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {analyzingRole}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRoleSheet(false)}
                className="rounded-full hover:bg-black/5"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {analysisError && lastAnalysisRequest ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                  <div className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                    {analysisError}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => analyzeRole(lastAnalysisRequest.role, lastAnalysisRequest.context)}
                      className="rounded-full"
                    >
                      重试
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRoleSheet(false)}
                      className="rounded-full"
                    >
                      关闭
                    </Button>
                  </div>
                </div>
              ) : !roleAnalysis ? (
                <LoadingState type="single" />
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500 pb-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-base">
                      <Target className="w-5 h-5" />
                      <h3>核心职责</h3>
                    </div>
                    <ul className="space-y-3">
                      {roleAnalysis.responsibilities.map((item, i) => (
                        <JobListItem key={i} text={item} />
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl border border-border/40 space-y-2">
                      <div className="flex items-center gap-2 text-foreground/70 font-medium text-xs uppercase tracking-wider">
                         <Wallet className="w-3.5 h-3.5" />
                         <span>薪资范围</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         <span className="text-xs text-foreground/70 bg-secondary/50 px-2 py-1 rounded-md">{roleAnalysis.salary_range}</span>
                      </div>
                    </div>
                    <div className="p-5 rounded-xl border border-border/40 space-y-2">
                       <div className="flex items-center gap-2 text-foreground/70 font-medium text-xs uppercase tracking-wider">
                         <Building2 className="w-3.5 h-3.5" />
                         <span>典型行业</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roleAnalysis.industries_companies?.slice(0, 3).map((ind, i) => (
                           <span key={i} className="text-xs text-foreground/70 bg-secondary/50 px-2 py-1 rounded-md">{ind}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <h3>核心能力要求</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roleAnalysis.core_competencies?.map((skill, i) => (
                        <span key={i} className="text-xs font-medium px-3 py-1.5 rounded-full border border-border/60 bg-secondary/20 text-foreground/80">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <h3>典型一天</h3>
                    </div>
                    <ul className="space-y-3">
                      {roleAnalysis.daily_routine
                        // Ensure each time block starts on a new line
                        .replace(/(上午[:：]|下午[:：]|晚上[:：])/g, '\n$1')
                        .split('\n')
                        .map((line, i) => {
                          let cleanLine = line.trim();
                          if (!cleanLine) return null;
                          
                          // Remove leading bullet points or numbers (e.g. "1. ", "- ", "• ")
                          cleanLine = cleanLine.replace(/^([0-9]+[\.\)]|[•\-\*])\s+/, '');
                          
                          // Handle "Header: Content" format to bold the header
                          const match = cleanLine.match(/^(.+?[：:])\s*(.*)/);
                          
                          if (match) {
                            const header = match[1] ?? '';
                            const content = match[2] ?? '';
                            // If header is short (likely "上午：", "下午："), bold it
                            if (header.length <= 10) {
                              return (
                                <JobListItem 
                                  key={i} 
                                  text={
                                    <>
                                      <span className="font-semibold text-foreground/90">{header}</span>
                                      {content}
                                    </>
                                  } 
                                  dotClass="bg-blue-500" 
                                />
                              );
                            }
                          }
                          
                          return <JobListItem key={i} text={cleanLine} dotClass="bg-blue-500" />;
                        })}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <h3>为什么适合你</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-7">
                      {roleAnalysis.why_fit}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <HeartHandshake className="w-5 h-5 text-pink-500" />
                      <h3>选择建议</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-7">
                      {roleAnalysis.selection_advice}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-black/5 bg-gray-50/50">
              <Button 
                className="w-full" 
                onClick={() => {
                  if (analyzingRole) {
                    toggleRoleSelection(analyzingRole);
                    setShowRoleSheet(false);
                  }
                }}
              >
                {selectedRoles.includes(analyzingRole!) ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    取消选择该职业
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    已加入分析列表
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Sheet */}
      {showComparisonSheet && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowComparisonSheet(false)} />
          <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-500">
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10 py-2 border-b">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  职业对比分析
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowComparisonSheet(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {comparisonError && lastComparisonRequest ? (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-4">
                  <div className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
                    {comparisonError}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => compareRoles(lastComparisonRequest)} className="rounded-full">
                      重试
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowComparisonSheet(false)} className="rounded-full">
                      关闭
                    </Button>
                  </div>
                </div>
              ) : !comparisonData ? (
                <LoadingState type="comparison" />
              ) : (
                <div className="space-y-8">
                  {/* Summary */}
                  <div className="p-5 rounded-xl bg-slate-50/50 border border-slate-100/80">
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      对比总结
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/80 text-justify">{comparisonData.comparison_summary}</p>
                  </div>

                  {/* Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[comparisonData.role1_analysis, comparisonData.role2_analysis].map((role, idx) => (
                      <Card key={idx} className="border border-border/40 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-slate-50/30 border-b border-slate-100">
                          <CardTitle className="text-base font-bold text-foreground/90">{role.role_name}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100/50 text-xs font-medium">
                              匹配度 {role.match_score}%
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-100/50 text-xs font-medium">
                              {role.salary_range}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 text-sm">
                          <div className="space-y-3">
                            <div className="font-medium text-foreground/80 flex items-center gap-2 text-xs uppercase tracking-wider">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500/80" /> 
                              优势 (Pros)
                            </div>
                            <ul className="space-y-2">
                              {role.pros.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
                                  <span className="w-1 h-1 rounded-full bg-emerald-400/40 mt-1.5 shrink-0" />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <div className="font-medium text-foreground/80 flex items-center gap-2 text-xs uppercase tracking-wider">
                              <Activity className="w-4 h-4 text-orange-500/80" /> 
                              挑战 (Cons)
                            </div>
                            <ul className="space-y-2">
                              {role.cons.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
                                  <span className="w-1 h-1 rounded-full bg-orange-400/40 mt-1.5 shrink-0" />
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Recommendation */}
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      建议与选择
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{comparisonData.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
