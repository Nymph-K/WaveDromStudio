import { describe, expect, it } from 'vitest';
import type { WaveDoc } from '../types';
import {
  addEmptyRow,
  copyNodeItems,
  deleteLanes,
  deleteSelectedCells,
  duplicateRows,
  extractUnits,
  flattenLanes,
  groupRows,
  insertCycles,
  insertItemsAfterRow,
  insertItemsAfterSelectionRows,
  insertLane,
  listGroups,
  makeLane,
  moveRows,
  paintCells,
  parseSource,
  prettySource,
  reorderLane,
  ungroupRows,
  updateLane,
  validateDocument,
} from './waveModel';
import { buildWaveHighlights, locateWaveTokens } from './sourceLocator';

const groupDoc = (): WaveDoc => ({
  signal: [
    { name: 'clk', wave: 'p..P' },
    ['Master', { name: 'write', wave: '01..' }, { name: 'read', wave: '0.1.' }],
    {},
    ['Slave', ['ctrl', { name: 'ack', wave: 'x01x' }], { name: 'data', wave: 'x.4x' }],
  ],
  config: { hscale: 1, skin: 'default' },
});

describe('flattenLanes', () => {
  it('preserves real group array paths', () => {
    const doc = groupDoc();
    const flat = flattenLanes(doc);
    expect(flat.map((lane) => lane.item.name || 'empty')).toEqual(['clk', 'write', 'read', 'empty', 'ack', 'data']);
    expect(flat[1].path).toEqual([1, 1]);
    expect(flat[2].path).toEqual([1, 2]);
    expect(flat[4].path).toEqual([3, 1, 1]);
    expect(flat[5].path).toEqual([3, 2]);
    expect(flat[1].groups.map((group) => group.name)).toEqual(['Master']);
    expect(flat[4].groups.map((group) => group.name)).toEqual(['Slave', 'ctrl']);
  });

  it('reports group spans in WaveDrom render order', () => {
    const groups = listGroups(groupDoc());
    expect(groups.map((group) => [group.path, group.start, group.end, group.name])).toEqual([
      [[1], 1, 2, 'Master'],
      [[3, 1], 4, 4, 'ctrl'],
      [[3], 4, 5, 'Slave'],
    ]);
  });
});

