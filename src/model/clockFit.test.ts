import { describe, expect, it } from 'vitest';
import type { WaveDoc } from '../types';
import { clampSelection, fitClocks, setNodeMarker } from './waveModel';
import { fitDocumentClocks } from './clockFit';

describe('adaptive clock fitting', () => {
  it('extends clk / clock lanes to the longest non-clock lane', () => {
    const doc: WaveDoc = {
      signal: [
        { name: 'clock', wave: 'p..' },
        { name: 'clk_2', wave: 'n..' },
        { name: 'data', wave: '0.......' },
      ],
    };
    const fitted = fitClocks(doc);
    expect(fitted.signal[0]).toMatchObject({ wave: 'p.......' });
    expect(fitted.signal[1]).toMatchObject({ wave: 'n.......' });
    expect(doc.signal[0]).toMatchObject({ wave: 'p..' });
  });

  it('shrinks clocks when the longest signal gets shorter', () => {
    const doc: WaveDoc = {
      signal: [
        { name: 'clk', wave: 'p..Pp..Pp.' },
        { name: 'data', wave: '0...' },
      ],
    };
    expect(fitClocks(doc).signal[0]).toMatchObject({ wave: 'p..P' });
  });

  it('patches only clock wave literals and preserves JSON5 comments', () => {
    const source = `{
  // clock declaration
  signal: [
    { name: 'clk', wave: 'p..' }, // keep
    { name: 'data', wave: '0.......' },
  ],
}`;
    const parsed = JSON.parse('{"signal":[{"name":"clk","wave":"p.."},{"name":"data","wave":"0......."}]}') as WaveDoc;
    const fitted = fitDocumentClocks(parsed, source);
    expect(fitted.changed).toBe(true);
    expect(fitted.source).toContain("wave: 'p.......' }, // keep");
    expect(fitted.source).toContain('// clock declaration');
    expect(fitted.source).toContain("wave: '0.......'");
    expect(fitted.data.signal[0]).toMatchObject({ wave: 'p.......' });
  });

  it('leaves a document unchanged when no clocks exist', () => {
    const doc: WaveDoc = { signal: [{ name: 'data', wave: '0...' }] };
    const fitted = fitDocumentClocks(doc, '{"signal":[{"name":"data","wave":"0..."}]}');
    expect(fitted.changed).toBe(false);
    expect(fitted.data).toBe(doc);
  });
});

describe('blank cycle runway and node markers', () => {
  it('allows long drag selections beyond the current wave', () => {
    const doc: WaveDoc = { signal: [{ name: 'a', wave: '0.1.' }] };
    const selection = clampSelection({ row0: 0, col0: 0, row1: 0, col1: 800 }, doc);
    expect(selection.col1).toBe(800);
  });

  it('sets and clears a node marker at an arbitrary cycle', () => {
    const doc: WaveDoc = { signal: [{ name: 'a', wave: '0...', node: 'a...' }] };
    const set = setNodeMarker(doc, 0, 2, 'b');
    expect(set.signal[0]).toMatchObject({ node: 'a.b.' });
    const cleared = setNodeMarker(set, 0, 2, '.');
    expect(cleared.signal[0]).toMatchObject({ node: 'a...' });
  });
});
