import JSON5 from 'json5';
import type {
  CellSelection,
  GroupInfo,
  ParseError,
  SignalGroup,
  SignalItem,
  WaveDoc,
  WaveLane,
  WaveLaneFlat,
} from '../types';

const WAVE_CHARS = '01xz=udpPnNlLhH23456789|.<>';

export const WAVE_CHAR_LIST = WAVE_CHARS.split('');

export function isWaveChar(value: string): boolean {
  return value.length === 1 && WAVE_CHARS.includes(value);
}

export function isGroup(item: unknown): item is SignalGroup {
  return Array.isArray(item);
}

export function isSpacer(lane: WaveLane): boolean {
  return Object.keys(lane).length === 0;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function emptySelection(): CellSelection {
  return { row0: 0, col0: 0, row1: 0, col1: 0 };
}

export function normalizeSelection(sel: CellSelection): CellSelection {
  return {
    row0: Math.min(sel.row0, sel.row1),
    col0: Math.min(sel.col0, sel.col1),
    row1: Math.max(sel.row0, sel.row1),
    col1: Math.max(sel.col0, sel.col1),
  };
}

export function waveWidth(lane: WaveLane | undefined): number {
  return typeof lane?.wave === 'string' ? lane.wave.length : 0;
}

export function maxWaveWidth(doc: WaveDoc): number {
  let max = 0;
  for (const lane of flattenLanes(doc)) max = Math.max(max, waveWidth(lane.item));
  return max;
}

/** Number of cycles used for new signals, matching the longest clock when possible. */
export function clockLength(doc: WaveDoc): number {
  let clk = 0;
  let all = 0;
  for (const flat of flattenLanes(doc)) {
    const len = waveWidth(flat.item);
    all = Math.max(all, len);
    if (typeof flat.item.name === 'string' && /clk|clock/i.test(flat.item.name)) {
      clk = Math.max(clk, len);
    }
  }
  return Math.max(1, clk || all || 16);
}

export function uniqueLaneName(doc: WaveDoc, base = 'signal'): string {
  const names = new Set(flattenLanes(doc).map((lane) => lane.item.name).filter(Boolean));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

/** A new lane matches the clock length, with a driven low first cycle. */
export function makeLane(doc: WaveDoc, name?: string): WaveLane {
  const len = clockLength(doc);
  return {
    name: name || uniqueLaneName(doc),
    wave: `0${'.'.repeat(Math.max(0, len - 1))}`,
  };
}

export function flattenLanes(doc: WaveDoc): WaveLaneFlat[] {
  const out: WaveLaneFlat[] = [];
  let row = 0;

  const walk = (items: unknown[], parentPath: number[], depth: number, ancestors: GroupInfo[], offset: number) => {
    if (!Array.isArray(items)) return;
    for (let index = offset; index < items.length; index += 1) {
      const item = items[index];
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) {
        const path = [...parentPath, index];
        const group: GroupInfo = {
          name: typeof item[0] === 'string' ? item[0] : '',
          path,
          parentPath,
          depth,
          start: row,
          end: row - 1,
        };
        walk(item, path, depth + 1, [...ancestors, group], 1);
        group.end = row - 1;
        continue;
      }
      const lane = item as WaveLane;
      const path = [...parentPath, index];
      out.push({
        item: lane,
        row,
        path,
        parentPath: path.slice(0, -1),
        index,
        depth,
        groups: ancestors,
        isSpacer: isSpacer(lane),
      });
      row += 1;
    }
  };

  walk(doc.signal, [], 0, [], 0);
  return out;
}

export function itemLeafCount(item: SignalItem): number {
  if (!isGroup(item)) return 1;
  return item.slice(1).reduce((sum, child) => sum + (child && typeof child === 'object' ? itemLeafCount(child as SignalItem) : 0), 0);
}

export function listGroups(doc: WaveDoc): GroupInfo[] {
  const groups: GroupInfo[] = [];
  let row = 0;
  const walk = (items: unknown[], parentPath: number[], depth: number, offset: number) => {
    for (let index = offset; index < items.length; index += 1) {
      const item = items[index];
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) {
        const path = [...parentPath, index];
        const info: GroupInfo = {
          name: typeof item[0] === 'string' ? item[0] : '',
          path,
          parentPath,
          depth,
          start: row,
          end: row - 1,
        };
        walk(item, path, depth + 1, 1);
        info.end = row - 1;
        groups.push(info);
      } else {
        row += 1;
      }
    }
  };
  walk(doc.signal, [], 0, 0);
  return groups;
}

