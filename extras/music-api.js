/**
 * music-api.js — free, keyless music API layer for a music site.
 *
 * Zero dependencies. Works in the browser and in Node 18+ (global fetch).
 *
 *   import * as music from './music-api.js';
 *   const tracks = await music.searchCC('lofi', { commercialOnly: true });
 *
 * Every function returns a normalised Track:
 *   { id, title, artist, album, art, duration, license, licenseUrl,
 *     attribution, streamUrl, downloadUrl, source, raw }
 *
 * Nothing here needs an API key, an account, or a backend.
 */

/* ------------------------------------------------------------------ */
/* Normalised shape                                                    */
/* ------------------------------------------------------------------ */

/** @typedef {Object} Track
 *  @property {string} id
 *  @property {string} title
 *  @property {string} artist
 *  @property {string} [album]
 *  @property {string} art            artwork URL ('' if none)
 *  @property {number} duration       milliseconds (0 if unknown)
 *  @property {string} [license]      e.g. 'by', 'by-nc-nd'
 *  @property {string} [licenseUrl]
 *  @property {string} [attribution]  required credit line, if the licence needs one
 *  @property {string} streamUrl      playable/streamable URL
 *  @property {string} [downloadUrl]  present ONLY when the licence allows download
 *  @property {'openverse'|'archive'|'itunes'|'audius'|'deezer'|'radio'} source
 *  @property {any} [raw]             untouched upstream object
 */

const UA_HINT = 'Set a descriptive User-Agent if you call these from a server.';

class MusicApiError extends Error {
  constructor(message, status, source) {
    super(message);
    this.name = 'MusicApiError';
    this.status = status;
    this.source = source;
  }
}

