import { NextRequest, NextResponse } from 'next/server';

/**
 * Simplified TMDB keyword proxy route.
 * Features kept: cache, mock mode, bearer/api key auth, optional proxy/IPv4.
 * Removed: verbose debug / trace / dns diagnostics.
 * Env:
 *  TMDB_TOKEN or TMDB_API_TOKEN  (v4 bearer preferred)
 *  TMDB_API_KEY                  (v3 fallback)
 *  TMDB_MOCK=1                   (force mock data)
 *  PROXY_URL / HTTPS_PROXY / HTTP_PROXY (optional outbound proxy)
 *  FORCE_IPV4=1                  (force IPv4 via undici Agent)
 */

// Minimal in-memory cache
const cache = new Map<string, { ts: number; data: any }>();
const CACHE_TTL = 30_000; // 30s
const TIMEOUT_MS = 6000;  // fetch timeout

const MOCK_RESULTS = [
  { id: 101, name: 'kung fu' },
  { id: 102, name: 'martial arts' },
  { id: 103, name: 'action comedy' },
];

function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(r => { clearTimeout(id); resolve(r); }, e => { clearTimeout(id); reject(e); });
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ results: [] });

  // mock mode
  if (searchParams.get('mock') === '1' || process.env.TMDB_MOCK === '1') {
    const filtered = MOCK_RESULTS.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
    return NextResponse.json({ results: filtered, mock: true });
  }

  const token = process.env.TMDB_TOKEN || process.env.TMDB_API_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) {
    return NextResponse.json({ error: 'TMDB credentials missing' }, { status: 500 });
  }

  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.data, { headers: { 'X-Cache': 'HIT' } });
  }

  const endpoint = new URL('https://api.themoviedb.org/3/search/keyword');
  endpoint.searchParams.set('query', q);
  endpoint.searchParams.set('page', '1');

  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`; else if (apiKey) endpoint.searchParams.set('api_key', apiKey);

  // Proxy / IPv4 (best-effort; ignore errors silently)
  let dispatcher: any = undefined;
  const proxyUrl = process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const forceIPv4 = process.env.FORCE_IPV4 === '1';
  if (proxyUrl || forceIPv4) {
    try {
      const undici = await import('undici');
      if (proxyUrl) {
        const { ProxyAgent } = undici as any;
        dispatcher = new ProxyAgent(proxyUrl);
      } else if (forceIPv4) {
        const { Agent } = undici as any;
        dispatcher = new Agent({ connect: { family: 4 } });
      }
    } catch {/* ignore */}
  }

  const ac = new AbortController();
  try {
    const fetchPromise = fetch(endpoint.toString(), {
      headers,
      signal: ac.signal,
      cache: 'no-store',
      // @ts-ignore - dispatcher is non-standard but supported by undici runtime
      dispatcher,
    });
    const resp = await withTimeout(fetchPromise, TIMEOUT_MS, ac.signal);
    if (!resp.ok) {
      return NextResponse.json({ error: 'Upstream error', status: resp.status }, { status: 502 });
    }
    const json = await resp.json();
    const results = Array.isArray(json.results) ? json.results.map((r: any) => ({ id: r.id, name: r.name })) : [];
    const payload = { results };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } });
  } catch (e: any) {
    const msg = e?.message === 'timeout' ? 'timeout' : e?.message === 'aborted' ? 'aborted' : 'network';
    return NextResponse.json({ error: 'Network error', detail: msg }, { status: 500 });
  }
}