export function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function getNodeAtPath(doc: WaveDoc, path: number[]): unknown {
  let node: unknown = doc.signal;
  for (const index of path) {
    if (!Array.isArray(node)) return undefined;
    node = node[index];
  }
  return node;
}

export function getArrayAtPath(doc: WaveDoc, path: number[]): SignalItem[] | null {
  const node = getNodeAtPath(doc, path);
  return Array.isArray(node) ? (node as SignalItem[]) : null;
}

export function getLaneAtRow(doc: WaveDoc, row: number): WaveLane | null {
  const flat = flattenLanes(doc)[row];
  return flat ? flat.item : null;
}

export function laneAtRowFlat(doc: WaveDoc, row: number): WaveLaneFlat | null {
  return flattenLanes(doc)[row] || null;
}

export function rowCount(doc: WaveDoc): number {
  return flattenLanes(doc).length;
}

export function dataLabels(lane: WaveLane | null | undefined): string[] {
  if (!lane || lane.data == null) return [];
  if (Array.isArray(lane.data)) return lane.data.map((value) => String(value));
  return String(lane.data).trim().split(/\s+/).filter(Boolean);
}

export function isRichText(value: unknown): boolean {
  return Array.isArray(value);
}

export function validateDocument(value: unknown): WaveDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The document must be a WaveJSON object.');
  }
  const doc = value as WaveDoc;
  if (!('signal' in doc)) {
    throw new Error('WaveJSON is missing the required "signal" array. This editor supports signal diagrams.');
  }
  if (!Array.isArray(doc.signal)) {
    throw new Error('The "signal" property must be an array.');
  }
  let laneTotal = 0;
  const visit = (items: unknown[], path: string) => {
    items.forEach((item, index) => {
      const where = `${path}[${index}]`;
      if (Array.isArray(item)) {
        if (item.length === 0 || typeof item[0] !== 'string') {
          throw new Error(`Signal group ${where} must start with a group name.`);
        }
        visit(item.slice(1), where);
        return;
      }
      if (!item || typeof item !== 'object') {
        throw new Error(`Signal ${where} must be an object or a named group.`);
      }
      const lane = item as WaveLane;
      if (lane.wave != null && typeof lane.wave !== 'string') {
        throw new Error(`Signal ${where}.wave must be a string.`);
      }
      if (lane.node != null && typeof lane.node !== 'string') {
        throw new Error(`Signal ${where}.node must be a string.`);
      }
      if (lane.data != null && typeof lane.data !== 'string' && !Array.isArray(lane.data)) {
        throw new Error(`Signal ${where}.data must be a string or an array.`);
      }
      if (lane.period != null && typeof lane.period !== 'number') {
        throw new Error(`Signal ${where}.period must be a number.`);
      }
      if (lane.phase != null && typeof lane.phase !== 'number') {
        throw new Error(`Signal ${where}.phase must be a number.`);
      }
      laneTotal += 1;
    });
  };
  visit(doc.signal, 'signal');
  if (laneTotal === 0) {
    throw new Error('The diagram needs at least one signal lane.');
  }
  if (doc.config != null && (typeof doc.config !== 'object' || Array.isArray(doc.config))) {
    throw new Error('"config" must be an object.');
  }
  return doc;
}

export function parseSource(source: string): { data?: WaveDoc; error?: ParseError } {
  try {
    const parsed = JSON5.parse(source);
    validateDocument(parsed);
    return { data: parsed as WaveDoc };
  } catch (error) {
    const err = error as Error & { lineNumber?: number; columnNumber?: number };
    let line = err.lineNumber;
    let column = err.columnNumber;
    if (!line) {
      const match = /(?:line\s+)?(\d+):(\d+)/.exec(err.message);
      if (match) {
        line = Number(match[1]);
        column = Number(match[2]);
      }
    }
    return {
      error: {
        message: err.message || 'Invalid WaveJSON',
        line,
        column,
      },
    };
  }
}

