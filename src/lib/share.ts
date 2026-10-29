import LZString from 'lz-string';

export interface SharePayload {
  v: 1;
  name: string;
  source: string;
}

export function encodeSharePayload(payload: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const raw = LZString.decompressFromEncodedURIComponent(encoded);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.source !== 'string') return null;
    return {
      v: 1,
      name: typeof parsed.name === 'string' ? parsed.name : 'Shared diagram',
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

export function readShareFromUrl(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('doc');
  if (!encoded) return null;
  return decodeSharePayload(encoded);
}

export function buildShareUrl(payload: SharePayload): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('doc', encodeSharePayload(payload));
  return url.toString();
}

export function clearShareParam() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('doc')) return;
  url.searchParams.delete('doc');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
