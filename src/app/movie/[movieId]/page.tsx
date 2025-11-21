import Link from 'next/link';
import { notFound } from 'next/navigation';

import MovieDetailRating from '../../components/MovieDetailRating';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const TIMEOUT_MS = 6000;

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbLanguage {
  english_name?: string;
  name?: string;
}

interface TmdbCompany {
  id: number;
  name: string;
}

interface MovieDetailResponse {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  runtime?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  tagline?: string | null;
  status?: string;
  homepage?: string | null;
  genres?: TmdbGenre[];
  spoken_languages?: TmdbLanguage[];
  production_companies?: TmdbCompany[];
}

const MOCK_DETAIL: MovieDetailResponse = {
  id: 603,
  title: 'The Matrix',
  overview: 'A hacker discovers reality is a simulation.',
  release_date: '1999-03-31',
  runtime: 136,
  poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  backdrop_path: '/aOIuZAjPaC7e7Uw7Yx41yovw0Gg.jpg',
  vote_average: 8.2,
  vote_count: 24000,
  tagline: 'Welcome to the Real World.',
  status: 'Released',
  homepage: 'https://www.warnerbros.com/movies/matrix',
  genres: [
    { id: 1, name: '动作' },
    { id: 2, name: '科幻' },
  ],
  spoken_languages: [{ english_name: 'English', name: 'English' }],
  production_companies: [{ id: 1, name: 'Village Roadshow Pictures' }],
};

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
  });
}

function formatRuntime(runtime?: number | null) {
  if (!runtime || runtime <= 0) return '暂无片长信息';
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (!hours) return `${minutes} 分钟`;
  if (!minutes) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

async function fetchMovieDetail(movieId: string): Promise<MovieDetailResponse | null> {
  const trimmed = movieId?.trim();
  if (!trimmed) return null;

  if (process.env.TMDB_MOCK === '1') {
    return { ...MOCK_DETAIL, id: Number.parseInt(trimmed, 10) || MOCK_DETAIL.id };
  }

  const token = process.env.TMDB_TOKEN || process.env.TMDB_API_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) {
    throw new Error('TMDB credentials missing');
  }

  const endpoint = new URL(`https://api.themoviedb.org/3/movie/${trimmed}`);
  endpoint.searchParams.set('language', 'zh-CN');

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
      // Lazy load undici so the dependency stays optional in environments where it is unavailable.
      const undici = await import('undici');
      if (proxyUrl) {
        const { ProxyAgent } = undici as any;
        dispatcher = new ProxyAgent(proxyUrl);
      } else if (forceIPv4) {
        const { Agent } = undici as any;
        dispatcher = new Agent({ connect: { family: 4 } });
      }
    } catch {
      // ignore proxy errors and fall back to the default global fetch dispatcher
    }
  }

  const controller = new AbortController();

  const response = await withTimeout(
    fetch(endpoint.toString(), {
      headers,
      // Provide light revalidation so frequent navigations do not always hit TMDB upstream.
      next: { revalidate: 900 },
      signal: controller.signal,
      // @ts-ignore dispatcher is an undici extension.
      dispatcher,
    }),
    TIMEOUT_MS,
    controller.signal
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`TMDB error ${response.status}`);
  }

  return (await response.json()) as MovieDetailResponse;
}

function buildMetaTitle(movie?: MovieDetailResponse | null) {
  if (!movie?.title) return '电影详情';
  const year = movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : '';
  return `${movie.title}${year} - 电影详情`;
}

export async function generateMetadata({ params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params;
    const movie = await fetchMovieDetail(movieId);
    if (!movie) {
      return { title: '未找到电影', description: '您访问的电影不存在或已下架。' };
    }
    return {
      title: buildMetaTitle(movie),
      description: movie.overview || '来自 TMDB 的电影详情。',
      openGraph: {
        title: buildMetaTitle(movie),
        description: movie.overview || undefined,
        images: movie.poster_path ? [`${POSTER_BASE}${movie.poster_path}`] : undefined,
      },
    };
  } catch {
    return { title: '电影详情', description: '暂时无法获取电影详情。' };
  }
}

export default async function MovieDetailPage({ params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;
  let movie: MovieDetailResponse | null = null;
  try {
    movie = await fetchMovieDetail(movieId);
  } catch (err) {
    console.error('[movie detail] fetch failed', err);
    throw err;
  }

  if (!movie) {
    notFound();
  }

  const posterUrl = movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null;
  const backdropUrl = movie.backdrop_path ? `${BACKDROP_BASE}${movie.backdrop_path}` : null;
  const genres = Array.isArray(movie.genres) ? movie.genres.map(g => g.name).filter(Boolean) : [];
  const languages = Array.isArray(movie.spoken_languages)
    ? movie.spoken_languages.map(lang => lang.name || lang.english_name).filter(Boolean)
    : [];
  const companies = Array.isArray(movie.production_companies)
    ? movie.production_companies.map(c => c.name).filter(Boolean)
    : [];

  return (
    <div className="relative isolate flex-1 min-h-full bg-slate-950 text-white">
      {backdropUrl && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src={backdropUrl}
            alt={movie.title}
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-950/80 to-slate-950" />
        </div>
      )}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:flex-row lg:gap-16 lg:py-16">
        <div className="flex shrink-0 justify-center lg:justify-start">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              /* 保持原始长宽比：不再强制设定固定宽度，使用自适应宽度，高度按最大高度限制 */
              className="h-auto w-auto max-h-[28rem] rounded-xl shadow-2xl"
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <div className="flex h-80 w-56 items-center justify-center rounded-xl bg-slate-800 text-sm text-slate-300">
              暂无海报
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-sky-300 transition hover:text-sky-200"
            >
              ← 返回搜索
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {movie.title}
                {movie.release_date ? (
                  <span className="ml-2 text-lg text-slate-300">
                    ({movie.release_date.slice(0, 4)})
                  </span>
                ) : null}
              </h1>
              {movie.tagline ? (
                <p className="mt-2 text-base italic text-slate-300">“{movie.tagline}”</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-200">
            {movie.release_date ? <span>上映日期：{movie.release_date}</span> : null}
            <span>片长：{formatRuntime(movie.runtime)}</span>
            {genres.length ? <span>类型：{genres.join(' / ')}</span> : null}
            {movie.status ? <span>状态：{movie.status}</span> : null}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">剧情简介</h2>
            <p className="text-sm leading-6 text-slate-200">
              {movie.overview || '暂无简介信息。'}
            </p>
          </div>

          <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">TMDB 评分</h3>
              <p>
                {typeof movie.vote_average === 'number' && movie.vote_average > 0
                  ? `${movie.vote_average.toFixed(1)} 分（${movie.vote_count ?? 0} 人评分）`
                  : '暂无评分'}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">语言</h3>
              <p>{languages.length ? languages.join(' / ') : '暂无语言信息'}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">制作公司</h3>
              <p>{companies.length ? companies.join(' / ') : '暂无制作公司信息'}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">官方网站</h3>
              {movie.homepage ? (
                <a
                  href={movie.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300 underline-offset-2 hover:underline"
                >
                  前往访问
                </a>
              ) : (
                <p>暂无官方网站</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="max-w-2xl">
          <MovieDetailRating movieId={String(movie.id)} />
        </div>
      </div>
    </div>
  );
}
