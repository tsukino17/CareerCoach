import { Suspense } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-slate-500">加载中…</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