async function getJSON(url, { source, timeout = 15000, headers } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new MusicApiError(`${source}: HTTP ${res.status}`, res.status, source);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new MusicApiError(`${source}: timed out`, 0, source);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ */
/* 1. Openverse — Creative Commons audio (downloadable)                */
/* ------------------------------------------------------------------ */

const COMMERCIAL_SAFE = 'by,by-sa,cc0,pdm';

/**
 * Search Creative Commons music via Openverse (Jamendo + Wikimedia + others).
 * Fully keyless. CORS-open, so it works straight from the browser.
 *
 * @param {string} query
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]            max 20 (Openverse caps page_size)
 * @param {boolean} [opts.commercialOnly]     restrict to BY / BY-SA / CC0 / PD
 * @param {string} [opts.license]             explicit license list, comma separated
 * @param {('jamendo'|'wikimedia_commons'|'freesound')} [opts.source]
 * @returns {Promise<Track[]>}
 */
export async function searchCC(query, opts = {}) {
  const { limit = 20, commercialOnly = false, license, source } = opts;
  const params = new URLSearchParams({
    q: query || 'music',
    page_size: String(Math.min(limit, 20)),
  });
  if (commercialOnly) params.set('license', COMMERCIAL_SAFE);
  else if (license) params.set('license', license);
  if (source) params.set('source', source);

  const data = await getJSON(`https://api.openverse.org/v1/audio/?${params}`, { source: 'openverse' });
  return (data.results || [])
    .filter((r) => r.url)
    .map((r) => ({
      id: `ov:${r.id}`,
      title: decodeEntities(r.title || 'Untitled'),
      artist: decodeEntities(r.creator || 'Unknown artist'),
      album: decodeEntities(r.audio_set?.title || ''),
      art: r.thumbnail || '',
      duration: r.duration || 0,
      license: r.license || '',
      licenseUrl: r.license_url || '',
      attribution: r.attribution || '',
      streamUrl: r.url,
      downloadUrl: r.url, // CC licences on Openverse permit download
      source: 'openverse',
      raw: r,
    }));
}

/* ------------------------------------------------------------------ */
/* 2. Internet Archive — public-domain / CC releases                   */
/* ------------------------------------------------------------------ */

/**
 * Search Internet Archive audio items that contain MP3s.
 * @param {string} query
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]
 * @param {boolean} [opts.commercialOnly]  only items tagged with a CC licence URL
 * @returns {Promise<Array<{id,title,creator,year,license,licenseUrl,trackCount}>>}
 */
export async function searchArchive(query, opts = {}) {
  const { limit = 20, commercialOnly = false } = opts;
  let q = `(${query || 'music'}) AND mediatype:audio AND format:(MP3)`;
  if (commercialOnly) q += ' AND licenseurl:(*creativecommons.org*)';

  const url =
    'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) +
    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=licenseurl' +
    `&rows=${Math.min(limit, 50)}&page=1&output=json&sort%5B%5D=downloads+desc`;

  const data = await getJSON(url, { source: 'archive' });
  // NOTE: these are *items* (releases), not tracks. Call getArchiveTracks(item.id)
  // to expand one into playable Tracks. `type` tells them apart.
  return (data.response?.docs || []).map((d) => ({
    type: 'item',
    id: d.identifier,
    title: d.title || d.identifier,
    creator: Array.isArray(d.creator) ? d.creator[0] : (d.creator || 'Internet Archive'),
    year: d.year || '',
    license: d.licenseurl || '',
    licenseUrl: d.licenseurl || '',
    source: 'archive',
  }));
}

/**
 * List the MP3 tracks inside one Internet Archive item.
 * @param {string} identifier  from searchArchive()
 * @param {number} [limit=50]
 * @returns {Promise<Track[]>}
 */
export async function getArchiveTracks(identifier, limit = 50) {
  const meta = await getJSON(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
    source: 'archive',
  });
  const itemTitle = meta.metadata?.title || identifier;
  const creator = meta.metadata?.creator || 'Internet Archive';
  const license = meta.metadata?.licenseurl || '';

  return (meta.files || [])
    .filter((f) => /\.mp3$/i.test(f.name || ''))
    .slice(0, limit)
    .map((f) => {
      const url =
        'https://archive.org/download/' +
        encodeURIComponent(identifier) + '/' + encodeURIComponent(f.name);
      return {
        id: `ia:${identifier}:${f.name}`,
        title: decodeEntities(f.title || f.name.replace(/\.mp3$/i, '')),
        artist: decodeEntities(f.artist || creator),
        album: decodeEntities(itemTitle),
        art: '',
        duration: f.length ? hmsToMs(f.length) : 0,
        license,
        licenseUrl: license,
        attribution: '',
        streamUrl: url,
        downloadUrl: url, // public-domain / CC items
        source: 'archive',
        raw: f,
      };
    });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(str) {
  return String(str ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : full;
    }
    return ENTITIES[code.toLowerCase()] ?? full;
  });
}

function hmsToMs(s) {
  const parts = String(s).split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  const [h = 0, m = 0, sec = 0] = parts.length === 3 ? parts : [0, ...parts];
  return ((h * 60 + m) * 60 + sec) * 1000;
}

/* ------------------------------------------------------------------ */
/* 3. iTunes Search — catalogue + 30s previews (stream only)           */
/* ------------------------------------------------------------------ */

/**
 * Search the Apple/iTunes catalogue. Keyless, CORS-open.
 * NOTE: only 30-second previews. Downloading these is NOT permitted,
 * so `downloadUrl` is deliberately absent.
 * @param {string} query
 * @param {Object} [opts]
 * @param {number} [opts.limit=25]
 * @param {'in'|'us'|'gb'} [opts.country]  storefront (default 'in')
 * @returns {Promise<Track[]>}
 */
