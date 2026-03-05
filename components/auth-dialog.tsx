'use client';

import { useState } from 'react';
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
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
      onAuthSuccess();
      onClose();
    } catch (err: any) {
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
            {isLogin ? '欢迎回来' : '创建账号'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            登录 Deep Mirror Cloud 同步你的职业数据
          </p>
        </div>

        <div className="flex p-1 mb-6 bg-gray-100 rounded-lg">
          <button
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              isLogin ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setIsLogin(true)}
          >
            登录
          </button>
          <button
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              !isLogin ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setIsLogin(false)}
          >
            注册
          </button>
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

          <Button 
            type="submit" 
            className="w-full rounded-xl py-5 text-base font-medium shadow-lg shadow-primary/20"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            {isLogin ? '登录' : '注册并登录'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          继续即代表你同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
