'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics-client';

function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;

  const referrer = document.referrer;
  if (!referrer) return 'direct';

  try {
    const referrerHost = new URL(referrer).hostname.replace(/^www\./, '');
    const currentHost = window.location.hostname.replace(/^www\./, '');
    if (referrerHost === currentHost) return 'internal';
    if (/baidu|google|bing|sogou|so\.com|sm\.cn/i.test(referrerHost)) return 'search';
    if (/weixin|wechat|qq\.com|douyin|xiaohongshu|zhihu|weibo/i.test(referrerHost)) return 'social';
    return referrerHost;
  } catch {
    return 'referral';
  }
}

function getFeatureFromPath(pathname: string) {
  if (pathname.startsWith('/chat')) return 'talent_chat';
  if (pathname.startsWith('/report')) return 'talent_report';
  if (pathname.startsWith('/coach/path')) return 'career_path';
  if (pathname.startsWith('/coach/action/tools')) return 'analysis_tools';
  if (pathname.startsWith('/coach/action/vision')) return 'vision_board';
  if (pathname.startsWith('/coach/action/calendar')) return 'action_calendar';
  if (pathname.startsWith('/coach/action')) return 'action_coach';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/user') || pathname.startsWith('/profile')) return 'user_account';
  return 'general';
}

function getSiteMetadata() {
  return {
    host: window.location.hostname.replace(/^www\./, ''),
    origin: window.location.origin,
    siteUrl: window.location.href,
    isProductionSite: /(^|\.)echotalent\.fun$/i.test(window.location.hostname),
  };
}

export default function AnalyticsPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const startedAt = Date.now();
    let maxScrollDepth = 0;
    let sent = false;
    const trafficSource = getTrafficSource();
    const feature = getFeatureFromPath(pathname);

    const updateScrollDepth = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        maxScrollDepth = Math.max(maxScrollDepth, 100);
        return;
      }
      const depth = Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100);
      maxScrollDepth = Math.max(maxScrollDepth, Math.min(100, Math.max(0, depth)));
    };

    const sendDuration = (reason: string) => {
      if (sent) return;
      sent = true;
      updateScrollDepth();
      void trackEvent({
        eventName: 'page_engagement',
        page: pathname,
        status: reason,
        metadata: {
          ...getSiteMetadata(),
          durationMs: Date.now() - startedAt,
          maxScrollDepth,
          trafficSource,
          feature,
        },
      });
    };
    const handlePageHide = () => sendDuration('pagehide');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendDuration('hidden');
    };

    void trackEvent({
      eventName: 'page_view',
      page: pathname,
      metadata: {
        ...getSiteMetadata(),
        trafficSource,
        feature,
        referrer: document.referrer || '',
        url: window.location.href,
      },
    });

    updateScrollDepth();
    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sendDuration('route_change');
    };
  }, [pathname]);

  return null;
}