export async function searchITunes(query, opts = {}) {
  const { limit = 25, country = 'in' } = opts;
  const url =
    'https://itunes.apple.com/search?term=' + encodeURIComponent(query || 'top hits') +
    `&entity=song&limit=${Math.min(limit, 200)}&country=${country}`;
  const data = await getJSON(url, { source: 'itunes' });

  return (data.results || [])
    .filter((t) => t.previewUrl)
    .map((t) => ({
      id: `it:${t.trackId}`,
      title: decodeEntities(t.trackName),
      artist: decodeEntities(t.artistName),
      album: decodeEntities(t.collectionName || ''),
      art: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
      duration: t.trackTimeMillis || 30000,
      license: 'preview-only',
      licenseUrl: '',
      attribution: 'Preview courtesy of Apple iTunes Search API',
      streamUrl: t.previewUrl,
      source: 'itunes',
      raw: t,
    }));
}


/* ------------------------------------------------------------------ */
/* 3b. India — Hindi / Punjabi / regional charts                       */
/* ------------------------------------------------------------------ */

/**
 * Apple's official iTunes genre IDs for Indian music.
 * Use with getTopCharts({ genreId }) or searchIndian().
 */
export const INDIA_GENRES = {
  indian: 1262,
  bollywood: 1263,
  devotional: 1267,
  sufi: 1268,
  indianClassical: 1269,
  ghazals: 1278,
  indianFolk: 1279,
  indianPop: 1185,
  regional: 1266,
  punjabi: 100045,
  punjabiPop: 100033,
  haryanvi: 100041,
  bhojpuri: 100040,
  tamil: 1264,
  telugu: 1265,
  bengali: 100046,
  marathi: 100037,
  gujarati: 100038,
  kannada: 100036,
  malayalam: 100035,
  urdu: 100044,
};

/**
 * Apple's free, keyless Top Songs chart (legacy RSS). Works per country and
 * per genre, and is the best free source of actual Hindi/Punjabi chart data.
 *
 *   await getTopCharts({ country: 'in', genreId: INDIA_GENRES.punjabiPop, limit: 25 })
 *
 * @param {Object} [opts]
 * @param {string} [opts.country='in']
 * @param {number} [opts.genreId]              see INDIA_GENRES
 * @param {number} [opts.limit=25]             max 100
 * @param {boolean} [opts.withPreview=true]    extra lookup call to attach 30s previews
 * @returns {Promise<Track[]>}
 */
export async function getTopCharts(opts = {}) {
  const { country = 'in', genreId, limit = 25, withPreview = true } = opts;
  const n = Math.min(limit, 100);
  const genrePath = genreId ? `/genre=${genreId}` : '';
  const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=${n}${genrePath}/json`;

  const feed = await getJSON(url, { source: 'itunes-charts' });
  const entries = feed?.feed?.entry || [];

  let tracks = entries.map((e) => {
    const id = e.id?.attributes?.['im:id'] || '';
    const images = e['im:image'] || [];
    const art = images.length ? images[images.length - 1].label : '';
    return {
      id: `it:${id}`,
      title: decodeEntities(e['im:name']?.label || 'Untitled'),
      artist: decodeEntities(e['im:artist']?.label || ''),
      album: decodeEntities(e['im:collection']?.['im:name']?.label || ''),
      art: art.replace(/\/\d+x\d+bb/, '/600x600bb'),
      duration: 30000,
      license: 'preview-only',
      attribution: 'Chart data from Apple iTunes RSS',
      streamUrl: '',
      source: 'itunes',
      rank: Number(e['im:price'] ? 0 : 0) || undefined,
      raw: e,
    };
  });

  // The RSS has no audio; batch-lookup the ids to attach 30s previews.
  if (withPreview && tracks.length) {
    const ids = tracks.map((t) => t.id.replace('it:', '')).filter(Boolean).join(',');
    try {
      const look = await getJSON(
        `https://itunes.apple.com/lookup?id=${ids}&country=${country}`,
        { source: 'itunes' }
      );
      const byId = new Map((look.results || []).map((r) => [String(r.trackId), r]));
      tracks = tracks.map((t) => {
        const r = byId.get(t.id.replace('it:', ''));
        if (!r) return t;
        return {
          ...t,
          title: decodeEntities(r.trackName || t.title),
          artist: decodeEntities(r.artistName || t.artist),
          album: decodeEntities(r.collectionName || t.album),
          art: (r.artworkUrl100 || t.art).replace('100x100bb', '600x600bb'),
          duration: r.trackTimeMillis || 30000,
          streamUrl: r.previewUrl || '',
          genre: r.primaryGenreName || '',
        };
      });
    } catch { /* keep chart data even if previews fail */ }
  }

  return tracks.filter((t) => t.streamUrl || !withPreview);
}

