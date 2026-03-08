import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ChatContent from './components/chat-content';

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
