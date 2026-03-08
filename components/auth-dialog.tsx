'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { X, Loader2, Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export function AuthDialog({ isOpen, onClose, onAuthSuccess }: AuthDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Poll for session status when waiting for email confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && successMessage) {
        interval = setInterval(async () => {
            // Check if user has verified email (by trying to sign in silently or checking session)
            // Strategy: Since we have the password in state, we can try to sign in in background
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (data.session) {
                clearInterval(interval);
                onAuthSuccess();
                onClose();
            }
        }, 3000); // Check every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isOpen, successMessage, email, password, onAuthSuccess, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Try to Sign In first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData.session) {
        onAuthSuccess();
        onClose();
        return;
      }

      // 2. If Sign In failed, check if it's a credential issue
      // If so, try to Sign Up (assuming user might be new)
      if (signInError) {
        console.log('Sign in failed:', signInError.message);
        
        // If error indicates invalid credentials, we assume they might want to register
        // BUT we must differentiate between "Wrong Password" and "User Not Found"
        // Supabase often returns "Invalid login credentials" for both.
        
        // Let's try to Sign Up. If they already exist, Sign Up will fail with "User already registered"
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          console.log('Sign up failed:', signUpError.message);
          
          // If Sign Up also fails, check if it's because user already exists
          // If user exists AND sign-in failed, it means WRONG PASSWORD
          if (signUpError.message.includes('User already registered') || signUpError.message.includes('already registered')) {
            throw new Error('用户已存在，但密码错误。请重试或重置密码。'); 
          }
          
          // Handle Network Error explicitly (Supabase specific)
          if (signUpError.message.includes('Network request failed') || signUpError.message.includes('fetch failed')) {
             throw new Error('网络连接失败，请检查您的网络设置（可能需要科学上网）');
          }

          // If it's a different error (e.g. rate limit, invalid email), throw it
          throw signUpError;
        }

        // Sign Up successful
        if (signUpData.session) {
            onAuthSuccess();
            onClose();
            return;
        } else if (signUpData.user && !signUpData.session) {
             // Registration successful but needs confirmation
             setSuccessMessage('注册成功！请前往您的邮箱查收验证邮件，点击链接后即可登录。');
             return;
        }
      }


    } catch (err: any) {
      console.error('Auth flow error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 m-4 animate-in zoom-in-95 duration-200 border border-white/20">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            欢迎来到 EchoTalent
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            登录或注册以同步你的职业数据
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg border border-green-100">
              {successMessage}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full rounded-xl py-5 text-base font-medium shadow-lg shadow-primary/20"
            disabled={loading || !!successMessage}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            登录 / 注册
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          继续即代表你同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
