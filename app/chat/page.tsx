import ChatContent from './components/chat-content';

export const dynamic = 'force-dynamic';

type ChatPageSearchParams = {
  id?: string | string[];
  new?: string | string[];
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<ChatPageSearchParams>;
}) {
  const params = await searchParams;
  const rawId = params.id;
  const rawNew = params.new;
  const urlId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isNewChatRequested = (Array.isArray(rawNew) ? rawNew[0] : rawNew) === 'true';

  return <ChatContent urlId={urlId ?? null} isNewChatRequested={isNewChatRequested} />;
}
