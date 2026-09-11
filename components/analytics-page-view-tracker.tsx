'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAnalyticsContext, trackEvent } from '@/lib/analytics-client';

type TrafficAttribution = {
  source: string;
  medium: string;
  campaign: string;
};

function getTrafficSource(): TrafficAttribution {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source')?.trim() || '';
  const utmMedium = params.get('utm_medium')?.trim() || '';
  const utmCampaign = params.get('utm_campaign')?.trim() || '';

  const referrer = document.referrer;
  if (!referrer) {
    return { source: utmSource || 'direct', medium: utmMedium || 'direct', campaign: utmCampaign };
  }

  try {
    const referrerHost = new URL(referrer).hostname.replace(/^www\./, '');
    const currentHost = window.location.hostname.replace(/^www\./, '');
    if (referrerHost === currentHost) {
      return { source: utmSource || 'internal', medium: utmMedium || 'internal', campaign: utmCampaign };
    }
    let medium = utmMedium;
    if (!medium) {
      if (/baidu|google|bing|sogou|so\.com|sm\.cn/i.test(referrerHost)) medium = 'search';
      else if (/weixin|wechat|qq\.com|douyin|xiaohongshu|zhihu|weibo/i.test(referrerHost)) medium = 'social';
      else medium = 'referral';
    }
    return { source: utmSource || referrerHost, medium, campaign: utmCampaign };
  } catch {
    return { source: utmSource || 'referral', medium: utmMedium || 'referral', campaign: utmCampaign };
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
    const traffic = getTrafficSource();
    const trafficMeta = { trafficSource: traffic.source, trafficMedium: traffic.medium, trafficCampaign: traffic.campaign };
    const feature = getFeatureFromPath(pathname);

    const { sessionId } = getAnalyticsContext();
    const recordedSessionId = window.localStorage.getItem('career_analytics_session_event_id');
    if (sessionId && sessionId !== recordedSessionId) {
      window.localStorage.setItem('career_analytics_session_event_id', sessionId);
      void trackEvent({
        eventName: 'session_started',
        page: pathname,
        status: 'start',
        metadata: { ...getSiteMetadata(), ...trafficMeta, feature },
      });
    }

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
          ...trafficMeta,
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
        ...trafficMeta,
        feature,
        referrer: document.referrer || '',
        url: window.location.href,
      },
    });

    if (feature === 'talent_chat' || feature === 'talent_report' || feature === 'career_path') {
      void trackEvent({
        eventName: 'meaningful_page_view',
        page: pathname,
        status: 'success',
        metadata: { ...getSiteMetadata(), ...trafficMeta, feature },
      });
    }

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
