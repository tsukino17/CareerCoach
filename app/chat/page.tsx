import ChatContent from './components/chat-content';

export const dynamic = 'force-dynamic';

type ChatPageSearchParams = {
  id?: string | string[];
  new?: string | string[];
  demo?: string | string[];
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<ChatPageSearchParams>;
}) {
  const params = await searchParams;
  const rawId = params.id;
  const rawNew = params.new;
  const rawDemo = params.demo;
  const urlId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isNewChatRequested = (Array.isArray(rawNew) ? rawNew[0] : rawNew) === 'true';
  const demoCaseId = Array.isArray(rawDemo) ? rawDemo[0] : rawDemo;

  return <ChatContent urlId={urlId ?? null} isNewChatRequested={isNewChatRequested} demoCaseId={demoCaseId ?? null} />;
}
