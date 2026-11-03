/**
 * Analytics 内部流量识别
 *
 * 只影响统计口径，不删除、不改写原始事件：
 * - 管理员邮箱（ADMIN_EMAILS）产生的事件写入 metadata.internal = true
 * - 内部设备通过 /internal-flag?token=... 设置 Cookie，后续事件写入 internal 标记
 * - ANALYTICS_INTERNAL_VISITOR_IDS 里的访客 ID 在统计时兜底排除
 */

export const INTERNAL_DEVICE_STORAGE_KEY = 'career_analytics_internal_device';
export const INTERNAL_DEVICE_COOKIE = 'analytics_internal_device';
export const INTERNAL_DEVICE_COOKIE_VALUE = '1';

export type InternalAnalyticsReason = 'admin_email' | 'internal_device' | 'visitor_allowlist';

export function getInternalVisitorIds() {
  const raw = process.env.ANALYTICS_INTERNAL_VISITOR_IDS || '';
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function isInternalVisitorId(value: unknown) {
  if (typeof value !== 'string') return false;
  const id = value.trim();
  if (!id) return false;
  return getInternalVisitorIds().has(id);
}

export function hasInternalDeviceCookie(cookieHeader: string | null) {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${INTERNAL_DEVICE_COOKIE}=${INTERNAL_DEVICE_COOKIE_VALUE}`);
}

export function buildServerInternalMetadata(
  metadata: Record<string, unknown> | undefined,
  reasons: InternalAnalyticsReason[],
) {
  // 不信任客户端传入的 internal 字段，只保留服务端可验证的标记
  const { internal: _internal, internalReason: _internalReason, ...safeMetadata } = metadata || {};
  if (reasons.length === 0) return safeMetadata;
  return {
    ...safeMetadata,
    internal: true,
    internalReason: reasons.join(','),
  };
}

export function isInternalAnalyticsEvent(event: { metadata?: unknown } | null | undefined) {
  if (!event || typeof event.metadata !== 'object' || event.metadata === null) return false;
  const metadata = event.metadata as Record<string, unknown>;
  if (metadata.internal === true) return true;
  if (isInternalVisitorId(metadata.anonymousVisitorId)) return true;
  return isInternalVisitorId(metadata.visitorId);
}