export function prettySource(doc: WaveDoc): string {
  return JSON.stringify(doc, null, 2);
}

function ensureLaneLength(lane: WaveLane, length: number) {
  if (length <= 0) return;
  if (typeof lane.wave !== 'string') lane.wave = '';
  if (lane.wave.length < length) {
    lane.wave += '.'.repeat(length - lane.wave.length);
  }
  if (typeof lane.node === 'string' && lane.node.length < length) {
    lane.node += '.'.repeat(length - lane.node.length);
  }
}

export interface PaintResult {
  doc: WaveDoc;
  changed: number;
  changedRows: number[];
}

/** Paint one WaveDrom character over every selected cell. */
export function paintCells(doc: WaveDoc, selection: CellSelection, char: string): PaintResult {
  if (!isWaveChar(char)) return { doc, changed: 0, changedRows: [] };
  const next = deepClone(doc);
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(next);
  let changed = 0;
  const changedRows: number[] = [];
  for (let row = sel.row0; row <= sel.row1; row += 1) {
    const flat = lanes[row];
    if (!flat || flat.isSpacer) continue;
    const lane = flat.item;
    ensureLaneLength(lane, sel.col1 + 1);
    let rowChanged = false;
    for (let col = sel.col0; col <= sel.col1; col += 1) {
      if (lane.wave![col] !== char) {
        lane.wave = `${lane.wave!.slice(0, col)}${char}${lane.wave!.slice(col + 1)}`;
        changed += 1;
        rowChanged = true;
      }
    }
    if (rowChanged) changedRows.push(row);
  }
  return { doc: next, changed, changedRows };
}

/** Insert a character at a cursor column and push the rest of each selected lane right. */
export function insertCycleChar(doc: WaveDoc, selection: CellSelection, char: string): PaintResult {
  if (!isWaveChar(char)) return { doc, changed: 0, changedRows: [] };
  const next = deepClone(doc);
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(next);
  let changed = 0;
  const changedRows: number[] = [];
  for (let row = sel.row0; row <= sel.row1; row += 1) {
    const flat = lanes[row];
    if (!flat || flat.isSpacer) continue;
    const lane = flat.item;
    ensureLaneLength(lane, sel.col0);
    const wave = lane.wave || '';
    lane.wave = `${wave.slice(0, sel.col0)}${char}${wave.slice(sel.col0)}`;
    if (typeof lane.node === 'string') {
      const node = lane.node.padEnd(sel.col0, '.');
      lane.node = `${node.slice(0, sel.col0)}${'.'}${node.slice(sel.col0)}`;
    }
    changed += 1;
    changedRows.push(row);
  }
  return { doc: next, changed, changedRows };
}

export function clearCells(doc: WaveDoc, selection: CellSelection): PaintResult {
  const next = deepClone(doc);
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(next);
  let changed = 0;
  const changedRows: number[] = [];
  for (let row = sel.row0; row <= sel.row1; row += 1) {
    const flat = lanes[row];
    if (!flat || flat.isSpacer) continue;
    const lane = flat.item;
    ensureLaneLength(lane, sel.col1 + 1);
    let rowChanged = false;
    for (let col = sel.col0; col <= sel.col1; col += 1) {
      if (lane.wave![col] !== '.') {
        lane.wave = `${lane.wave!.slice(0, col)}.${lane.wave!.slice(col + 1)}`;
        changed += 1;
        rowChanged = true;
      }
    }
    if (rowChanged) changedRows.push(row);
  }
  return { doc: next, changed, changedRows };
}

