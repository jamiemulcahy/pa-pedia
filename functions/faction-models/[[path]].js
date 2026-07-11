/**
 * Cloudflare Pages Function: proxy /faction-models/* to the GitHub `faction-models`
 * release, same-origin.
 *
 * Model bundles are 20-80 MB — too large to bake into the Pages deploy (25 MB
 * per-file limit), and GitHub release assets send no CORS headers, so the
 * browser can't fetch them cross-origin. This Function streams them from the
 * release server-side (same-origin → no CORS) and forwards HTTP Range so the
 * web app's per-unit range reads into the bundles keep working.
 */

const RELEASE_BASE =
  'https://github.com/jamiemulcahy/pa-pedia/releases/download/faction-models/'

export async function onRequest(context) {
  const { request, params } = context

  // Catch-all param: filename segment(s) after /faction-models/.
  const segs = Array.isArray(params.path) ? params.path : [params.path]
  const file = segs.join('/')
  if (!file) {
    return new Response('Not found', { status: 404 })
  }

  // Only GET/HEAD make sense for asset delivery.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const target = RELEASE_BASE + encodeURIComponent(file)

  // Forward only Range (and If-Range) — never cookies/auth to a public asset.
  const fwd = {}
  const range = request.headers.get('Range')
  if (range) fwd['Range'] = range
  const ifRange = request.headers.get('If-Range')
  if (ifRange) fwd['If-Range'] = ifRange

  const upstream = await fetch(target, {
    method: request.method,
    headers: fwd,
    redirect: 'follow',
  })

  // Copy through the headers the web client relies on for range + caching.
  const headers = new Headers()
  for (const h of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  // Cache only successful responses — bundle filenames are timestamped
  // (immutable). Never cache errors (a transient 404/5xx or a not-yet-uploaded
  // bundle must not be cached as broken for a day).
  if (upstream.ok || upstream.status === 206) {
    headers.set('cache-control', 'public, max-age=86400')
    // Always advertise range support. Both this proxy and the release backend
    // honour Range (verified 206), but GitHub's CDN omits Accept-Ranges on the
    // 206/HEAD responses — and zip.js (the web client) treats a missing
    // Accept-Ranges as "no range support" and refuses to do range reads, which
    // would hide the 3D viewer. Setting it here keeps the per-unit range reads.
    headers.set('accept-ranges', 'bytes')
  } else {
    headers.set('cache-control', 'no-store')
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}
