// Cloudflare Pages worker: expands Google Maps short links, serves the site otherwise.
const OK_HOSTS = ['maps.app.goo.gl','goo.gl','g.co','google.com','www.google.com','maps.google.com','consent.google.com'];
const okHost = h => OK_HOSTS.includes(h.toLowerCase()) || /^(www\.)?google\.[a-z.]{2,6}$/i.test(h);
const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json'}});

async function resolve(input) {
  let url;
  try { url = new URL(input); } catch (e) { return {error: 'That is not a valid link.'}; }
  if (url.protocol !== 'https:' || !okHost(url.hostname)) return {error: 'Only Google Maps links are supported.'};
  for (let i = 0; i < 8; i++) {
    if (url.hostname === 'consent.google.com' && url.searchParams.get('continue')) {
      try { url = new URL(url.searchParams.get('continue')); } catch (e) { break; }
      if (!okHost(url.hostname)) return {error: 'Unexpected redirect.'};
      continue;
    }
    // Stop as soon as we have a long Maps URL
    if (/google\.[a-z.]+\/maps\/place\//i.test(url.href) || /[?&]ftid=|!1s0x/.test(url.href)) return {url: url.href};
    const res = await fetch(url.href, {redirect: 'manual', headers: {'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9'}});
    const loc = res.headers.get('location');
    if (!loc) return {url: url.href};
    url = new URL(loc, url);
    if (!okHost(url.hostname)) return {error: 'Unexpected redirect.'};
  }
  return {url: url.href};
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    if (u.pathname === '/api/resolve') {
      const target = u.searchParams.get('url');
      if (!target) return json({error: 'Missing url.'}, 400);
      try {
        const r = await resolve(target);
        return json(r, r.error ? 400 : 200);
      } catch (e) { return json({error: 'Could not open that link.'}, 502); }
    }
    return env.ASSETS.fetch(request);
  }
};