export function deleteSelectedCells(doc: WaveDoc, selection: CellSelection): PaintResult {
  const next = deepClone(doc);
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(next);
  let changed = 0;
  const changedRows: number[] = [];
  for (let row = sel.row0; row <= sel.row1; row += 1) {
    const flat = lanes[row];
    if (!flat || flat.isSpacer) continue;
    const lane = flat.item;
    let rowChanged = false;
    if (typeof lane.wave === 'string' && lane.wave.length > 0) {
      const start = Math.min(sel.col0, lane.wave.length);
      const end = Math.min(sel.col1 + 1, lane.wave.length);
      if (end > start) {
        lane.wave = lane.wave.slice(0, start) + lane.wave.slice(end);
        if (!lane.wave) lane.wave = '.';
        changed += end - start;
        rowChanged = true;
      }
    }
    if (typeof lane.node === 'string' && lane.node.length > 0) {
      const start = Math.min(sel.col0, lane.node.length);
      const end = Math.min(sel.col1 + 1, lane.node.length);
      lane.node = lane.node.slice(0, start) + lane.node.slice(end);
    }
    if (rowChanged) changedRows.push(row);
  }
  return { doc: next, changed, changedRows };
}

export function insertCycles(doc: WaveDoc, rows: number[], column: number, count = 1): WaveDoc {
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  const targets = [...new Set(rows)].filter((row) => lanes[row]).sort((a, b) => a - b);
  const pad = '.'.repeat(Math.max(1, count));
  const at = Math.max(0, column);
  for (const row of targets) {
    const lane = lanes[row].item;
    if (lanes[row].isSpacer) continue;
    ensureLaneLength(lane, at);
    const wave = lane.wave || '';
    lane.wave = `${wave.slice(0, at)}${pad}${wave.slice(at)}`;
    if (typeof lane.node === 'string') {
      const node = lane.node.padEnd(at, '.');
      lane.node = `${node.slice(0, at)}${'.'.repeat(pad.length)}${node.slice(at)}`;
    }
  }
  return next;
}

export function setLaneDataLabel(doc: WaveDoc, row: number, index: number, value: string): WaveDoc {
  const next = deepClone(doc);
  const lane = getLaneAtRow(next, row);
  if (!lane) return doc;
  const labels = dataLabels(lane);
  while (labels.length <= index) labels.push('');
  labels[index] = value;
  lane.data = labels;
  return next;
}

export function setNodeMarker(doc: WaveDoc, row: number, column: number, marker: string): WaveDoc {
  const next = deepClone(doc);
  const flat = flattenLanes(next)[row];
  if (!flat || flat.isSpacer) return doc;
  const lane = flat.item;
  const character = marker.slice(0, 1) || '.';
  const existing = typeof lane.node === 'string' ? lane.node : '';
  const current = existing[column] || '.';
  if (current === character) return doc;
  if (character !== '.' && column >= existing.length) {
    // Pad with dots so the node marker lands on the requested cycle.
    lane.node = existing.padEnd(column, '.') + character;
  } else {
    const prefix = existing.slice(0, column).padEnd(column, '.');
    lane.node = `${prefix}${character}${existing.slice(column + 1)}`;
  }
  return next;
}

export function updateLane(doc: WaveDoc, row: number, patch: Partial<WaveLane>): WaveDoc {
  const next = deepClone(doc);
  const lane = getLaneAtRow(next, row);
  if (!lane) return doc;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') {
      delete lane[key];
    } else {
      lane[key] = value;
    }
  }
  return next;
}

export function insertLane(doc: WaveDoc, row: number, lane: WaveLane): WaveDoc {
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  if (lanes.length === 0) {
    next.signal.push(lane);
    return next;
  }
  if (row >= lanes.length) {
    const last = lanes[lanes.length - 1];
    const array = getArrayAtPath(next, last.parentPath);
    if (!array) return next;
    array.splice(last.index + 1, 0, lane);
    return next;
  }
  const target = lanes[Math.max(0, row)];
  const array = getArrayAtPath(next, target.parentPath);
  if (!array) return next;
  array.splice(target.index, 0, lane);
  return next;
}

export function appendLane(doc: WaveDoc, lane: WaveLane): WaveDoc {
  const next = deepClone(doc);
  next.signal.push(lane);
  return next;
}

export function deleteLanes(doc: WaveDoc, rows: number[]): WaveDoc {
  const next = deepClone(doc);
  const selected = new Set(rows);
  const lanes = flattenLanes(next).filter((lane) => selected.has(lane.row));
  removeLanePaths(next, lanes.map((lane) => lane.path));
  pruneEmptyGroups(next);
  return next;
}

