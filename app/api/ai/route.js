// ハンコ工房：親方・鑑定士のAIを呼ぶ口（APIキーはサーバー側の環境変数にだけ置く）
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREFIX = 'あなたは鹿児島';          // 工房のプロンプト以外は受け付けない
const hits = new Map();                  // 簡易レート制限（IPごとに1分10回）

export async function GET() {
  return Response.json({ ok: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'no key' }, { status: 503 });

  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) return Response.json({ error: 'rate' }, { status: 429 });
  recent.push(now);
  hits.set(ip, recent);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const prompt = String(body.prompt || '');
  if (!prompt.startsWith(PREFIX) || prompt.length > 2500) {
    return Response.json({ error: 'bad prompt' }, { status: 400 });
  }
  const head = 'data:image/png;base64,';
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((s) => typeof s === 'string' && s.startsWith(head) && s.length < 700_000)
    .slice(0, 1);

  const content = [
    ...images.map((s) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: s.slice(head.length) } })),
    { type: 'text', text: prompt },
  ];

  let r;
  try {
  r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.HANKO_MODEL || 'claude-haiku-5-5',
      max_tokens: 600,
      messages: [{ role: 'user', content }],
    }),
  });
  } catch (e) {
    return Response.json({ error: 'network' }, { status: 502 });
  }
  if (!r.ok) return Response.json({ error: 'upstream ' + r.status }, { status: 502 });
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  return Response.json({ text });
}