describe('editing inside groups remains valid', () => {
  it('inserts a lane into a group at the right array index', () => {
    const doc = groupDoc();
    const out = insertLane(doc, 3, makeLane(doc, 'extra'));
    expect((out.signal[1] as unknown[])[0]).toBe('Master');
    expect(out.signal[2]).toMatchObject({ name: 'extra' });
    expect(out.signal[3]).toEqual({});
    const slave = out.signal[4] as unknown[];
    expect(slave[0]).toBe('Slave');
    const ctrl = slave[1] as unknown[];
    expect(ctrl[0]).toBe('ctrl');
    expect(() => validateDocument(out)).not.toThrow();
    const flat = flattenLanes(out);
    expect(flat[3].item.name).toBe('extra');
  });

  it('deletes grouped lanes without stripping group names', () => {
    const doc = groupDoc();
    const out = deleteLanes(doc, [1, 4]);
    expect(out.signal[0]).toMatchObject({ name: 'clk' });
    expect((out.signal[1] as unknown[])[0]).toBe('Master');
    expect((out.signal[1] as unknown[]).length).toBe(2);
    expect(out.signal[2]).toEqual({});
    expect((out.signal[3] as unknown[])[0]).toBe('Slave');
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('duplicates grouped lanes in place', () => {
    const doc = groupDoc();
    const out = duplicateRows(doc, [1]);
    const group = out.signal[1] as unknown[];
    expect(group[0]).toBe('Master');
    expect((group[1] as { name: string }).name).toBe('write');
    expect((group[2] as { name: string }).name).toBe('write');
    expect((group[3] as { name: string }).name).toBe('read');
  });

  it('moves a group lane to the root', () => {
    const doc = groupDoc();
    const out = reorderLane(doc, 1, 0, true);
    expect(out.signal[0]).toMatchObject({ name: 'clk' });
    expect(out.signal[1]).toMatchObject({ name: 'write' });
    expect((out.signal[2] as unknown[])[0]).toBe('Master');
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('moves a lane into a nested group', () => {
    const doc = groupDoc();
    const out = reorderLane(doc, 0, 4, true);
    const slave = out.signal[2] as unknown[];
    const ctrl = slave[1] as unknown[];
    expect(ctrl[0]).toBe('ctrl');
    expect((ctrl[2] as { name: string }).name).toBe('clk');
    expect(() => validateDocument(out)).not.toThrow();
  });
});

describe('grouping and ungrouping', () => {
  it('groups selected lanes inside a group without losing names', () => {
    const doc = groupDoc();
    const out = groupRows(doc, [1], 'Pair');
    const master = out.signal[1] as unknown[];
    expect(master[0]).toBe('Master');
    expect((master[1] as unknown[])[0]).toBe('Pair');
    expect(((master[1] as unknown[])[1] as { name: string }).name).toBe('write');
    expect((master[2] as { name: string }).name).toBe('read');
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('groups whole groups as nested units', () => {
    const doc = groupDoc();
    const out = groupRows(doc, [1, 2], 'Outer');
    const group = out.signal[1] as unknown[];
    expect(group[0]).toBe('Outer');
    expect((group[1] as unknown[])[0]).toBe('Master');
  });

  it('ungroups only the topmost selected group', () => {
    const doc = groupDoc();
    const out = ungroupRows(doc, [4, 5]);
    const ctrl = out.signal[3] as unknown[];
    expect(ctrl[0]).toBe('ctrl');
    expect((ctrl[1] as { name: string }).name).toBe('ack');
    expect(out.signal[4]).toMatchObject({ name: 'data' });
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('extracts whole groups for clipboard copy', () => {
    const doc = groupDoc();
    const items = copyNodeItems(doc, [1, 2]);
    expect(items).toHaveLength(1);
    expect((items[0] as unknown[])[0]).toBe('Master');
  });

  it('pastes groups after a row inside another group', () => {
    const doc = groupDoc();
    const copied = copyNodeItems(doc, [1, 2]);
    const out = insertItemsAfterRow(doc, 4, copied);
    const slave = out.signal[3] as unknown[];
    expect(slave[0]).toBe('Slave');
    const ctrl = slave[1] as unknown[];
    expect(ctrl[0]).toBe('ctrl');
    expect((ctrl[2] as unknown[])[0]).toBe('Master');
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('pastes a copied group as a sibling rather than nesting it', () => {
    const doc = groupDoc();
    const copied = copyNodeItems(doc, [1, 2]);
    const out = insertItemsAfterSelectionRows(doc, [1, 2], copied);
    expect((out.signal[1] as unknown[])[0]).toBe('Master');
    expect((out.signal[2] as unknown[])[0]).toBe('Master');
    expect(out.signal[3]).toEqual({});
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('groups lanes from different parents at the common level', () => {
    const doc = groupDoc();
    const out = groupRows(doc, [0, 1], 'Mixed');
    expect(out.signal[0][0]).toBe('Mixed');
    expect((out.signal[0] as unknown[])[1]).toMatchObject({ name: 'clk' });
    expect(((out.signal[0] as unknown[])[2] as { name: string }).name).toBe('write');
    expect(() => validateDocument(out)).not.toThrow();
  });

  it('moves selected group rows as a block and reports the row shift', () => {
    const doc = groupDoc();
    const moved = moveRows(doc, [1, 2], 1);
    expect(moved.changed).toBe(true);
    expect(moved.rowShift).toBe(1);
    expect((moved.doc.signal[2] as unknown[])[0]).toBe('Master');
    const up = moveRows(groupDoc(), [4, 5], -1);
    expect(up.changed).toBe(true);
    expect(up.rowShift).toBe(-1);
    expect((up.doc.signal[2] as unknown[])[0]).toBe('Slave');
  });

  it('adds an empty row after a grouped lane', () => {
    const out = addEmptyRow(groupDoc(), 1);
    const group = out.signal[1] as unknown[];
    expect(group[0]).toBe('Master');
    expect(group[2]).toEqual({});
  });
});

describe('wave cells', () => {
  it('paints and extends a rectangle', () => {
    const doc = groupDoc();
    const out = paintCells(doc, { row0: 0, row1: 1, col0: 1, col1: 5 }, '1');
    const flat = flattenLanes(out.doc);
    expect(flat[0].item.wave).toBe('p11111');
    expect(flat[1].item.wave).toBe('011111');
    expect(() => validateDocument(out.doc)).not.toThrow();
  });

  it('deletes cycles and inserts them again', () => {
    const doc = groupDoc();
    const deleted = deleteSelectedCells(doc, { row0: 0, row1: 0, col0: 1, col1: 2 });
    expect(flattenLanes(deleted.doc)[0].item.wave).toBe('pP');
    const inserted = insertCycles(deleted.doc, [0], 1, 2);
    expect(flattenLanes(inserted)[0].item.wave).toBe('p..P');
  });
});

describe('JSON5 and locator', () => {
  const source = `{
    // JSON5 is accepted
    signal: [
      {name: 'clk', wave: 'p..P',},
      ['G', {name: 'bus', wave: 'x.4x', data: 'A B'}],
    ],
    config: {hscale: 1},
  }`;

  it('parses relaxed JSON5', () => {
    const parsed = parseSource(source);
    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.signal).toHaveLength(2);
  });

  it('reports errors with line and column', () => {
    const parsed = parseSource('{\n signal: [\n }\n}');
    expect(parsed.error).toBeDefined();
    expect(parsed.error?.line).toBe(3);
    expect(parsed.error?.column).toBe(2);
  });

  it('locates wave tokens in source order and maps selected characters', () => {
    const parsed = parseSource(source);
    expect(parsed.data).toBeDefined();
    const tokens = locateWaveTokens(source);
    expect(tokens.map((token) => token.value)).toEqual(['p..P', 'x.4x']);
    const highlights = buildWaveHighlights(source, parsed.data!, { row0: 0, col0: 1, row1: 1, col1: 2 }, tokens);
    expect(highlights).toHaveLength(2);
    expect(source.slice(highlights[0].from, highlights[0].to)).toBe('..');
    expect(source.slice(highlights[1].from, highlights[1].to)).toBe('.4');
  });

  it('preserves unknown fields through a format round-trip', () => {
    const parsed = parseSource(source);
    parsed.data!.custom = { keep: true };
    parsed.data!.signal[1][0] = 'Renamed';
    const text = prettySource(parsed.data!);
    const again = parseSource(text);
    expect(again.data?.custom).toEqual({ keep: true });
    expect(((again.data as WaveDoc).signal[1] as unknown[])[0]).toBe('Renamed');
  });

  it('validates bad group structures', () => {
    expect(() => validateDocument({ signal: [[{ name: 'broken', wave: '0' }]] })).toThrow();
    expect(() => validateDocument({ signal: 'nope' })).toThrow();
  });
});

describe('empty docs and signal lengths', () => {
  it('creates a new lane matching the clock', () => {
    const doc: WaveDoc = {
      signal: [
        { name: 'clk', wave: 'p.........' },
        { name: 'data', wave: '0' },
      ],
    };
    const lane = makeLane(doc);
    expect(lane.wave).toHaveLength(10);
    expect(typeof lane.name).toBe('string');
  });

  it('keeps unknown lane properties when editing', () => {
    const doc: WaveDoc = { signal: [{ name: 'a', wave: '0', custom: 7 }] };
    const out = updateLane(doc, 0, { name: 'b', period: 2 });
    expect((out.signal[0] as unknown as Record<string, unknown>).custom).toBe(7);
    expect(out.signal[0]).toMatchObject({ name: 'b', wave: '0', period: 2 });
  });

  it('extracts top-most groups only once', () => {
    const units = extractUnits(groupDoc(), [1, 2]);
    expect(units).toHaveLength(1);
    expect(units[0].isGroup).toBe(true);
    expect(units[0].path).toEqual([1]);
  });
});