function removeLanePaths(doc: WaveDoc, paths: number[][]) {
  const sorted = [...paths].sort(comparePathsDesc);
  for (const path of sorted) {
    const parent = getArrayAtPath(doc, path.slice(0, -1));
    if (!parent) continue;
    const index = path[path.length - 1];
    if (index >= 0 && index < parent.length) parent.splice(index, 1);
  }
}

function comparePathsDesc(a: number[], b: number[]): number {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return bv - av;
  }
  return 0;
}

export function pruneEmptyGroups(doc: WaveDoc): WaveDoc {
  const pruneGroupChildren = (group: unknown[]) => {
    for (let i = group.length - 1; i >= 1; i -= 1) {
      const child = group[i];
      if (!child || typeof child !== 'object') {
        group.splice(i, 1);
        continue;
      }
      if (isGroup(child)) {
        pruneGroupChildren(child);
        if (itemLeafCount(child) === 0) group.splice(i, 1);
      }
    }
  };
  for (let i = doc.signal.length - 1; i >= 0; i -= 1) {
    const item = doc.signal[i];
    if (!item || typeof item !== 'object') {
      doc.signal.splice(i, 1);
      continue;
    }
    if (isGroup(item)) {
      pruneGroupChildren(item);
      if (itemLeafCount(item) === 0) doc.signal.splice(i, 1);
    }
  }
  return doc;
}

export interface SelectedUnit {
  item: SignalItem;
  path: number[];
  parentPath: number[];
  index: number;
  startRow: number;
  endRow: number;
  isGroup: boolean;
  depth: number;
}

/** Select the topmost complete groups, or individual lanes, covered by rows. */
export function extractUnits(doc: WaveDoc, rows: number[]): SelectedUnit[] {
  const selected = new Set(rows);
  const units: SelectedUnit[] = [];
  let row = 0;

  const walk = (items: unknown[], parentPath: number[], depth: number, offset: number) => {
    for (let index = offset; index < items.length; index += 1) {
      const item = items[index];
      if (!item || typeof item !== 'object') continue;
      const start = row;
      if (Array.isArray(item)) {
        const leaves = itemLeafCount(item as SignalItem);
        const leavesSelected = Array.from({ length: leaves }, (_, i) => selected.has(start + i));
        if (leaves > 0 && leavesSelected.every(Boolean)) {
          units.push({
            item: item as SignalGroup,
            path: [...parentPath, index],
            parentPath,
            index,
            startRow: start,
            endRow: start + leaves - 1,
            isGroup: true,
            depth,
          });
          row += leaves;
        } else {
          walk(item, [...parentPath, index], depth + 1, 1);
        }
      } else {
        if (selected.has(row)) {
          units.push({
            item: item as WaveLane,
            path: [...parentPath, index],
            parentPath,
            index,
            startRow: start,
            endRow: start,
            isGroup: false,
            depth,
          });
        }
        row += 1;
      }
    }
  };
  walk(doc.signal, [], 0, 0);
  units.sort((a, b) => a.startRow - b.startRow);
  return units;
}

export function copyNodeItems(doc: WaveDoc, rows: number[]): SignalItem[] {
  return extractUnits(doc, rows).map((unit) => deepClone(unit.item));
}

function commonParentPath(paths: number[][]): number[] {
  if (paths.length === 0) return [];
  let prefix = [...paths[0]];
  for (let i = 1; i < paths.length; i += 1) {
    const path = paths[i];
    let j = 0;
    while (j < prefix.length && j < path.length && prefix[j] === path[j]) j += 1;
    prefix = prefix.slice(0, j);
  }
  return prefix;
}

