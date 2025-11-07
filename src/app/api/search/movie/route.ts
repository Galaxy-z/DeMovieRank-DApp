import { NextRequest, NextResponse } from 'next/server';

/**
 * TMDB movie search proxy with light caching and mock support.
 * Env:
 *  TMDB_TOKEN or TMDB_API_TOKEN (preferred v4 bearer)
 *  TMDB_API_KEY                (v3 fallback)
 *  TMDB_MOCK=1                 (force mock data)
 *  PROXY_URL / HTTPS_PROXY / HTTP_PROXY
 *  FORCE_IPV4=1
 */

const cache = new Map<string, { ts: number; data: any }>();
const CACHE_TTL = 30_000; // 30s
const TIMEOUT_MS = 6000;

const MOCK_RESULTS = {
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    {
      id: 603,
      title: 'The Matrix',
      overview: 'A hacker discovers reality is a simulation.',
      release_date: '1999-03-31',
      poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    },
    {
      id: 272,
      title: 'Batman Begins',
      overview: 'Bruce Wayne becomes the Dark Knight.',
      release_date: '2005-06-10',
      poster_path: '/1P3ZyEq02wlU9yD7UGnG4cmU7cJ.jpg',
    },
  ],
};

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
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);

  if (!q) {
    return NextResponse.json({ page: 1, total_pages: 0, total_results: 0, results: [] });
  }

  if (searchParams.get('mock') === '1' || process.env.TMDB_MOCK === '1') {
    return NextResponse.json(MOCK_RESULTS);
  }

  const token = process.env.TMDB_TOKEN || process.env.TMDB_API_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) {
    return NextResponse.json({ error: 'TMDB credentials missing' }, { status: 500 });
  }

  const cacheKey = `${q.toLowerCase()}::${page}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.data, { headers: { 'X-Cache': 'HIT' } });
  }

  const endpoint = new URL('https://api.themoviedb.org/3/search/movie');
  endpoint.searchParams.set('query', q);
  endpoint.searchParams.set('page', String(page));

  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (apiKey) {
    endpoint.searchParams.set('api_key', apiKey);
  }

  let dispatcher: any;
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
    } catch {
      /* ignore */
    }
  }

  const ac = new AbortController();

  try {
    const fetchPromise = fetch(endpoint.toString(), {
      headers,
      signal: ac.signal,
      cache: 'no-store',
      // @ts-ignore: dispatcher is an undici extension
      dispatcher,
    });
    const resp = await withTimeout(fetchPromise, TIMEOUT_MS, ac.signal);
    if (!resp.ok) {
      return NextResponse.json({ error: 'Upstream error', status: resp.status }, { status: 502 });
    }
    const json = await resp.json();
    const payload = {
      page: json.page ?? page,
      total_pages: json.total_pages ?? 0,
      total_results: json.total_results ?? 0,
      results: Array.isArray(json.results)
        ? json.results.map((item: any) => ({
            id: item.id,
            title: item.title,
            overview: item.overview,
            release_date: item.release_date,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
          }))
        : [],
    };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } });
  } catch (e: any) {
    const msg = e?.message === 'timeout' ? 'timeout' : e?.message === 'aborted' ? 'aborted' : 'network';
    return NextResponse.json({ error: 'Network error', detail: msg }, { status: 500 });
  }
}
