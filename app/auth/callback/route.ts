import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/chat';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_env`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 成功后，重定向到用户中心或聊天页面
      // 注意：exchangeCodeForSession 只是在服务器端获取了 session，
      // 但如果要让客户端也登录，通常需要让客户端处理 hash 或者 set cookie。
      // 在 Next.js App Router 中，更推荐使用 @supabase/ssr 来处理 cookie。
      // 但为了简单起见，这里我们重定向到一个带有 access_token 的 URL，
      // 或者让 Supabase 默认的 PKCE 流程接管（通常 Supabase 会处理 #access_token=...）
      
      // 如果我们只是简单的客户端验证，其实不需要这个后端路由，
      // Supabase 发送的链接通常是 `https://<project>.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=<your-site>`
      // 我们在 signUp 时指定了 redirectTo
      
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