export function groupRows(doc: WaveDoc, rows: number[], name: string): WaveDoc {
  const next = deepClone(doc);
  const units = extractUnits(next, rows);
  if (units.length === 0) return doc;
  const children = units.map((unit) => deepClone(unit.item));
  const parentPaths = units.map((unit) => unit.parentPath);
  let insertPath = commonParentPath(parentPaths);
  const firstUnit = units[0];
  let insertIndex = firstUnit.path.length > insertPath.length ? firstUnit.path[insertPath.length] : 0;
  const unitPaths = units.map((unit) => unit.path);
  removeLanePaths(next, unitPaths);
  pruneEmptyGroups(next);
  // Use the closest surviving ancestor of the common parent.
  while (!getArrayAtPath(next, insertPath)) {
    if (insertPath.length === 0) {
      insertPath = [];
      break;
    }
    insertPath = insertPath.slice(0, -1);
  }
  const target = getArrayAtPath(next, insertPath) || next.signal;
  if (insertIndex > target.length) insertIndex = target.length;
  target.splice(insertIndex, 0, [name || 'group', ...children] as SignalGroup);
  return next;
}

/** Dissolve every fully-selected topmost group, leaving nested groups intact. */
export function ungroupRows(doc: WaveDoc, rows: number[]): WaveDoc {
  const next = deepClone(doc);
  const selected = new Set(rows);
  const groups = listGroups(next);
  const fullySelected = groups.filter(
    (group) => group.end >= group.start && Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i).every((r) => selected.has(r)),
  );
  const fullPaths = new Set(fullySelected.map((group) => group.path.join('.')));
  const topmost = fullySelected.filter(
    (group) => !groups.some((other) => other.depth < group.depth && fullPaths.has(other.path.join('.')) && isAncestor(other.path, group.path)),
  );
  const sorted = topmost.sort((a, b) => comparePathsDesc(a.path, b.path));
  for (const group of sorted) {
    const parent = getArrayAtPath(next, group.path.slice(0, -1));
    if (!parent) continue;
    const index = group.path[group.path.length - 1];
    const item = parent[index];
    if (!Array.isArray(item)) continue;
    parent.splice(index, 1, ...(item.slice(1) as SignalItem[]));
  }
  pruneEmptyGroups(next);
  return next;
}

export function isAncestor(path: number[], descendant: number[]): boolean {
  return path.length < descendant.length && path.every((value, i) => value === descendant[i]);
}

export function moveRows(doc: WaveDoc, rows: number[], direction: -1 | 1): { doc: WaveDoc; changed: boolean; message?: string; rowShift?: number } {
  const next = deepClone(doc);
  const units = extractUnits(next, rows);
  if (units.length === 0) return { doc, changed: false, message: 'Select one or more signal rows first.' };
  const parentPath = units[0].parentPath;
  if (!units.every((unit) => samePath(unit.parentPath, parentPath))) {
    return { doc, changed: false, message: 'Move works within one group at a time.' };
  }
  const array = getArrayAtPath(next, parentPath);
  if (!array) return { doc, changed: false };
  const indexes = units.map((unit) => unit.index).sort((a, b) => a - b);
  const contiguous = indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1);
  if (!contiguous) return { doc, changed: false, message: 'Selected rows must be adjacent to move as a block.' };
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  if (direction < 0 && first === 0) return { doc, changed: false, message: 'Already at the top of this group.' };
  if (direction > 0 && last >= array.length - 1) return { doc, changed: false, message: 'Already at the bottom of this group.' };
  const neighbour = array[direction < 0 ? first - 1 : last + 1] as SignalItem;
  const rowShift = direction * itemLeafCount(neighbour);
  const block = array.splice(first, last - first + 1);
  array.splice(first + direction, 0, ...block);
  return { doc: next, changed: true, rowShift };
}

export function duplicateRows(doc: WaveDoc, rows: number[]): WaveDoc {
  const next = deepClone(doc);
  const units = extractUnits(next, rows);
  const sorted = [...units].sort((a, b) => comparePathsDesc(b.path, a.path));
  for (const unit of sorted) {
    const parent = getArrayAtPath(next, unit.parentPath);
    if (!parent) continue;
    if (unit.index < 0 || unit.index >= parent.length) continue;
    parent.splice(unit.index + 1, 0, deepClone(unit.item));
  }
  return next;
}