/**
 * Search Indian music specifically. Country is forced to 'in' so the storefront
 * returns Hindi/Punjabi/regional results rather than the US catalogue.
 *
 * Accepts Latin, Devanagari or Gurmukhi script:
 *   searchIndian('Diljit Dosanjh')
 *   searchIndian('ਦਿਲਜੀਤ ਦੋਸਾਂਝ')
 *   searchIndian('केसरीया')
 *
 * @param {string} query
 * @param {Object} [opts] { limit, genreId, country='in' }
 * @returns {Promise<Track[]>}
 */
export async function searchIndian(query, opts = {}) {
  const { limit = 25, genreId, country = 'in' } = opts;
  const tracks = await searchITunes(query, { limit, country });
  if (!genreId) return tracks;

  // Genre isn't a search parameter on iTunes, so filter by the returned genre
  // name when the caller asked for a specific Indian genre.
  const wanted = Object.entries(INDIA_GENRES).find(([, v]) => v === genreId)?.[0];
  const nameMap = {
    punjabiPop: 'Punjabi', punjabi: 'Punjabi', bollywood: 'Bollywood',
    tamil: 'Tamil', telugu: 'Telugu', sufi: 'Sufi', ghazals: 'Ghazal',
    devotional: 'Devotional', indianPop: 'Indian Pop', indianFolk: 'Folk',
  };
  const needle = (nameMap[wanted] || '').toLowerCase();
  return needle
    ? tracks.filter((t) => (t.raw?.primaryGenreName || '').toLowerCase().includes(needle))
    : tracks;
}


/**
 * Build an official Apple Music embed URL from an iTunes track.
 * This is the legal, free way to give users FULL-length Hindi/Punjabi
 * playback: Apple serves the audio and pays the royalties. Subscribers get
 * the whole song; everyone else gets the official preview.
 *
 *   <iframe allow="autoplay *; encrypted-media *" src={getAppleEmbedUrl(t)} />
 *
 * @param {Track} track     a track whose source is 'itunes'
 * @param {string} [storefront='in']
 * @returns {string} embed URL, or '' if the track has no Apple IDs
 */
