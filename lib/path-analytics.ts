/**
 * 现实路径教练 · 埋点事件与统计
 *
 * 事件命名沿用 path_ 前缀，统计口径同时供管理后台与周报复用，
 * 避免两边各写一套导致数字对不上。
 */

export type PathAnalyticsEvent = {
  event_name: string | null;
  page: string | null;
  session_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type RealityPathStats = {
  /** 打开过现实路径页的访客数 */
  openedVisitors: number;
  /** 现实路径教练对话场次（按对话 id 去重） */
  chatConversations: number;
  /** 现实路径对话中的用户消息条数 */
  chatUserMessages: number;
  /** 设置主线路径次数 */
  mainlinesSelected: number;
  /** 因完成度不足被拦下的主线设置次数 */
  mainlineBlocked: number;
  /** 解锁 Step 2 的访客数 */
  step2UnlockedVisitors: number;
  /** 解锁 Step 3 的访客数 */
  step3UnlockedVisitors: number;
  evidence: { total: number; confirmed: number; partial: number; rejected: number };
  requirements: { total: number; checked: number; pending: number; gap: number };
  willingness: { want: number; unsure: number; no: number };
  readiness: { count: number; averageScore: number };
  /** 确认写入任务列表的微行动数 */
  microActions: number;
  /** 生成分享卡次数 */
  shareCards: number;
};

export const EMPTY_REALITY_PATH_STATS: RealityPathStats = {
  openedVisitors: 0,
  chatConversations: 0,
  chatUserMessages: 0,
  mainlinesSelected: 0,
  mainlineBlocked: 0,
  step2UnlockedVisitors: 0,
  step3UnlockedVisitors: 0,
  evidence: { total: 0, confirmed: 0, partial: 0, rejected: 0 },
  requirements: { total: 0, checked: 0, pending: 0, gap: 0 },
  willingness: { want: 0, unsure: 0, no: 0 },
  readiness: { count: 0, averageScore: 0 },
  microActions: 0,
  shareCards: 0,
};

export function pathVisitorKey(event: PathAnalyticsEvent): string {
  const anonymousVisitorId = event.metadata?.anonymousVisitorId;
  return event.user_id
    || (typeof anonymousVisitorId === 'string' ? anonymousVisitorId : '')
    || event.session_id
    || '';
}

export function computeRealityPathStats(events: PathAnalyticsEvent[]): RealityPathStats {
  const openedVisitors = new Set<string>();
  const step2Visitors = new Set<string>();
  const step3Visitors = new Set<string>();
  const chatConversations = new Set<string>();
  const stats: RealityPathStats = {
    ...EMPTY_REALITY_PATH_STATS,
    evidence: { ...EMPTY_REALITY_PATH_STATS.evidence },
    requirements: { ...EMPTY_REALITY_PATH_STATS.requirements },
    willingness: { ...EMPTY_REALITY_PATH_STATS.willingness },
    readiness: { ...EMPTY_REALITY_PATH_STATS.readiness },
  };
  let readinessScoreSum = 0;

  for (const event of events) {
    const name = event.event_name || '';
    if (!name.startsWith('path_') && !(name === 'anonymous_chat_message' && event.page === '/path')) continue;
    const visitor = pathVisitorKey(event);
    const status = typeof event.metadata?.status === 'string'
      ? event.metadata.status
      : '';
    switch (name) {
      case 'path_opened':
        if (visitor) openedVisitors.add(visitor);
        break;
      case 'path_step2_unlocked':
        if (visitor) step2Visitors.add(visitor);
        break;
      case 'path_step3_unlocked':
        if (visitor) step3Visitors.add(visitor);
        break;
      case 'path_mainline_selected':
        stats.mainlinesSelected += 1;
        break;
      case 'path_mainline_blocked':
        stats.mainlineBlocked += 1;
        break;
      case 'path_evidence_confirmed':
        stats.evidence.total += 1;
        if (status === 'confirmed' || status === 'partial' || status === 'rejected') {
          stats.evidence[status] += 1;
        }
        break;
      case 'path_requirement_checked':
        stats.requirements.total += 1;
        if (status === 'checked' || status === 'pending' || status === 'gap') {
          stats.requirements[status] += 1;
        }
        break;
      case 'path_willingness_selected':
        if (status === 'want' || status === 'unsure' || status === 'no') {
          stats.willingness[status] += 1;
        }
        break;
      case 'path_readiness_generated': {
        const score = Number(event.metadata?.score);
        if (Number.isFinite(score)) {
          readinessScoreSum += score;
          stats.readiness.count += 1;
        }
        break;
      }
      case 'path_micro_action_confirmed':
        stats.microActions += 1;
        break;
      case 'path_share_card_generated':
        stats.shareCards += 1;
        break;
      case 'anonymous_chat_message': {
        const conversationId = typeof event.metadata?.anonymousConversationId === 'string'
          ? event.metadata.anonymousConversationId
          : event.session_id || '';
        if (conversationId) chatConversations.add(conversationId);
        if (event.metadata?.role === 'user') stats.chatUserMessages += 1;
        break;
      }
      default:
        break;
    }
  }

  stats.openedVisitors = openedVisitors.size;
  stats.step2UnlockedVisitors = step2Visitors.size;
  stats.step3UnlockedVisitors = step3Visitors.size;
  stats.chatConversations = chatConversations.size;
  stats.readiness.averageScore = stats.readiness.count
    ? Math.round(readinessScoreSum / stats.readiness.count)
    : 0;
  return stats;
}
