// 管理后台共享类型：被所有 admin 页面和 insights API 引用

import type { RealityPathStats } from '@/lib/path-analytics';

export type DailyVisit = { date: string; count: number; visitors: number };
export type DailyRegistration = { date: string; count: number };
export type FunnelStep = { step: string; starts: number; drops: number; dropRate: number };
export type CloudWord = { text: string; value: number };
export type RankStat = { name: string; count: number };

export type PageStat = {
  page: string;
  views: number;
  visitors: number;
  avgDurationLabel: string;
  avgScrollDepth: number;
};

export type RecentVisitor = {
  at: string | null;
  page: string;
  visitor: string;
  userAgent: string;
};

export type UserJourney = {
  visitor: string;
  sessions: number;
  chatTurns: number;
  reportsGenerated: number;
  reportViews: number;
  reportEngagementMs: number;
  shares: number;
  pathMessages: number;
  actionsCompleted: number;
  lastAt: string | null;
  // 详细维度：用于产品动线分析
  firstAt: string | null;
  pageViews: number;
  dwellMs: number;
  avgDwellMs: number;
  firstPage: string | null;
  lastPage: string | null;
  entrySource: string;
  stagesReached: string[];
  dropOffPage: string | null;
  timeToFirstActionMs: number | null;
  timeFromChatToReportMs: number | null;
  keyActions: Array<{ type: string; at: string | null; page: string | null }>;
};

export type PageTransition = { from: string; to: string; count: number };

export type JourneyAggregates = {
  pageTransitions: PageTransition[];
  dwellDistribution: Array<{ bucket: string; count: number }>;
  dropOffPages: Array<{ page: string; count: number; rate: number }>;
  stageFunnel: Array<{ stage: string; users: number; rate: number }>;
  entryPages: Array<{ page: string; count: number; rate: number }>;
  exitPages: Array<{ page: string; count: number; rate: number }>;
  timeToFirstAction: {
    buckets: Array<{ bucket: string; count: number }>;
    medianMs: number;
    sampleSize: number;
  };
  visitorLifecycle: {
    newVisitors: number;
    returningVisitors: number;
    engagedVisitors: number;
    convertedVisitors: number;
  };
};

export type ConversationAnalysis = {
  depthBuckets: Array<{ bucket: string; count: number; rate: number }>;
  firstIntentCategories: Array<{ name: string; count: number }>;
  dropOffConversations: number;
  dropOffRate: number;
  totalConversations: number;
  avgMessagesPerConversation: number;
  singleMessageConversations: number;
  multiTurnConversations: number;
};

export type AiUsageAdminStats = {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCalls: number;
  avgTokensPerCall: number;
  uniqueUsers: number;
  avgTokensPerUser: number;
  byRoute: Array<{ route: string; tokens: number; calls: number; promptTokens: number; completionTokens: number }>;
  byUser: Array<{ userKey: string; tokens: number; calls: number }>;
  byDay: Array<{ date: string; tokens: number; calls: number }>;
  byModel: Array<{ model: string; tokens: number; calls: number }>;
};

export type DailyMetric = {
  date: string;
  pv: number;
  uv: number;
  registrations: number;
  authenticatedVisitors: number;
  avgEngagementMs: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  conversations: number;
  activeChatUsers: number;
  userTextChars: number;
  assistantTextChars: number;
  totalTextChars: number;
};

export type MetricKey =
  | 'pv'
  | 'uv'
  | 'registrations'
  | 'authenticatedVisitors'
  | 'avgEngagementMs'
  | 'totalMessages'
  | 'userMessages'
  | 'conversations'
  | 'activeChatUsers'
  | 'userTextChars'
  | 'totalTextChars';

export type InputSample = { at: string | null; category: string; preview: string; chars: number };

export type InsightsResponse = {
  ok: boolean;
  range: { preset: string; startDate: string; endDate: string };
  siteScope?: 'production' | 'all';
  aiUsage?: AiUsageAdminStats | null;
  realityPath?: RealityPathStats;
  journeyAggregates?: JourneyAggregates;
  conversationAnalysis?: ConversationAnalysis;
  dailyVisits: DailyVisit[];
  dailyRegistrations: DailyRegistration[];
  dailyMetrics?: DailyMetric[];
  pageStats: PageStat[];
  recentVisitors: RecentVisitor[];
  userJourneys?: UserJourney[];
  sourceStats: RankStat[];
  cityStats: RankStat[];
  featureStats: RankStat[];
  eventStats: RankStat[];
  funnel: FunnelStep[];
  keywordCloud: CloudWord[];
  inputInsights?: {
    categories: RankStat[];
    samples: InputSample[];
    averages: {
      userMessageChars: number;
      messagesPerConversation: number;
      userMessagesPerActiveUser: number;
    };
  };
  conversationStats: {
    totalMessages: number;
    userMessageCount: number;
    assistantMessageCount: number;
    userTextChars: number;
    assistantTextChars: number;
    totalTextChars: number;
    conversations: number;
    activeChatUsers: number;
    avgUserMessageChars: number;
  };
  setupWarnings?: string[];
  totals: {
    events: number;
    messages: number;
    registrations: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    avgEngagementLabel: string;
  };
  retention?: {
    visitors: number;
    repeatVisitors: number;
    repeatVisitorRate: number;
    repeatMeaningfulUsers: number;
    repeatMeaningfulRate: number;
    activeDayBuckets: Record<string, number>;
  };
};

export type RangePreset = 'today' | '7d' | '30d' | 'custom';
