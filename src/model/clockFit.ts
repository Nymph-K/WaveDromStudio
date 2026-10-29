import type { WaveDoc } from '../types';
import { fitClocks, flattenLanes, prettySource } from './waveModel';
import { locateWaveTokens } from './sourceLocator';

export interface ClockFitResult {
  data: WaveDoc;
  source: string;
  changed: boolean;
}

/**
 * Fit clock lanes and patch only their `wave` string literals in the original
 * source, preserving formatting, comments and all other fields. If the source
 * token layout cannot be matched safely, fall back to canonical JSON.
 */
export function fitDocumentClocks(doc: WaveDoc, source: string): ClockFitResult {
  const beforeLanes = flattenLanes(doc);
  const fitted = fitClocks(doc);
  const afterLanes = flattenLanes(fitted);
  const beforeWaveLanes = beforeLanes.filter((lane) => typeof lane.item.wave === 'string');
  const tokens = locateWaveTokens(source);

  let changed = false;
  const changes: { from: number; to: number; insert: string }[] = [];
  const sourceMatches =
    tokens.length === beforeWaveLanes.length &&
    tokens.every((token, index) => token.value === (beforeWaveLanes[index].item.wave || ''));

  for (let index = 0; index < beforeWaveLanes.length; index += 1) {
    const before = beforeWaveLanes[index];
    const after = afterLanes[before.row];
    const oldWave = before.item.wave || '';
    const newWave = after?.item.wave || '';
    if (oldWave === newWave) continue;
    changed = true;
    if (!sourceMatches) {
      return { data: fitted, source: prettySource(fitted), changed: true };
    }
    const token = tokens[index];
    changes.push({ from: token.contentStart, to: token.contentEnd, insert: newWave });
  }

  if (!changed) return { data: doc, source, changed: false };
  changes.sort((a, b) => b.from - a.from);
  let patched = source;
  for (const change of changes) {
    patched = `${patched.slice(0, change.from)}${change.insert}${patched.slice(change.to)}`;
  }
  return { data: fitted, source: patched, changed: true };
}
