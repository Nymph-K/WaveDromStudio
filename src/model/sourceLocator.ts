import type { CellSelection, WaveDoc, WaveLaneFlat } from '../types';
import { flattenLanes } from './waveModel';

export interface WaveSourceToken {
  /** absolute offset of the opening quote */
  start: number;
  /** absolute offset just past the closing quote */
  end: number;
  /** absolute offset of the first character inside the quotes */
  contentStart: number;
  contentEnd: number;
  quote: string;
  value: string;
  /** absolute raw offset for every decoded character */
  charOffsets: number[];
  /** absolute raw offset just after every decoded character */
  charEnds: number[];
}

export interface WaveHighlight {
  from: number;
  to: number;
  row: number;
}

export interface SourceLocation {
  line: number;
  column: number;
}

function skipWhitespaceAndComments(source: string, start: number): number {
  let i = start;
  while (i < source.length) {
    const char = source[i];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i += 1;
      continue;
    }
    if (char === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    break;
  }
  return Math.min(i, source.length);
}

function decodeEscape(source: string, start: number): { value: string; length: number; isLowSurrogate?: boolean } {
  const char = source[start + 1];
  if (char === undefined) return { value: '', length: 1 };
  const simple: Record<string, string> = {
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '0': '\0',
    '\\': '\\',
    '"': '"',
    "'": "'",
    '/': '/',
  };
  if (Object.prototype.hasOwnProperty.call(simple, char)) {
    return { value: simple[char], length: 2 };
  }
  if (char === '\n') return { value: '', length: 2 };
  if (char === '\r') {
    return { value: '', length: source[start + 2] === '\n' ? 3 : 2 };
  }
  if (char === 'x') {
    const hex = source.slice(start + 2, start + 4);
    if (/^[0-9a-fA-F]{2}$/.test(hex)) {
      return { value: String.fromCharCode(parseInt(hex, 16)), length: 4 };
    }
  }
  if (char === 'u') {
    if (source[start + 2] === '{') {
      const close = source.indexOf('}', start + 3);
      if (close > start) {
        const hex = source.slice(start + 3, close);
        if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
          return { value: String.fromCodePoint(parseInt(hex, 16)), length: close - start + 1 };
        }
      }
    } else {
      const hex = source.slice(start + 2, start + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        return { value: String.fromCharCode(parseInt(hex, 16)), length: 6 };
      }
    }
  }
  return { value: char, length: 2 };
}

function readString(
  source: string,
  start: number,
  findWave: boolean,
): { token?: WaveSourceToken; next: number; value?: string } {
  const quote = source[start];
  let i = start + 1;
  let rawEnd = false;
  const chars: string[] = [];
  const offsets: number[] = [];
  const ends: number[] = [];
  while (i < source.length) {
    const char = source[i];
    if (char === quote) {
      rawEnd = true;
      break;
    }
    if (char === '\\') {
      const decoded = decodeEscape(source, i);
      const raw = source.slice(i, i + decoded.length);
      // Preserve escaped newlines as zero-width decoded text.
      if (decoded.value === '' && raw !== '\\0') {
        i += decoded.length;
        continue;
      }
      // A single escape can decode to a surrogate pair; index the first code unit.
      const offset = i;
      for (let c = 0; c < decoded.value.length; c += 1) {
        chars.push(decoded.value[c]);
        offsets.push(offset);
        ends.push(i + decoded.length);
      }
      i += decoded.length;
      continue;
    }
    chars.push(char);
    offsets.push(i);
    ends.push(i + 1);
    i += 1;
  }
  const end = rawEnd ? i + 1 : source.length;
  const value = chars.join('');
  if (!findWave) return { next: end, value };
  return {
    next: end,
    value,
    token: {
      start,
      end,
      contentStart: start + 1,
      contentEnd: rawEnd ? i : source.length,
      quote,
      value,
      charOffsets: offsets,
      charEnds: ends,
    },
  };
}

