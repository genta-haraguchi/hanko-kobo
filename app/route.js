// トップ（/）で工房のページを返す。
// X などのカード表示には og:image が絶対URLである必要があるので、アクセスされたホスト名で書き換えて返す。
import html from './page-html.js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  // 公開先は https。手元（localhost）で動かした時だけ http のまま
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https';
  const origin = host ? `${proto}://${host}` : '';
  const body = origin
    ? html
        .replace('content="/ogp.png"', `content="${origin}/ogp.png"`)
        .replace('<meta property="og:type"', `<meta property="og:url" content="${origin}/">\n<meta property="og:type"`)
        .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/manifest.webmanifest">')
    : html;
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
