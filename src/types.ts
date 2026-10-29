export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

/** A WaveJSON lane. Unknown fields are preserved verbatim. */
export interface WaveLane extends Record<string, any> {
  name?: string;
  wave?: string;
  data?: string | string[];
  node?: string;
  period?: number;
  phase?: number;
}

/** WaveJSON signal groups are arrays: ["Name", ...children]. */
export type SignalGroup = [string, ...SignalItem[]];
export type SignalItem = WaveLane | SignalGroup;

export interface WaveDoc extends Record<string, any> {
  signal: SignalItem[];
}

export interface CellSelection {
  /** anchor row */
  row0: number;
  /** anchor column */
  col0: number;
  /** focus row */
  row1: number;
  /** focus column */
  col1: number;
}

export interface CellPoint {
  row: number;
  col: number;
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  offset?: number;
}

export interface WaveLaneFlat {
  item: WaveLane;
  row: number;
  /** Path to the lane object from the root signal array. */
  path: number[];
  /** Path to the containing array (root = []). */
  parentPath: number[];
  /** Index inside the containing array. */
  index: number;
  depth: number;
  /** Ancestor group descriptors, outer first. */
  groups: GroupInfo[];
  isSpacer: boolean;
}

export interface GroupInfo {
  name: string;
  path: number[];
  parentPath: number[];
  depth: number;
  start: number;
  end: number;
}

export interface WaveSnapshot {
  source: string;
  data: WaveDoc;
  selection: CellSelection;
  rowSelection: number[];
}

export interface HistoryState {
  past: WaveSnapshot[];
  future: WaveSnapshot[];
}

export interface EditorDoc {
  id: string;
  name: string;
  source: string;
  data: WaveDoc;
  /** Last source intentionally saved by the user (or the initial file content). */
  savedSource: string;
  dirty: boolean;
  parseError: ParseError | null;
  pendingParse: boolean;
  selection: CellSelection;
  rowSelection: number[];
  activeCell: CellPoint;
  insertMode: boolean;
  zoom: number;
  scroll: { top: number; left: number };
  history: HistoryState;
  revision: number;
  filePath?: string;
}

export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'zh';
export type ViewMode = 'split-v' | 'split-h' | 'wave' | 'editor';
export type CanvasTool = 'select' | 'clock' | 'signal' | 'bus' | 'unknown' | 'highz' | 'gap' | 'text' | 'clear' | 'node';
export type ModalKind =
  | 'none'
  | 'diagram-settings'
  | 'preferences'
  | 'signal-properties'
  | 'shortcuts'
  | 'help'
  | 'group-name'
  | 'about'
  | 'share'
  | 'welcome'
  | 'close-document'
  | null;

export interface ShortcutAction {
  id: string;
  label: string;
  labelZh?: string;
  category: string;
  defaultKeys: string[];
  global?: boolean;
  description?: string;
}

export interface SignalClipboard {
  format: 'wavedrom-studio/signals';
  version: 1;
  items: SignalItem[];
}

export interface CellClipboard {
  format: 'wavedrom-studio/cells';
  version: 1;
  rows: string[];
  width: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  row: number;
  col: number;
  kind: 'cell' | 'group' | 'name';
}