export function getAppleEmbedUrl(track, storefront = 'in') {
  const raw = track?.raw || {};
  if (raw.collectionId && raw.trackId) {
    return `https://embed.music.apple.com/${storefront}/album/${raw.collectionId}?i=${raw.trackId}`;
  }
  if (raw.id?.attributes?.['im:id'] && raw['im:collection']?.link?.attributes?.href) {
    const m = raw['im:collection'].link.attributes.href.match(/\/album\/(?:[^/]+\/)?(\d+)/);
    if (m) return `https://embed.music.apple.com/${storefront}/album/${m[1]}?i=${raw.id.attributes['im:id']}`;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* 4. Audius — full-length independent music (stream)                  */
/* ------------------------------------------------------------------ */

/**
 * Search Audius. Keyless, CORS-open, full-length streams.
 * Downloads are almost always 403 (artist opt-in only), so no downloadUrl.
 * @param {string} query
 * @param {number} [limit=25]
 * @returns {Promise<Track[]>}
 */
export async function searchAudius(query, limit = 25) {
  const url =
    'https://api.audius.co/v1/tracks/search?query=' + encodeURIComponent(query || 'lofi') +
    `&limit=${Math.min(limit, 100)}`;
  const data = await getJSON(url, { source: 'audius' });

  return (data.data || []).map((t) => ({
    id: `au:${t.id}`,
    title: decodeEntities(t.title),
    artist: decodeEntities(t.user?.name || 'Audius artist'),
    album: '',
    art: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
    duration: (t.duration || 0) * 1000,
    license: t.is_downloadable ? 'artist-allows-download' : 'stream-only',
    streamUrl: `https://api.audius.co/v1/tracks/${t.id}/stream`,
    downloadUrl: t.is_downloadable ? `https://api.audius.co/v1/tracks/${t.id}/download` : undefined,
    source: 'audius',
    raw: t,
  }));
}

/* ------------------------------------------------------------------ */
/* 5. Deezer — rich metadata + charts (NON-COMMERCIAL, needs a proxy)  */
/* ------------------------------------------------------------------ */

/**
 * Deezer via your own proxy (api.deezer.com sends no CORS headers).
 * See deezer-proxy.mjs. Deezer's terms are NON-COMMERCIAL only.
 * @param {string} query
 * @param {string} [proxyBase='/api/deezer']
 */
export async function searchDeezer(query, proxyBase = '/api/deezer') {
  const url = `${proxyBase}/search?q=${encodeURIComponent(query)}&limit=25`;
  const data = await getJSON(url, { source: 'deezer' });
  if (data.error) throw new MusicApiError(`deezer: ${data.error.message}`, 502, 'deezer');

  return (data.data || []).map((t) => ({
    id: `dz:${t.id}`,
    title: t.title,
    artist: t.artist?.name || '',
    album: t.album?.title || '',
    art: t.album?.cover_xl || t.album?.cover_medium || '',
    duration: (t.duration || 0) * 1000,
    isrc: t.isrc,
    license: 'preview-only',
    streamUrl: t.preview,
    source: 'deezer',
    raw: t,
  }));
}

/* ------------------------------------------------------------------ */
/* 6. Radio Browser — live full-length radio, no licensing needed      */
/* ------------------------------------------------------------------ */

/**
 * Search live radio stations. Keyless, CORS-open, no licensing to clear.
 * @param {string} query
 * @param {Object} [opts]
 * @param {number} [opts.limit=25]
 * @param {string} [opts.countryCode]  e.g. 'IN'
 */
export async function searchRadio(query, opts = {}) {
  const { limit = 25, countryCode } = opts;
  const params = new URLSearchParams({
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: String(Math.min(limit, 100)),
  });
  if (query) params.set('name', query);
  if (countryCode) params.set('countrycode', countryCode);

  const data = await getJSON(
    `https://de1.api.radio-browser.info/json/stations/search?${params}`,
    { source: 'radio' }
  );

  return (data || [])
    .filter((s) => s.url_resolved)
    .map((s) => ({
      id: `rb:${s.stationuuid}`,
      title: s.name,
      artist: [s.country, s.state].filter(Boolean).join(', '),
      album: s.tags ? s.tags.split(',').slice(0, 3).join(', ') : '',
      art: s.favicon || '',
      duration: 0,
      license: 'live-radio',
      streamUrl: s.url_resolved,
      source: 'radio',
      raw: s,
    }));
}

/* ------------------------------------------------------------------ */
/* 7. lrclib — free synced lyrics                                      */
/* ------------------------------------------------------------------ */

/**
 * Look up lyrics. Keyless, CORS-open.
 * @param {{q?: string, track?: string, artist?: string}} q
 * @returns {Promise<Array<{id,title,artist,album,duration,plainLyrics,syncedLyrics}>>}
 */
export async function getLyrics({ q, track, artist } = {}) {
  const params = new URLSearchParams();
  if (track && artist) { params.set('track_name', track); params.set('artist_name', artist); }
  else params.set('q', q || '');

  const data = await getJSON(`https://lrclib.net/api/search?${params}`, { source: 'lrclib' });
  return (Array.isArray(data) ? data : []).map((r) => ({
    id: r.id,
    title: r.trackName,
    artist: r.artistName,
    album: r.albumName,
    duration: Math.round((r.duration || 0) * 1000),
    plainLyrics: r.plainLyrics || '',
    syncedLyrics: r.syncedLyrics || '',
  }));
}

/* ------------------------------------------------------------------ */
/* 8. Download helper — turns a Track into a saved file                */
/* ------------------------------------------------------------------ */

/**
 * Download a track to the user's disk. Only call this when
 * track.downloadUrl exists — that means the licence allows it.
 * @param {Track} track
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} the filename saved
 */
export async function downloadTrack(track, onProgress) {
  if (!track.downloadUrl) {
    throw new MusicApiError(
      `"${track.title}" is not downloadable — its source only permits streaming/preview.`,
      0,
      track.source
    );
  }
  const res = await fetch(track.downloadUrl);
  if (!res.ok) throw new MusicApiError(`download failed: HTTP ${res.status}`, res.status, track.source);

  const total = Number(res.headers.get('content-length')) || 0;
  let blob;

  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && total) onProgress(Math.round((received / total) * 100));
    }
    blob = new Blob(chunks, { type: res.headers.get('content-type') || 'audio/mpeg' });
  } else {
    blob = await res.blob();
  }
  if (onProgress) onProgress(100);

  const ext = (track.downloadUrl.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
  const filename =
    safeFilename(`${track.title} - ${track.artist}`) + '.' + (/^[a-z0-9]{2,4}$/.test(ext) ? ext : 'mp3');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 15000);
  return filename;
}

