import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.ECHO_BASE_URL || 'http://localhost:3000';

const personas = [
  {
    id: 'ui-research-transition',
    title: '被 AI 挤压的 UI 设计师',
    audience: '适合测试“旧岗位正在失效，但能力并没有失效”的转型路径',
    scenario:
      '29 岁，二线城市，做了 5 年 UI/视觉体验设计。最近半年明显感到 AI 压缩出图与执行价值，真正有感觉的其实是用户为什么卡住、信息怎么被理解、体验逻辑怎么讲清楚，想往用户研究或内容策略转。',
    userTurns: [
      '我最近有点迷茫。我做了 5 年 UI 设计，这半年团队越来越强调用 AI 提高出图速度，我明显感觉自己最容易被替代的部分就是现在每天在做的事。',
      '对，我不是单纯累。我是真的开始怀疑，如果未来只是在执行层拼速度，那我是不是会越来越没有价值。',
      '会。我其实一直比起画界面，更在意用户为什么卡住、信息是不是没被理解、一个产品到底有没有把体验说清楚。',
      '我也想过转用户研究、内容策略或者体验策划，但这些名字听起来都很虚，我不知道市场到底认不认。',
      '如果按我心里真正有感觉的方向，我最想先验证用户研究和内容策略。一个偏理解人，一个偏把理解讲清楚，这两个都比纯出图更像我。',
      '我担心的现实问题是，如果我没有正式的用户研究头衔，也没有特别完整的作品集，别人会不会觉得我只是一个想太多的设计师。',
    ],
  },
  {
    id: 'ops-pm-transition',
    title: '很会推进事情的运营执行者',
    audience: '适合测试“我一直在做，但没意识到这是职业优势”的路径',
    scenario:
      '31 岁，一线城市，做了 6 年运营/项目执行，经常是团队里那个把乱的事情理顺、把人拉齐、把节奏往前推的人。不喜欢高强度销售型工作，也不想纯打杂执行，在产品经理、项目管理、流程运营之间犹豫。',
    userTurns: [
      '我现在做运营和项目执行类工作，最大的感觉是我总在帮团队收拾混乱，但我也说不清自己真正适合什么岗位。',
      '很多事情没人盯的时候，最后都会落到我这里。我会自然去拆优先级、对齐人、催节点，但我不确定这是能力还是只是我比较能扛事。',
      '我不喜欢特别外向、天天要陌生开拓的工作，我更喜欢把复杂目标拆清楚，再一步步往前推进。',
      '我现在会犹豫，自己到底更适合产品经理、项目管理，还是流程运营这种方向。我担心自己其实没有哪一个特别像。',
      '如果只按做事时的状态来说，我最有掌控感的时刻是：一件事很乱，但我能把它慢慢理顺，让大家知道下一步做什么。',
      '我现实里的顾虑是，如果我去投产品经理，会不会因为没有典型的产品背景被刷掉；但如果只做运营执行，我又觉得自己的空间越来越窄。',
    ],
  },
  {
    id: 'trust-service-transition',
    title: '擅长建立信任的内容服务从业者',
    audience: '适合测试“高信任关系能力如何变成职业路径”的案例',
    scenario:
      '27 岁，新一线城市，做过内容运营、社群、客户服务。别人很容易跟她说真话，她也很容易抓到对方真正卡住的点。慢慢发现自己比起做流量，更擅长理解人、陪人梳理问题，但会怀疑这种能力是否太软。',
    userTurns: [
      '我以前一直做内容运营、社群和一些服务类工作，但最近越来越觉得，自己最稳定的能力好像不是做流量，而是理解人。',
      '别人很容易跟我讲心里话，我也常常能比较快感觉到，他们真正卡住的点和嘴上说出来的不是一回事。',
      '我以前会把这理解成“我比较会聊天”，但这两年我开始怀疑，这是不是其实是一种可以落到职业上的能力。',
      '我会被用户成功、职业辅导、顾问型服务这些方向吸引，但又很怕自己只是因为喜欢帮助别人，就把它想得太理想了。',
      '如果按我最有成就感的时刻来说，不是做出爆款内容，而是有人跟我聊完之后，突然把问题说清楚了，或者愿意往前走一步。',
      '我现在最担心的是，这种能力太软了。招聘市场会不会根本不把它当成专业价值，只会觉得我“性格不错”。',
    ],
  },
];

function parseAiStream(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
      if (!line.startsWith('0:')) return acc;
      const chunk = line.slice(2);
      try {
        acc += JSON.parse(chunk);
      } catch {
        // ignore malformed stream chunks
      }
      return acc;
    }, '');
}

async function callChat(messages) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`chat failed: ${res.status} ${text.slice(0, 240)}`);
  }
  return parseAiStream(text).trim();
}

async function callReport(messages) {
  const res = await fetch(`${BASE_URL}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`report failed: ${res.status} ${text.slice(0, 240)}`);
  }
  return JSON.parse(text);
}

async function generateCase(persona) {
  const messages = [];
  for (let index = 0; index < persona.userTurns.length; index += 1) {
    const userText = persona.userTurns[index];
    messages.push({
      id: `${persona.id}-u-${index + 1}`,
      role: 'user',
      content: userText,
    });
    const reply = await callChat(messages.map(({ role, content }) => ({ role, content })));
    messages.push({
      id: `${persona.id}-a-${index + 1}`,
      role: 'assistant',
      content: reply,
    });
  }

  const report = await callReport(messages.map(({ role, content }) => ({ role, content })));
  return {
    id: persona.id,
    title: persona.title,
    audience: persona.audience,
    scenario: persona.scenario,
    generatedAt: new Date().toISOString(),
    source: 'real-model',
    pitchMessages: messages.slice(0, 2),
    messages,
    report,
  };
}

async function main() {
  const generated = [];
  for (const persona of personas) {
    process.stdout.write(`Generating ${persona.id}...\n`);
    generated.push(await generateCase(persona));
  }

  const targetFile = path.join(process.cwd(), 'data', 'real-case-presets.json');
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
  process.stdout.write(`Saved ${generated.length} real cases to ${targetFile}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
