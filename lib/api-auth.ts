'use client';

import { supabase } from '@/lib/supabase';

// 客户端请求 AI 接口时附带登录态，供服务端做按用户用量归因。
// 未登录时返回空对象，请求仍按匿名处理。
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