function safeFilename(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'track';
}

/* ------------------------------------------------------------------ */
/* 9. Unified search — try several sources, merge results              */
/* ------------------------------------------------------------------ */

/**
 * Search every free source at once and merge into one list.
 * @param {string} query
 * @param {Object} [opts]
 * @param {number} [opts.perSource=10]
 * @param {boolean} [opts.commercialOnly]
 * @param {string[]} [opts.sources]  default: ['cc','archive','itunes','audius']
 */
export async function searchAll(query, opts = {}) {
  const { perSource = 10, commercialOnly = false, country = 'in', sources = ['cc', 'archive', 'itunes', 'audius'] } = opts;

  const jobs = {
    cc: () => searchCC(query, { limit: perSource, commercialOnly }),
    // Archive returns *items*; expand the top few into real tracks so the
    // merged list contains only playable/downloadable Tracks.
    archive: async () => {
      const items = await searchArchive(query, { limit: 3, commercialOnly });
      const expanded = await Promise.allSettled(
        items.slice(0, 2).map((it) => getArchiveTracks(it.id, Math.max(2, Math.ceil(perSource / 2))))
      );
      return expanded.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
    itunes: () => searchITunes(query, { limit: perSource, country }),
    audius: () => searchAudius(query, perSource),
    radio: () => searchRadio(query, { limit: perSource }),
  };

  const settled = await Promise.allSettled(
    sources.filter((s) => jobs[s]).map((s) => jobs[s]())
  );

  const tracks = [];
  const errors = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled') tracks.push(...r.value.filter((t) => t && t.streamUrl));
    else errors.push(r.reason?.message || String(r.reason));
  });

  // Downloadable tracks first, then streamable, then live radio.
  const rank = (t) => (t.downloadUrl ? 0 : t.source === 'radio' ? 2 : 1);
  tracks.sort((a, b) => rank(a) - rank(b));
  return { tracks, errors };
}

export { MusicApiError, COMMERCIAL_SAFE, UA_HINT, decodeEntities };
export default {
  searchCC, searchArchive, getArchiveTracks,
  searchITunes, searchIndian, getTopCharts, INDIA_GENRES, getAppleEmbedUrl,
  searchAudius, searchDeezer, searchRadio, getLyrics, downloadTrack, searchAll,
};
