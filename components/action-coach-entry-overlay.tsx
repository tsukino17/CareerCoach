'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ActionCoachEntryOverlay() {
  const pathname = usePathname();
  const router = useRouter();

  const isUserCenter = pathname === '/user' || pathname.startsWith('/user/');
  const isReport = pathname === '/report' || pathname.startsWith('/report/');

  if (!isUserCenter && !isReport) return null;

  const label = isReport ? '开始行动力陪伴' : '行动力教练';

  return (
    <div className="fixed bottom-5 right-5 z-[200]">
      <Button
        type="button"
        variant="outline"
        onClick={() => router.push('/coach/action')}
        className="rounded-full border-[#86B8FF]/40 bg-[#86B8FF]/18 text-foreground shadow-sm backdrop-blur-sm hover:bg-[#86B8FF]/28 hover:border-[#86B8FF]/55 active:scale-95 transition-transform"
      >
        {label}
      </Button>
    </div>
  );
}