/** Insert externally copied signal items after a visible row. */
export function insertItemsAfterRow(doc: WaveDoc, row: number, items: SignalItem[]): WaveDoc {
  if (items.length === 0) return doc;
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  if (lanes.length === 0) {
    next.signal.push(...items.map((item) => deepClone(item)));
    return next;
  }
  const target = lanes[Math.max(0, Math.min(row, lanes.length - 1))];
  const array = getArrayAtPath(next, target.parentPath);
  if (!array) return doc;
  array.splice(target.index + 1, 0, ...items.map((item) => deepClone(item)));
  return next;
}

/**
 * Paste signal blocks after the units covered by `rows`. When a whole group is
 * selected, the pasted copy stays a sibling of that group instead of being
 * nested inside the last lane it contains.
 */
export function insertItemsAfterSelectionRows(doc: WaveDoc, rows: number[], items: SignalItem[]): WaveDoc {
  if (items.length === 0) return doc;
  const next = deepClone(doc);
  const units = extractUnits(next, rows);
  let parent: SignalItem[] = next.signal;
  let insertIndex = parent.length;
  if (units.length > 0) {
    const anchor = units[units.length - 1];
    const targetParent = getArrayAtPath(next, anchor.parentPath);
    if (targetParent) {
      parent = targetParent;
      insertIndex = Math.min(anchor.index + 1, parent.length);
    }
  }
  parent.splice(insertIndex, 0, ...items.map((item) => deepClone(item)));
  return next;
}

export function insertItemsAboveRow(doc: WaveDoc, row: number, items: SignalItem[]): WaveDoc {
  if (items.length === 0) return doc;
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  if (lanes.length === 0) {
    next.signal.push(...items.map((item) => deepClone(item)));
    return next;
  }
  const target = lanes[Math.max(0, Math.min(row, lanes.length - 1))];
  const array = getArrayAtPath(next, target.parentPath);
  if (!array) return doc;
  array.splice(target.index, 0, ...items.map((item) => deepClone(item)));
  return next;
}

/** Drag a single lane before or after another visible lane, possibly into a group. */
export function reorderLane(doc: WaveDoc, sourceRow: number, targetRow: number, after: boolean): WaveDoc {
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  const source = lanes[sourceRow];
  const target = lanes[targetRow];
  if (!source || !target || sourceRow === targetRow) return doc;
  const sourceParent = getArrayAtPath(next, source.parentPath);
  const targetParent = getArrayAtPath(next, target.parentPath);
  if (!sourceParent || !targetParent) return doc;
  let targetIndex = target.index + (after ? 1 : 0);
  const sourceIndex = source.index;
  const [moved] = sourceParent.splice(sourceIndex, 1);
  if (sourceParent === targetParent && sourceIndex < targetIndex) targetIndex -= 1;
  targetIndex = Math.max(0, Math.min(targetIndex, targetParent.length));
  targetParent.splice(targetIndex, 0, moved);
  pruneEmptyGroups(next);
  return next;
}

export function addEmptyRow(doc: WaveDoc, afterRow?: number): WaveDoc {
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  if (lanes.length === 0) {
    next.signal.push({});
    return next;
  }
  const row = Math.max(0, Math.min(afterRow ?? lanes.length - 1, lanes.length - 1));
  const target = lanes[row];
  const array = getArrayAtPath(next, target.parentPath);
  if (!array) return next;
  array.splice(target.index + 1, 0, {});
  return next;
}

export function extendSelection(selection: CellSelection, rowDelta: number, colDelta: number, document: WaveDoc): CellSelection {
  const rows = Math.max(1, rowCount(document));
  const cols = Math.max(1, maxWaveWidth(document) + 16);
  return {
    ...selection,
    row1: Math.max(0, Math.min(rows - 1, selection.row1 + rowDelta)),
    col1: Math.max(0, Math.min(cols - 1, selection.col1 + colDelta)),
  };
}