/** Find all `wave: "..."` string tokens while ignoring comments and other strings. */
export function locateWaveTokens(source: string): WaveSourceToken[] {
  const tokens: WaveSourceToken[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '"' || char === "'") {
      const parsed = readString(source, i, false);
      let cursor = skipWhitespaceAndComments(source, parsed.next);
      if (source[cursor] === ':' && parsed.value === 'wave') {
        cursor = skipWhitespaceAndComments(source, cursor + 1);
        if (source[cursor] === '"' || source[cursor] === "'") {
          const valueString = readString(source, cursor, true);
          if (valueString.token) tokens.push(valueString.token);
          i = valueString.next;
          continue;
        }
      }
      i = parsed.next;
      continue;
    }
    if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipWhitespaceAndComments(source, i);
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_$]/.test(source[j])) j += 1;
      const identifier = source.slice(i, j);
      let cursor = skipWhitespaceAndComments(source, j);
      if (identifier === 'wave' && source[cursor] === ':') {
        cursor = skipWhitespaceAndComments(source, cursor + 1);
        if (source[cursor] === '"' || source[cursor] === "'") {
          const valueString = readString(source, cursor, true);
          if (valueString.token) tokens.push(valueString.token);
          i = valueString.next;
          continue;
        }
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

/**
 * Build editor highlights for the selected rectangle. The token order follows
 * WaveJSON source order, which is also signal traversal order.
 */
export function buildWaveHighlights(
  source: string,
  doc: WaveDoc,
  selection: CellSelection,
  tokens: WaveSourceToken[] = locateWaveTokens(source),
): WaveHighlight[] {
  const lanes = flattenLanes(doc);
  const waveLanes: WaveLaneFlat[] = lanes.filter((lane) => typeof lane.item.wave === 'string');
  if (waveLanes.length === 0 || tokens.length === 0) return [];
  const row0 = Math.min(selection.row0, selection.row1);
  const row1 = Math.max(selection.row0, selection.row1);
  const col0 = Math.min(selection.col0, selection.col1);
  const col1 = Math.max(selection.col0, selection.col1);
  const tokenByRow = new Map<number, WaveSourceToken>();
  let tokenCursor = 0;
  for (const lane of waveLanes) {
    const wave = lane.item.wave || '';
    let candidate = tokens[tokenCursor];
    if (candidate && candidate.value !== wave) {
      for (let look = 1; look <= tokens.length; look += 1) {
        const forward = tokens[(tokenCursor + look) % tokens.length];
        const backward = tokens[(tokenCursor - look + tokens.length) % tokens.length];
        if (forward?.value === wave) {
          candidate = forward;
          break;
        }
        if (backward?.value === wave) {
          candidate = backward;
          break;
        }
      }
    }
    if (candidate && candidate.value === wave) {
      tokenByRow.set(lane.row, candidate);
      tokenCursor = (tokens.indexOf(candidate) + 1) % tokens.length;
    } else {
      tokenCursor += 1;
    }
  }
  const highlights: WaveHighlight[] = [];
  for (let row = row0; row <= row1; row += 1) {
    const lane = lanes[row];
    const token = tokenByRow.get(row);
    if (!lane || !token) continue;
    const length = token.value.length;
    if (length === 0) continue;
    const fromIndex = Math.max(0, Math.min(col0, length - 1));
    const toIndex = Math.min(col1, length - 1);
    if (col0 >= length) continue;
    const from = token.charOffsets[fromIndex];
    const to = token.charEnds[toIndex];
    if (from == null || to == null) continue;
    highlights.push({ from, to, row });
  }
  return highlights;
}

export function offsetToLocation(source: string, offset: number): SourceLocation {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (source[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

/** Validate quote/token mapping in a simple deterministic way (used by unit tests). */
export function tokenText(source: string, token: WaveSourceToken): string {
  return source.slice(token.start, token.end);
}
