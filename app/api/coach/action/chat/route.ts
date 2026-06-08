export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: Array<{ role?: string; content?: string }> };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m?.role === 'user' && typeof m.content === 'string');
    const userText = (lastUser?.content || '').trim();

    const reply = buildActionCoachReply(userText);
    return Response.json({ reply });
  } catch {
    return Response.json({ reply: '我在。你愿意再发一次吗？' }, { status: 200 });
  }
}

function buildActionCoachReply(userText: string) {
  const clean = (userText || '').trim();
  if (!clean) {
    return '我在。你愿意用一句话写下“今天发生的一件事 + 你的感受”吗？';
  }

  const shortFact = extractFirstFact(clean);
  const shortFeeling = extractFirstFeeling(clean);

  const witness = `我注意到你写下了今天的记录。谢谢你把它放到这里。`;
  const anchor =
    shortFact || shortFeeling
      ? `这里面有一个很具体的锚点：${[shortFact, shortFeeling].filter(Boolean).join('；')}。`
      : `这里面有一个很具体的锚点：你愿意把“发生了什么”说清楚，并且允许自己有感受。`;
  const identity = `这有力地证明了：你正在用一种更稳定、更诚实的方式靠近你想成为的那个人。`;
  const micro = `为了让明天的你也能感受到这种力量，一个5分钟就能完成的小动作你更愿意选哪个？A) 把今天这件事写成3条事实 B) 给你的感受起一个名字 C) 写一句“我想把票投给谁”`;

  return [witness, anchor, identity, micro].join('\n\n');
}

function extractFirstFact(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  const match =
    t.match(/(今天|刚刚|上午|下午|晚上)[^。！？\n]{0,40}/) ||
    t.match(/我(完成|做|整理|写|提交|联系|复盘)[^。！？\n]{0,40}/);
  if (!match) return '';
  const s = match[0].trim();
  return s.length > 2 ? `事实：${ensureEnd(s)}` : '';
}

function extractFirstFeeling(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  const match = t.match(/(我(感觉|有点|有些|很)(开心|平静|踏实|紧张|焦虑|难过|沮丧|疲惫|轻松|兴奋|心虚|不安)[^。！？\n]{0,24})/);
  if (!match) return '';
  const s = match[0].trim();
  return s.length > 2 ? `感受：${ensureEnd(s)}` : '';
}

function ensureEnd(s: string) {
  if (!s) return '';
  if (/[。！？…]$/.test(s)) return s;
  return `${s}。`;
}