export function clampSelection(selection: CellSelection, doc: WaveDoc): CellSelection {
  const rows = Math.max(1, rowCount(doc));
  // Keep a generous runway of empty cycles to the right of the waveform. The
  // canvas grows while dragging, so a fixed small overhang made long selections
  // stop after a few blank cells.
  const cols = Math.max(1, maxWaveWidth(doc) + 2048);
  return {
    row0: Math.max(0, Math.min(rows - 1, selection.row0)),
    row1: Math.max(0, Math.min(rows - 1, selection.row1)),
    col0: Math.max(0, Math.min(cols - 1, selection.col0)),
    col1: Math.max(0, Math.min(cols - 1, selection.col1)),
  };
}

export function selectionRows(selection: CellSelection): number[] {
  const sel = normalizeSelection(selection);
  return Array.from({ length: sel.row1 - sel.row0 + 1 }, (_, i) => sel.row0 + i);
}

export function activeCellFromSelection(selection: CellSelection): { row: number; col: number } {
  return { row: selection.row1, col: selection.col1 };
}

export function cellBlock(doc: WaveDoc, selection: CellSelection): string[] {
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(doc);
  const rows: string[] = [];
  for (let row = sel.row0; row <= sel.row1; row += 1) {
    const lane = lanes[row];
    if (!lane || lane.isSpacer) {
      rows.push('.'.repeat(sel.col1 - sel.col0 + 1));
      continue;
    }
    const wave = lane.item.wave || '';
    let out = '';
    for (let col = sel.col0; col <= sel.col1; col += 1) out += wave[col] || '.';
    rows.push(out);
  }
  return rows;
}

export function pasteCellBlock(doc: WaveDoc, selection: CellSelection, rows: string[]): PaintResult {
  const next = deepClone(doc);
  const sel = normalizeSelection(selection);
  const lanes = flattenLanes(next);
  let changed = 0;
  const changedRows: number[] = [];
  rows.forEach((text, rowOffset) => {
    const row = sel.row0 + rowOffset;
    const flat = lanes[row];
    if (!flat || flat.isSpacer) return;
    const lane = flat.item;
    ensureLaneLength(lane, sel.col0 + text.length);
    let rowChanged = false;
    for (let i = 0; i < text.length; i += 1) {
      const col = sel.col0 + i;
      if (isWaveChar(text[i]) && lane.wave![col] !== text[i]) {
        lane.wave = `${lane.wave!.slice(0, col)}${text[i]}${lane.wave!.slice(col + 1)}`;
        changed += 1;
        rowChanged = true;
      }
    }
    if (rowChanged) changedRows.push(row);
  });
  return { doc: next, changed, changedRows };
}

function inferRepeat(text: string): string {
  for (let period = 2; period <= Math.min(8, text.length); period += 1) {
    let matches = true;
    for (let i = period; i < text.length; i += 1) {
      if (text[i] !== text[i % period]) {
        matches = false;
        break;
      }
    }
    if (matches) return text.slice(0, period);
  }
  return text;
}

/** Extend/shrink clock-named lanes to the longest lane. */
export function fitClocks(doc: WaveDoc): WaveDoc {
  const next = deepClone(doc);
  const lanes = flattenLanes(next);
  const isClock = (flat: WaveLaneFlat) => /clk|clock/i.test(flat.item.name || '');
  const nonClockTarget = lanes.reduce(
    (max, flat) => (isClock(flat) ? max : Math.max(max, waveWidth(flat.item))),
    0,
  );
  const target = nonClockTarget > 0
    ? nonClockTarget
    : lanes.reduce((max, flat) => Math.max(max, waveWidth(flat.item)), 0);
  if (target === 0) return next;
  for (const flat of lanes) {
    const lane = flat.item;
    if (!isClock(flat) || typeof lane.wave !== 'string' || !lane.wave) continue;
    const current = lane.wave;
    if (current.length >= target) {
      lane.wave = current.slice(0, target);
    } else {
      let extension = '';
      if (/^[pPnNhHlL.]+$/.test(current)) {
        extension = '.'.repeat(target - current.length);
      } else {
        const pattern = inferRepeat(current);
        while (current.length + extension.length < target) extension += pattern;
        extension = extension.slice(0, target - current.length);
      }
      lane.wave = current + extension;
    }
    if (typeof lane.node === 'string') {
      lane.node = lane.node.padEnd(target, '.').slice(0, target);
    }
  }
  return next;
}


