import { create } from 'zustand';
import type {
  CanvasTool,
  CellSelection,
  EditorDoc,
  Language,
  ModalKind,
  ParseError,
  ThemeMode,
  ViewMode,
  WaveDoc,
  WaveSnapshot,
} from '../types';
import {
  activeCellFromSelection,
  addEmptyRow,
  appendLane,
  clampSelection,
  clearCells,
  clockLength,
  copyNodeItems,
  deepClone,
  deleteLanes,
  deleteSelectedCells,
  duplicateRows,
  extractUnits,
  fitClocks,
  flattenLanes,
  groupRows,
  insertCycleChar,
  insertCycles,
  insertItemsAfterSelectionRows,
  insertLane,
  isWaveChar,
  itemLeafCount,
  makeLane,
  maxWaveWidth,
  moveRows,
  normalizeSelection,
  paintCells,
  parseSource,
  pasteCellBlock,
  prettySource,
  reorderLane,
  rowCount,
  selectionRows,
  setLaneDataLabel,
  setNodeMarker,
  ungroupRows,
  updateLane,
  validateDocument,
} from '../model/waveModel';
import { BLANK_SOURCE, DEFAULT_EXAMPLE, EXAMPLES } from '../examples';
import { DEFAULT_BINDINGS, SHORTCUT_PRESETS, findShortcutConflicts, normalizeKeyEvent } from '../lib/shortcuts';
import { cellPayload, parseClipboardText, readClipboard, signalPayload, writeClipboard } from '../lib/clipboard';
import { newId } from '../lib/ids';
import { clearShareParam, readShareFromUrl } from '../lib/share';
import { fitDocumentClocks } from '../model/clockFit';
import { localizeDefaultDocName, translate } from '../i18n';

const PERSIST_KEY = 'wavedrom-studio.v1';
const MAX_HISTORY = 100;
const PARSE_DEBOUNCE = 170;
const HISTORY_BURST = 750;
export const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface AppPreferences {
  autoAdvance: boolean;
  autoFitClocks: boolean;
  confirmClose: boolean;
  showRuler: boolean;
  showGrid: boolean;
  reducedMotion: boolean;
}

export interface ModalState {
  kind: ModalKind;
  payload?: Record<string, unknown>;
}

export interface DiagramSettingsInput {
  skin: string;
  hscale: number;
  headText: string;
  footText: string;
  headTick: string;
  headTock: string;
  headEvery: string;
  footTick: string;
  footTock: string;
  footEvery: string;
}

export interface SignalPropertiesInput {
  name: string;
  wave: string;
  node: string;
  data: string[];
  period: string;
  phase: string;
}

export interface AppState {
  docs: EditorDoc[];
  activeId: string;
  theme: ThemeMode;
  language: Language;
  viewMode: ViewMode;
  splitRatio: number;
  shortcuts: Record<string, string[]>;
  preferences: AppPreferences;
  modal: ModalState | null;
  toasts: Toast[];
  bootedFromShare: boolean;
  hydrated: boolean;
}

export interface AppActions {
  newDocument: (name?: string, source?: string) => string;
  openSourceDocument: (name: string, source: string) => { ok: boolean; id?: string; error?: string };
  closeDocument: (id?: string) => void;
  requestCloseDocument: (id?: string) => void;
  markDocumentSaved: (id: string) => void;
  duplicateDocument: (id?: string) => void;
  setActiveDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setViewMode: (mode: ViewMode) => void;
  setSplitRatio: (ratio: number) => void;
  setPreferences: (patch: Partial<AppPreferences>) => void;
  applyClockFitToAll: () => void;
  setShortcuts: (bindings: Record<string, string[]>) => void;
  applyShortcutPreset: (preset: string) => void;
  resetShortcuts: () => void;
  updateSource: (id: string, source: string) => void;
  parsePendingSource: (id: string) => void;
  formatDocument: (id?: string) => boolean;
  undo: (id?: string) => void;
  redo: (id?: string) => void;
  setSelection: (id: string, selection: CellSelection, rowSelection?: number[]) => void;
  selectRow: (id: string, row: number, mode: 'replace' | 'toggle' | 'range') => void;
  navigateSelection: (id: string, dRow: number, dCol: number, extend: boolean) => void;
  jumpSelection: (id: string, edge: 'start' | 'end') => void;
  selectAllCells: (id?: string) => void;
  setZoom: (id: string, zoom: number) => void;
  zoomStep: (id: string, direction: -1 | 1) => void;
  resetZoom: (id: string) => void;
  updateScroll: (id: string, scroll: { top: number; left: number }) => void;
  setInsertMode: (id: string, active: boolean) => void;
  toggleInsertMode: (id?: string) => void;
  paintCharacter: (char: string, id?: string) => boolean;
  applyToolAt: (id: string, row: number, col: number, tool: CanvasTool, drag?: boolean) => boolean;
  setNodeAt: (id: string, row: number, col: number, marker: string) => boolean;
  clearSelectedCells: (id?: string) => void;
  deleteSelectedCycles: (id?: string) => void;
  insertCycle: (side: 'before' | 'after', id?: string) => void;
  addSignal: (id?: string) => void;
  insertSignal: (where: 'above' | 'below', id?: string) => void;
  addEmptyRow: (id?: string) => void;
  duplicateSignals: (id?: string) => void;
  deleteSelectedSignals: (id?: string) => void;
  moveSignals: (direction: -1 | 1, id?: string) => void;
  groupSelection: (name: string, rows?: number[], id?: string) => void;
  ungroupSelection: (id?: string) => void;
  fitClocksToLongest: (id?: string) => void;
  renameLane: (id: string, row: number, name: string) => void;
  setLaneDataAt: (id: string, row: number, index: number, value: string) => void;
  applyLaneProperties: (id: string, row: number, input: SignalPropertiesInput) => boolean;
  reorderSignal: (id: string, sourceRow: number, targetRow: number, after: boolean) => void;
  applyDiagramSettings: (id: string, input: DiagramSettingsInput) => boolean;
  copySelection: (id?: string) => Promise<void>;
  cutSelection: (id?: string) => Promise<void>;
  pasteClipboard: (id?: string) => Promise<void>;
  openModal: (kind: Exclude<ModalKind, 'none'>, payload?: Record<string, unknown>) => void;
  closeModal: () => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  markHydrated: () => void;
}

export type AppStore = AppState & AppActions;

const parseTimers = new Map<string, number>();
const historyBurstTimers = new Map<string, number>();
let toastCounter = 0;

function emptyHistory() {
  return { past: [] as WaveSnapshot[], future: [] as WaveSnapshot[] };
}

function makeDoc(
  id: string,
  name: string,
  source: string,
  data: WaveDoc,
  parseError: ParseError | null = null,
  savedSource = source,
): EditorDoc {
  return {
    id,
    name,
    source,
    data,
    savedSource,
    dirty: source !== savedSource,
    parseError,
    pendingParse: false,
    selection: { row0: 0, col0: 0, row1: 0, col1: 0 },
    rowSelection: [],
    activeCell: { row: 0, col: 0 },
    insertMode: false,
    zoom: 1,
    scroll: { top: 0, left: 0 },
    history: emptyHistory(),
    revision: 0,
  };
}

function docFromSource(id: string, name: string, source: string, autoFitClocks = true): EditorDoc | null {
  const parsed = parseSource(source);
  if (!parsed.data) return null;
  const fitted = autoFitClocks ? fitDocumentClocks(parsed.data, source) : { data: parsed.data, source, changed: false };
  const doc = makeDoc(id, name, fitted.source, fitted.data, null, fitted.source);
  doc.selection = { row0: 0, col0: 0, row1: 0, col1: 0 };
  doc.activeCell = activeCellFromSelection(doc.selection);
  return doc;
}

function uniqueName(base: string, docs: EditorDoc[]): string {
  const names = new Set(docs.map((doc) => doc.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function untitledName(docs: EditorDoc[], language: Language = 'en'): string {
  let index = 1;
  const names = new Set(docs.map((doc) => doc.name));
  const makeName = (value: number) => translate(language, 'Untitled {n}', { n: value });
  while (names.has(makeName(index))) index += 1;
  return makeName(index);
}

function initialDocs(autoFitClocks: boolean, language: Language): { docs: EditorDoc[]; activeId: string; bootedFromShare: boolean } {
  let docs: EditorDoc[] = [];
  let activeId = '';
  let bootedFromShare = false;

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const persisted = JSON.parse(raw);
        if (persisted && Array.isArray(persisted.docs)) {
          for (const candidate of persisted.docs) {
            if (!candidate || typeof candidate.source !== 'string') continue;
            let data: WaveDoc | null = null;
            let parseError: ParseError | null = null;
            const parsed = parseSource(candidate.source);
            if (parsed.data) data = parsed.data;
            else {
              parseError = parsed.error || { message: 'Invalid WaveJSON' };
              if (candidate.data) {
                try {
                  data = validateDocument(deepClone(candidate.data));
                } catch {
                  data = null;
                }
              }
            }
            if (!data) continue;
            let restoredSource = candidate.source;
            if (!parseError && autoFitClocks) {
              const fitted = fitDocumentClocks(data, restoredSource);
              data = fitted.data;
              restoredSource = fitted.source;
            }
            const storedSavedSource = typeof candidate.savedSource === 'string' ? candidate.savedSource : restoredSource;
            const restored = makeDoc(
              typeof candidate.id === 'string' ? candidate.id : newId(),
              localizeDefaultDocName(
                typeof candidate.name === 'string' ? candidate.name : translate(language, 'Untitled {n}', { n: 1 }),
                language,
              ),
              restoredSource,
              data,
              parseError,
              storedSavedSource,
            );
            if (candidate.selection && typeof candidate.selection === 'object') {
              restored.selection = clampSelection(candidate.selection as CellSelection, data);
            }
            restored.activeCell = candidate.activeCell && typeof candidate.activeCell === 'object'
              ? {
                  row: Math.max(0, Math.min(rowCount(data) - 1, Number(candidate.activeCell.row) || 0)),
                  col: Math.max(0, Number(candidate.activeCell.col) || 0),
                }
              : activeCellFromSelection(restored.selection);
            if (Array.isArray(candidate.rowSelection)) {
              restored.rowSelection = candidate.rowSelection
                .map(Number)
                .filter((row: number) => row >= 0 && row < rowCount(data));
            }
            restored.zoom = Math.max(0.4, Math.min(3, Number(candidate.zoom) || 1));
            if (candidate.scroll && typeof candidate.scroll === 'object') {
              restored.scroll = { top: Number(candidate.scroll.top) || 0, left: Number(candidate.scroll.left) || 0 };
            }
            if (typeof candidate.filePath === 'string') restored.filePath = candidate.filePath;
            docs.push(restored);
          }
          if (typeof persisted.activeId === 'string' && docs.some((doc) => doc.id === persisted.activeId)) {
            activeId = persisted.activeId;
          }
        }
      }
    } catch {
      docs = [];
    }
  }

  try {
    const shared = readShareFromUrl();
    if (shared) {
      const parsed = parseSource(shared.source);
      if (parsed.data) {
        const fitted = autoFitClocks ? fitDocumentClocks(parsed.data, shared.source) : { data: parsed.data, source: shared.source };
        const sharedDoc = makeDoc(newId('shared'), shared.name || 'Shared diagram', fitted.source, fitted.data);
        sharedDoc.selection = { row0: 0, col0: 0, row1: 0, col1: 0 };
        sharedDoc.activeCell = activeCellFromSelection(sharedDoc.selection);
        docs.push(sharedDoc);
        activeId = sharedDoc.id;
        bootedFromShare = true;
      }
    }
  } catch {
    // Ignore malformed share links.
  }

  if (docs.length === 0) {
    const starter = docFromSource(newId(), translate(language, DEFAULT_EXAMPLE.title), DEFAULT_EXAMPLE.source, autoFitClocks);
    if (starter) docs = [starter];
    else {
      const blank = docFromSource(newId(), translate(language, 'Untitled {n}', { n: 1 }), BLANK_SOURCE, autoFitClocks)!;
      docs = [blank];
    }
    activeId = docs[0].id;
  }
  if (!activeId) activeId = docs[0].id;
  return { docs, activeId, bootedFromShare };
}

function readSavedUi(): {
  theme?: ThemeMode;
  language?: Language;
  viewMode?: ViewMode;
  splitRatio?: number;
  shortcuts?: Record<string, string[]>;
  preferences?: Partial<AppPreferences>;
} {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : undefined,
      language: parsed.language === 'zh' || parsed.language === 'en' ? parsed.language : undefined,
      viewMode: ['split-v', 'split-h', 'wave', 'editor'].includes(parsed.viewMode) ? parsed.viewMode : undefined,
      splitRatio: typeof parsed.splitRatio === 'number' ? parsed.splitRatio : undefined,
      shortcuts: parsed.shortcuts && typeof parsed.shortcuts === 'object' ? parsed.shortcuts : undefined,
      preferences: parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : undefined,
    };
  } catch {
    return {};
  }
}

function defaultTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function defaultLanguage(): Language {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

const savedUi = readSavedUi();
const initialPreferences = {
  autoAdvance: savedUi.preferences?.autoAdvance ?? true,
  autoFitClocks: savedUi.preferences?.autoFitClocks ?? true,
  confirmClose: savedUi.preferences?.confirmClose ?? true,
  showRuler: savedUi.preferences?.showRuler ?? true,
  showGrid: savedUi.preferences?.showGrid ?? true,
  reducedMotion: savedUi.preferences?.reducedMotion ?? false,
};
const initialLanguage = savedUi.language || defaultLanguage();
const initial = initialDocs(initialPreferences.autoFitClocks, initialLanguage);
const initialTheme = savedUi.theme || defaultTheme();

function schedulePersistence(state: AppStore) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      version: 1,
      docs: state.docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        source: doc.source,
        savedSource: doc.savedSource,
        dirty: doc.dirty,
        data: doc.data,
        selection: doc.selection,
        rowSelection: doc.rowSelection,
        activeCell: doc.activeCell,
        zoom: doc.zoom,
        scroll: doc.scroll,
        filePath: doc.filePath,
      })),
      activeId: state.activeId,
      theme: state.theme,
      language: state.language,
      viewMode: state.viewMode,
      splitRatio: state.splitRatio,
      shortcuts: state.shortcuts,
      preferences: state.preferences,
    };
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {
    // Local storage can be unavailable or full; the app continues in memory.
  }
}

let persistTimer: number | null = null;

function schedulePersistSoon() {
  if (typeof window === 'undefined') return;
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    schedulePersistence(useAppStore.getState());
  }, 350);
}

function clearDocTimers(id: string) {
  const parseTimer = parseTimers.get(id);
  if (parseTimer !== undefined) window.clearTimeout(parseTimer);
  parseTimers.delete(id);
  const burstTimer = historyBurstTimers.get(id);
  if (burstTimer !== undefined) window.clearTimeout(burstTimer);
  historyBurstTimers.delete(id);
}

function cloneSelection(selection: CellSelection): CellSelection {
  return { ...selection };
}

function snapshotOf(doc: EditorDoc): WaveSnapshot {
  return {
    source: doc.source,
    data: doc.data,
    selection: cloneSelection(doc.selection),
    rowSelection: [...doc.rowSelection],
  };
}

function updateDoc(docs: EditorDoc[], id: string, updater: (doc: EditorDoc) => EditorDoc): EditorDoc[] {
  return docs.map((doc) => (doc.id === id ? updater(doc) : doc));
}

function pushSnapshot(doc: EditorDoc, snapshot: WaveSnapshot): { history: { past: WaveSnapshot[]; future: WaveSnapshot[] } } {
  return {
    history: {
      past: [...doc.history.past, snapshot].slice(-MAX_HISTORY),
      future: [],
    },
  };
}

function bumpRevision(doc: EditorDoc): number {
  return doc.revision + 1;
}

function filterRowSelection(rows: number[], data: WaveDoc): number[] {
  const count = rowCount(data);
  return [...new Set(rows)].filter((row) => Number.isInteger(row) && row >= 0 && row < count).sort((a, b) => a - b);
}

function selectedSignalRows(doc: EditorDoc): number[] {
  if (doc.rowSelection.length > 0) return [...doc.rowSelection].sort((a, b) => a - b);
  return selectionRows(doc.selection);
}

function parseSettingsValue(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.includes(',')) {
    const values = trimmed.split(',').map((part) => part.trim());
    if (values.every((part) => /^-?\d+(?:\.\d+)?$/.test(part))) return values.map(Number);
    return values;
  }
  return trimmed;
}

function parseRichText(input: string): unknown {
  const trimmed = input.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('Head/foot rich text must be valid JSONML.');
    }
  }
  return trimmed;
}

function setIfValue<T extends Record<string, unknown>>(target: T, key: string, value: unknown) {
  if (value === undefined) delete (target as Record<string, unknown>)[key];
  else (target as Record<string, unknown>)[key] = value;
}

function toCellSelection(row: number, col: number, endRow = row, endCol = col): CellSelection {
  return { row0: row, col0: col, row1: endRow, col1: endCol };
}

function findDoc(state: AppState, id?: string): EditorDoc | undefined {
  return state.docs.find((doc) => doc.id === (id || state.activeId));
}

function ensureParsed(id: string): EditorDoc | null {
  const store = useAppStore.getState();
  let doc = store.docs.find((candidate) => candidate.id === id);
  if (!doc) return null;
  if (doc.pendingParse) {
    store.parsePendingSource(id);
    doc = useAppStore.getState().docs.find((candidate) => candidate.id === id);
  }
  if (!doc || doc.parseError) return null;
  return doc;
}

function applyMutator(
  id: string,
  mutator: (draft: WaveDoc) => WaveDoc,
  options: {
    selection?: CellSelection | ((next: WaveDoc) => CellSelection);
    rowSelection?: number[] | ((next: WaveDoc) => number[]);
    toast?: string;
    tone?: ToastTone;
    clearInsertMode?: boolean;
  } = {},
): boolean {
  const store = useAppStore.getState();
  const prepared = ensureParsed(id);
  if (!prepared) {
    const current = findDoc(store, id);
    if (!current) return false;
    if (current.parseError) {
      store.notify(translate(store.language, 'Fix the JSON error first: {message}', {
        message: current.parseError.message,
      }), 'warning');
    }
    return false;
  }
  clearDocTimers(id);
  const before = parseSource(prepared.source);
  const currentData = before.data || prepared.data;
  const draft = deepClone(currentData);
  let nextData: WaveDoc;
  try {
    nextData = mutator(draft);
    validateDocument(nextData);
    if (store.preferences.autoFitClocks) {
      nextData = fitClocks(nextData);
      validateDocument(nextData);
    }
  } catch (error) {
    store.notify(error instanceof Error ? error.message : String(error), 'error');
    return false;
  }
  const beforeText = JSON.stringify(currentData);
  const afterText = JSON.stringify(nextData);
  if (beforeText === afterText) {
    if (options.toast) store.notify(options.toast, options.tone || 'info');
    return false;
  }
  const snapshot = snapshotOf(prepared);
  const nextSelection = clampSelection(
    typeof options.selection === 'function'
      ? options.selection(nextData)
      : options.selection || prepared.selection,
    nextData,
  );
  const nextRowSelection = filterRowSelection(
    typeof options.rowSelection === 'function'
      ? options.rowSelection(nextData)
      : options.rowSelection || [],
    nextData,
  );
  const canonical = prettySource(nextData);
  useAppStore.setState((state) => ({
    docs: updateDoc(state.docs, id, (doc) => ({
      ...doc,
      data: deepClone(nextData),
      source: canonical,
      dirty: canonical !== doc.savedSource,
      parseError: null,
      pendingParse: false,
      selection: nextSelection,
      rowSelection: nextRowSelection,
      activeCell: activeCellFromSelection(nextSelection),
      revision: bumpRevision(doc),
      history: pushSnapshot(doc, snapshot).history,
      insertMode: options.clearInsertMode ? false : doc.insertMode,
    })),
  }));
  if (options.toast) store.notify(options.toast, options.tone || 'success');
  return true;
}

const historyTimer = (id: string) => {
  const existing = historyBurstTimers.get(id);
  if (existing !== undefined) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    historyBurstTimers.delete(id);
  }, HISTORY_BURST);
  historyBurstTimers.set(id, timer);
};

const parseLater = (id: string) => {
  const existing = parseTimers.get(id);
  if (existing !== undefined) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    parseTimers.delete(id);
    useAppStore.getState().parsePendingSource(id);
  }, PARSE_DEBOUNCE);
  parseTimers.set(id, timer);
};

export const useAppStore = create<AppStore>((set, get) => {
  const store: AppStore = {
    docs: initial.docs,
    activeId: initial.activeId,
    theme: initialTheme,
    language: initialLanguage,
    viewMode: savedUi.viewMode || 'split-v',
    splitRatio: savedUi.splitRatio && savedUi.splitRatio > 0.25 && savedUi.splitRatio < 0.8 ? savedUi.splitRatio : 0.56,
    shortcuts: { ...DEFAULT_BINDINGS, ...(savedUi.shortcuts || {}) },
    preferences: initialPreferences,
    modal: null,
    toasts: [],
    bootedFromShare: initial.bootedFromShare,
    hydrated: true,
    ...({
      // Implemented below.
    } as unknown as AppActions),
  };

  const api: AppActions = {
    newDocument(name, source) {
      const state = get();
      const finalName = name || untitledName(state.docs, state.language);
      const finalSource = source || BLANK_SOURCE;
      const created = docFromSource(newId(), finalName, finalSource, state.preferences.autoFitClocks);
      if (!created) {
        get().notify('The supplied WaveJSON is not valid.', 'error');
        return state.activeId;
      }
      const docs = [...state.docs, created];
      set({ docs, activeId: created.id });
      schedulePersistSoon();
      return created.id;
    },

    openSourceDocument(name, source) {
      const parsed = parseSource(source);
      if (!parsed.data) {
        return { ok: false, error: parsed.error?.message || 'Invalid WaveJSON' };
      }
      const state = get();
      const finalName = uniqueName(name.replace(/\.(json5?|txt)$/i, '') || untitledName(state.docs, state.language), state.docs);
      const created = docFromSource(newId(), finalName, source, state.preferences.autoFitClocks);
      if (!created) return { ok: false, error: 'Invalid WaveJSON' };
      created.filePath = name;
      set({ docs: [...state.docs, created], activeId: created.id });
      get().notify(translate(state.language, 'Opened {name}', { name: finalName }), 'success');
      return { ok: true, id: created.id };
    },

    closeDocument(id) {
      const state = get();
      const targetId = id || state.activeId;
      const index = state.docs.findIndex((doc) => doc.id === targetId);
      if (index < 0) return;
      clearDocTimers(targetId);
      let docs = state.docs.filter((doc) => doc.id !== targetId);
      let activeId = state.activeId;
      if (docs.length === 0) {
        const blank = docFromSource(newId(), untitledName([], state.language), BLANK_SOURCE, state.preferences.autoFitClocks);
        if (blank) docs = [blank];
        activeId = docs[0].id;
      } else if (activeId === targetId) {
        const next = docs[Math.min(index, docs.length - 1)];
        activeId = next.id;
      }
      set({ docs, activeId });
    },

    duplicateDocument(id) {
      const state = get();
      const source = findDoc(state, id);
      if (!source) return;
      const copy = deepClone(source);
      copy.id = newId();
      copy.name = uniqueName(`${source.name} copy`, state.docs);
      copy.history = emptyHistory();
      copy.pendingParse = false;
      copy.scroll = { top: 0, left: 0 };
      copy.revision = 0;
      set({ docs: [...state.docs, copy], activeId: copy.id });
      get().notify('Document duplicated', 'success');
    },

    requestCloseDocument(id) {
      const doc = findDoc(get(), id);
      if (!doc) return;
      if (doc.dirty && get().preferences.confirmClose) {
        set({ modal: { kind: 'close-document', payload: { docId: doc.id } } });
        return;
      }
      get().closeDocument(doc.id);
    },

    markDocumentSaved(id) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => ({
          ...doc,
          savedSource: doc.source,
          dirty: false,
        })),
      }));
    },

    setActiveDocument(id) {
      if (!get().docs.some((doc) => doc.id === id)) return;
      set({ activeId: id });
    },

    renameDocument(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((state) => ({ docs: state.docs.map((doc) => (doc.id === id ? { ...doc, name: trimmed } : doc)) }));
    },

    setTheme(theme) {
      set({ theme });
    },

    toggleTheme() {
      set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
    },

    setLanguage(language) {
      set((state) => ({
        language,
        docs: state.docs.map((doc) => {
          const localized = localizeDefaultDocName(doc.name, language);
          return localized === doc.name ? doc : { ...doc, name: localized };
        }),
      }));
    },

    setViewMode(viewMode) {
      set({ viewMode });
    },

    setSplitRatio(splitRatio) {
      set({ splitRatio: Math.max(0.25, Math.min(0.8, splitRatio)) });
    },

    setPreferences(patch) {
      set((state) => ({ preferences: { ...state.preferences, ...patch } }));
    },

    applyClockFitToAll() {
      set((state) => {
        let changed = false;
        const docs = state.docs.map((doc) => {
          if (doc.parseError) return doc;
          const fitted = fitDocumentClocks(doc.data, doc.source);
          if (!fitted.changed) return doc;
          changed = true;
          return {
            ...doc,
            data: fitted.data,
            source: fitted.source,
            dirty: fitted.source !== doc.savedSource,
            revision: doc.revision + 1,
          };
        });
        return changed ? { docs } : {};
      });
    },

    setShortcuts(bindings) {
      set({ shortcuts: bindings });
    },

    applyShortcutPreset(presetName) {
      const preset = SHORTCUT_PRESETS[presetName];
      if (!preset) return;
      set({ shortcuts: deepClone(preset.bindings) });
      get().notify(translate(get().language, 'Applied {name} shortcuts', { name: translate(get().language, preset.label) }), 'success');
    },

    resetShortcuts() {
      set({ shortcuts: deepClone(DEFAULT_BINDINGS) });
      get().notify('Shortcuts reset to defaults', 'success');
    },

    updateSource(id, source) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc || doc.source === source) return;
      const snapshot = snapshotOf(doc);
      const isBurst = historyBurstTimers.has(id);
      set((current) => ({
        docs: updateDoc(current.docs, id, (item) => ({
          ...item,
          source,
          dirty: source !== item.savedSource,
          pendingParse: true,
          revision: item.revision,
          history: isBurst
            ? { ...item.history, future: [] }
            : {
                past: [...item.history.past, snapshot].slice(-MAX_HISTORY),
                future: [],
              },
        })),
      }));
      historyTimer(id);
      parseLater(id);
    },

    parsePendingSource(id) {
      const existingTimer = parseTimers.get(id);
      if (existingTimer !== undefined) window.clearTimeout(existingTimer);
      parseTimers.delete(id);
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const parsed = parseSource(doc.source);
      const fitted = parsed.data && state.preferences.autoFitClocks
        ? fitDocumentClocks(parsed.data, doc.source)
        : parsed.data
          ? { data: parsed.data, source: doc.source, changed: false }
          : null;
      const nextData = fitted?.data;
      const nextSource = fitted?.source ?? doc.source;
      set((current) => ({
        docs: updateDoc(current.docs, id, (item) => {
          if (nextData) {
            const selection = clampSelection(item.selection, nextData);
            return {
              ...item,
              source: nextSource,
              data: nextData,
              dirty: nextSource !== item.savedSource,
              parseError: null,
              pendingParse: false,
              selection,
              rowSelection: filterRowSelection(item.rowSelection, nextData),
              activeCell: activeCellFromSelection(selection),
              revision: bumpRevision(item),
            };
          }
          return {
            ...item,
            parseError: parsed.error || { message: 'Invalid WaveJSON' },
            pendingParse: false,
          };
        }),
      }));
    },

    formatDocument(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return false;
      const docId = doc.id;
      const parsed = parseSource(doc.source);
      if (!parsed.data) {
        set((current) => ({
          docs: updateDoc(current.docs, docId, (item) => ({
            ...item,
            parseError: parsed.error || { message: 'Invalid WaveJSON' },
            pendingParse: false,
          })),
        }));
        get().notify(parsed.error?.message || 'Invalid WaveJSON', 'error');
        return false;
      }
      clearDocTimers(docId);
      const fitted = get().preferences.autoFitClocks ? fitDocumentClocks(parsed.data, doc.source) : { data: parsed.data, source: doc.source };
      const formatted = prettySource(fitted.data);
      if (formatted === doc.source) {
        get().notify('WaveJSON is already formatted', 'info');
        return true;
      }
      const snapshot = snapshotOf(doc);
      set((current) => ({
        docs: updateDoc(current.docs, docId, (item) => ({
          ...item,
          data: fitted.data,
          source: formatted,
          dirty: formatted !== item.savedSource,
          parseError: null,
          pendingParse: false,
          revision: bumpRevision(item),
          history: { past: [...item.history.past, snapshot].slice(-MAX_HISTORY), future: [] },
        })),
      }));
      get().notify('WaveJSON formatted', 'success');
      return true;
    },

    undo(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      clearDocTimers(doc.id);
      if (doc.pendingParse) get().parsePendingSource(doc.id);
      const fresh = findDoc(get(), doc.id);
      if (!fresh) return;
      if (fresh.history.past.length === 0) return;
      const currentSnapshot = snapshotOf(fresh);
      const past = [...fresh.history.past];
      const target = past.pop()!;
      const parsedTarget = parseSource(target.source);
      const targetData = parsedTarget.data || target.data;
      const targetSelection = clampSelection(target.selection, targetData);
      set((current) => ({
        docs: updateDoc(current.docs, doc.id, (item) => ({
          ...item,
          source: target.source,
          data: targetData,
          dirty: target.source !== item.savedSource,
          parseError: parsedTarget.error || null,
          pendingParse: false,
          selection: targetSelection,
          rowSelection: filterRowSelection(target.rowSelection, targetData),
          activeCell: activeCellFromSelection(targetSelection),
          revision: bumpRevision(item),
          history: {
            past,
            future: [currentSnapshot, ...item.history.future].slice(0, MAX_HISTORY),
          },
        })),
      }));
    },

    redo(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      clearDocTimers(doc.id);
      const fresh = findDoc(get(), doc.id);
      if (!fresh || fresh.history.future.length === 0) return;
      const currentSnapshot = snapshotOf(fresh);
      const future = [...fresh.history.future];
      const target = future.shift()!;
      const parsedTarget = parseSource(target.source);
      const targetData = parsedTarget.data || target.data;
      const targetSelection = clampSelection(target.selection, targetData);
      set((current) => ({
        docs: updateDoc(current.docs, doc.id, (item) => ({
          ...item,
          source: target.source,
          data: targetData,
          dirty: target.source !== item.savedSource,
          parseError: parsedTarget.error || null,
          pendingParse: false,
          selection: targetSelection,
          rowSelection: filterRowSelection(target.rowSelection, targetData),
          activeCell: activeCellFromSelection(targetSelection),
          revision: bumpRevision(item),
          history: {
            past: [...item.history.past, currentSnapshot].slice(-MAX_HISTORY),
            future,
          },
        })),
      }));
    },

    setSelection(id, selection, rowSelection = []) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => {
          const clamped = clampSelection(selection, doc.data);
          return {
            ...doc,
            selection: clamped,
            rowSelection: filterRowSelection(rowSelection, doc.data),
            activeCell: activeCellFromSelection(clamped),
          };
        }),
      }));
    },

    selectRow(id, row, mode) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => {
          const count = rowCount(doc.data);
          if (count === 0) return doc;
          const target = Math.max(0, Math.min(count - 1, row));
          let rows: number[];
          if (mode === 'toggle') {
            const existing = new Set(doc.rowSelection);
            if (existing.has(target)) existing.delete(target);
            else existing.add(target);
            rows = [...existing];
          } else if (mode === 'range') {
            const anchor = doc.rowSelection.length > 0 ? doc.rowSelection[0] : doc.activeCell.row;
            const start = Math.min(anchor, target);
            const end = Math.max(anchor, target);
            rows = Array.from({ length: end - start + 1 }, (_, index) => start + index);
          } else {
            rows = [target];
          }
          rows = filterRowSelection(rows, doc.data);
          const col = Math.min(doc.activeCell.col, Math.max(0, maxWaveWidth(doc.data)));
          const selection = toCellSelection(target, col);
          return {
            ...doc,
            rowSelection: rows,
            selection,
            activeCell: { row: target, col },
          };
        }),
      }));
    },

    navigateSelection(id, dRow, dCol, extend) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const count = rowCount(doc.data);
      if (count === 0) return;
      const focus = doc.activeCell;
      const row = Math.max(0, Math.min(count - 1, focus.row + dRow));
      const maxCol = Math.max(1, maxWaveWidth(doc.data) + 16);
      const col = Math.max(0, Math.min(maxCol, focus.col + dCol));
      const selection = extend
        ? {
            row0: doc.selection.row0,
            col0: doc.selection.col0,
            row1: row,
            col1: col,
          }
        : toCellSelection(row, col);
      set((current) => ({
        docs: updateDoc(current.docs, id, (item) => ({
          ...item,
          selection: clampSelection(selection, item.data),
          activeCell: { row, col },
          rowSelection: [],
        })),
      }));
    },

    jumpSelection(id, edge) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const row = doc.activeCell.row;
      const col = edge === 'start' ? 0 : Math.max(0, maxWaveWidth(doc.data) - 1);
      get().setSelection(id, toCellSelection(row, col));
    },

    selectAllCells(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = rowCount(doc.data);
      const cols = Math.max(1, maxWaveWidth(doc.data));
      get().setSelection(doc.id, { row0: 0, col0: 0, row1: rows - 1, col1: cols - 1 });
    },

    setZoom(id, zoom) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => ({
          ...doc,
          zoom: Math.max(0.4, Math.min(3, Number.isFinite(zoom) ? zoom : 1)),
        })),
      }));
    },

    zoomStep(id, direction) {
      const doc = findDoc(get(), id);
      if (!doc) return;
      const currentIndex = ZOOM_LEVELS.findIndex((value) => value >= doc.zoom - 0.001);
      let index = currentIndex < 0 ? ZOOM_LEVELS.findIndex((value) => value === 1) : currentIndex;
      if (direction > 0) {
        if (currentIndex >= 0 && ZOOM_LEVELS[currentIndex] === doc.zoom) index += 1;
        else index = Math.min(ZOOM_LEVELS.length - 1, index);
      } else {
        if (currentIndex >= 0 && ZOOM_LEVELS[currentIndex] === doc.zoom) index -= 1;
      }
      index = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index));
      get().setZoom(id, ZOOM_LEVELS[index]);
    },

    resetZoom(id) {
      get().setZoom(id, 1);
    },

    updateScroll(id, scroll) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => ({
          ...doc,
          scroll: {
            top: Math.max(0, Math.round(scroll.top)),
            left: Math.max(0, Math.round(scroll.left)),
          },
        })),
      }));
    },

    setInsertMode(id, active) {
      set((state) => ({
        docs: updateDoc(state.docs, id, (doc) => ({ ...doc, insertMode: active })),
      }));
    },

    toggleInsertMode(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      get().setInsertMode(doc.id, !doc.insertMode);
      get().notify(doc.insertMode ? 'Insert mode off' : 'Insert mode on — typed cells push the rest of the lane right', 'info');
    },

    paintCharacter(char, id) {
      if (!isWaveChar(char)) return false;
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return false;
      const rows = selectedSignalRows(doc);
      if (rows.length === 0) return false;
      if (doc.insertMode) {
        const col = doc.activeCell.col;
        const selection = { row0: rows[0], row1: rows[rows.length - 1], col0: col, col1: col };
        const nextSel = toCellSelection(rows[0], col + 1, rows[rows.length - 1], col + 1);
        return applyMutator(doc.id, (draft) => insertCycleChar(draft, selection, char).doc, {
          selection: nextSel,
          rowSelection: rows,
          toast: undefined,
        });
      }
      const sel = normalizeSelection(doc.selection);
      const single = sel.row0 === sel.row1 && sel.col0 === sel.col1;
      let nextSelection: CellSelection = doc.selection;
      if (single && get().preferences.autoAdvance) {
        nextSelection = toCellSelection(sel.row0, sel.col1 + 1);
      }
      const changed = applyMutator(doc.id, (draft) => paintCells(draft, sel, char).doc, {
        selection: nextSelection,
        rowSelection: [],
      });
      return changed;
    },

    applyToolAt(id, row, col, tool, drag = false) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc || tool === 'select' || tool === 'text' || tool === 'node') return false;
      const lane = flattenLanes(doc.data)[row];
      if (!lane || lane.isSpacer) return false;
      const current = lane.item.wave?.[col] || '.';
      let target = '';
      switch (tool) {
        case 'clock': {
          const cycle: Record<string, string> = { p: 'P', P: 'n', n: 'N', N: 'p' };
          target = drag ? 'p' : cycle[current] || 'p';
          break;
        }
        case 'signal':
          target = drag ? '1' : current === '1' ? '0' : '1';
          break;
        case 'bus':
          target = drag || current !== '=' ? '=' : '.';
          break;
        case 'unknown':
          target = drag || current !== 'x' ? 'x' : '.';
          break;
        case 'highz':
          target = drag || current !== 'z' ? 'z' : '.';
          break;
        case 'gap':
          target = drag || current !== '|' ? '|' : '.';
          break;
        case 'clear':
          target = '.';
          break;
        default:
          return false;
      }
      const selection = toCellSelection(row, col);
      return applyMutator(
        doc.id,
        (draft) => (tool === 'clear' ? clearCells(draft, selection).doc : paintCells(draft, selection, target).doc),
        { selection, rowSelection: [] },
      );
    },

    setNodeAt(id, row, col, marker) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return false;
      const lane = flattenLanes(doc.data)[row];
      if (!lane || lane.isSpacer) return false;
      const requested = marker.trim().slice(0, 1) || '.';
      if (requested !== '.') {
        const duplicate = flattenLanes(doc.data).some((other) => {
          if (other.row === row || typeof other.item.node !== 'string') return false;
          return other.item.node.includes(requested);
        });
        if (duplicate) {
          get().notify('Node markers must be unique', 'warning');
          return false;
        }
      }
      const selection = toCellSelection(row, col);
      return applyMutator(doc.id, (draft) => setNodeMarker(draft, row, col, requested), {
        selection,
        rowSelection: [],
      });
    },

    clearSelectedCells(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const changed = applyMutator(doc.id, (draft) => clearCells(draft, doc.selection).doc, {
        selection: doc.selection,
        rowSelection: doc.rowSelection,
        toast: 'Cells cleared to "."',
        tone: 'info',
      });
      if (!changed) get().notify('Nothing to clear', 'info');
    },

    deleteSelectedCycles(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const result = applyMutator(doc.id, (draft) => {
        const outcome = deleteSelectedCells(draft, doc.selection);
        return outcome.doc;
      }, {
        selection: doc.selection,
        rowSelection: doc.rowSelection,
        toast: 'Selected cycles deleted',
      });
      if (!result) get().notify('No cycles to delete in this selection', 'info');
    },

    insertCycle(side, id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = selectedSignalRows(doc);
      if (rows.length === 0) return;
      const sel = normalizeSelection(doc.selection);
      const column = side === 'before' ? sel.col0 : sel.col1 + 1;
      applyMutator(doc.id, (draft) => insertCycles(draft, rows, column, 1), {
        selection: { ...sel, col0: sel.col0 + (side === 'before' ? 1 : 0), col1: sel.col1 + (side === 'before' ? 1 : 0) },
        rowSelection: doc.rowSelection,
        toast: side === 'before' ? 'Cycle inserted before selection' : 'Cycle inserted after selection',
        tone: 'info',
      });
    },

    addSignal(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      applyMutator(doc.id, (draft) => appendLane(draft, makeLane(draft)), {
        selection: (next) => {
          const rows = rowCount(next);
          return toCellSelection(rows - 1, 0);
        },
        toast: 'Signal added',
      });
    },

    insertSignal(where, id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const row = doc.activeCell.row + (where === 'below' ? 1 : 0);
      const rows = rowCount(doc.data);
      const insertRow = Math.max(0, Math.min(row, rows));
      applyMutator(doc.id, (draft) => insertLane(draft, insertRow, makeLane(draft)), {
        selection: () => toCellSelection(insertRow, 0),
        toast: translate(get().language, 'Signal inserted {where}', { where: translate(get().language, where) }),
      });
    },

    addEmptyRow(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      applyMutator(doc.id, (draft) => addEmptyRow(draft, doc.activeCell.row), {
        selection: () => toCellSelection(doc.activeCell.row + 1, 0),
        toast: 'Empty row inserted',
      });
    },

    duplicateSignals(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = selectedSignalRows(doc);
      applyMutator(doc.id, (draft) => duplicateRows(draft, rows), {
        rowSelection: doc.rowSelection,
        toast: 'Selected signals duplicated',
      });
    },

    deleteSelectedSignals(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = selectedSignalRows(doc);
      if (rows.length === 0) return;
      if (rows.length >= rowCount(doc.data)) {
        get().notify('A diagram needs at least one signal lane. Add a new lane before deleting the last one.', 'warning');
        return;
      }
      applyMutator(doc.id, (draft) => deleteLanes(draft, rows), {
        selection: (next) => {
          const count = rowCount(next);
          const row = Math.max(0, Math.min(doc.activeCell.row, count - 1));
          return toCellSelection(row, 0);
        },
        rowSelection: [],
        toast: 'Selected signals deleted',
      });
    },

    moveSignals(direction, id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = selectedSignalRows(doc);
      let message = '';
      let rowShift = 0;
      applyMutator(doc.id, (draft) => {
        const result = moveRows(draft, rows, direction);
        if (result.message) message = result.message;
        rowShift = result.rowShift || 0;
        return result.doc;
      }, {
        selection: (next) => {
          const selection = {
            ...doc.selection,
            row0: Math.max(0, Math.min(rowCount(next) - 1, doc.selection.row0 + rowShift)),
            row1: Math.max(0, Math.min(rowCount(next) - 1, doc.selection.row1 + rowShift)),
          };
          return selection;
        },
        rowSelection: () => doc.rowSelection.map((row) => row + rowShift),
      });
      if (message) get().notify(message, 'info');
    },

    groupSelection(name, rows, id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const targetRows = rows && rows.length > 0 ? rows : selectedSignalRows(doc);
      if (targetRows.length === 0) {
        get().notify('Select at least one signal row to group', 'warning');
        return;
      }
      applyMutator(doc.id, (draft) => groupRows(draft, targetRows, name || 'group'), {
        rowSelection: targetRows,
        selection: doc.selection,
        toast: translate(get().language, 'Grouped {count} signals as “{name}”', {
          count: targetRows.length,
          name: name || translate(get().language, 'Group'),
        }),
      });
    },

    ungroupSelection(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = selectedSignalRows(doc);
      const groups = extractUnits(doc.data, rows);
      if (!groups.some((unit) => unit.isGroup)) {
        get().notify('Selection does not cover a complete group', 'warning');
        return;
      }
      applyMutator(doc.id, (draft) => ungroupRows(draft, rows), {
        rowSelection: rows,
        toast: 'Group dissolved',
      });
    },

    fitClocksToLongest(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      applyMutator(doc.id, (draft) => fitClocks(draft), {
        rowSelection: doc.rowSelection,
        selection: doc.selection,
        toast: 'Clock lanes fitted to the longest signal',
      });
    },

    renameLane(id, row, name) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      applyMutator(doc.id, (draft) => updateLane(draft, row, { name }), {
        selection: doc.selection,
        rowSelection: doc.rowSelection,
      });
    },

    setLaneDataAt(id, row, index, value) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      applyMutator(doc.id, (draft) => setLaneDataLabel(draft, row, index, value), {
        selection: doc.selection,
        rowSelection: doc.rowSelection,
      });
    },

    applyLaneProperties(id, row, input) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return false;
      const period = input.period.trim() === '' ? undefined : Number(input.period);
      const phase = input.phase.trim() === '' ? undefined : Number(input.phase);
      if (period !== undefined && (!Number.isFinite(period) || period <= 0)) {
        get().notify('Period must be a positive number', 'warning');
        return false;
      }
      if (phase !== undefined && (!Number.isFinite(phase) || phase < 0 || phase > 1)) {
        get().notify('Phase must be between 0 and 1', 'warning');
        return false;
      }
      const ok = applyMutator(doc.id, (draft) => updateLane(draft, row, {
        name: input.name,
        wave: input.wave,
        node: input.node,
        data: input.data.length > 0 ? input.data : undefined,
        period,
        phase,
      }), {
        selection: doc.selection,
        rowSelection: doc.rowSelection,
        toast: 'Signal properties updated',
      });
      return ok;
    },

    reorderSignal(id, sourceRow, targetRow, after) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      const rows = rowCount(doc.data);
      const target = Math.max(0, Math.min(rows - 1, targetRow));
      const ok = applyMutator(doc.id, (draft) => reorderLane(draft, sourceRow, target, after), {
        selection: (next) => {
          const count = rowCount(next);
          const row = after ? Math.min(count - 1, target + 1) : Math.max(0, target);
          return toCellSelection(row, doc.activeCell.col);
        },
        toast: 'Signal order updated',
      });
      if (!ok) get().notify('Signal unchanged', 'info');
    },

    applyDiagramSettings(id, input) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return false;
      const hscale = Number(input.hscale);
      if (!Number.isFinite(hscale) || hscale < 1 || hscale > 20) {
        get().notify('Horizontal scale must be between 1 and 20', 'warning');
        return false;
      }
      try {
        const headText = input.headText === '' ? undefined : parseRichText(input.headText);
        const footText = input.footText === '' ? undefined : parseRichText(input.footText);
        const ok = applyMutator(doc.id, (draft) => {
          draft.config = { ...(draft.config || {}) };
          draft.config.skin = input.skin;
          draft.config.hscale = Math.round(hscale);
          const updateBlock = (key: 'head' | 'foot', text: unknown, tick: string, tock: string, every: string) => {
            const existing = draft[key] && typeof draft[key] === 'object' && !Array.isArray(draft[key]) ? { ...draft[key] } : {};
            setIfValue(existing, 'text', text);
            setIfValue(existing, 'tick', parseSettingsValue(tick));
            setIfValue(existing, 'tock', parseSettingsValue(tock));
            setIfValue(existing, 'every', parseSettingsValue(every));
            if (Object.keys(existing).length === 0) delete draft[key];
            else draft[key] = existing;
          };
          updateBlock('head', headText, input.headTick, input.headTock, input.headEvery);
          updateBlock('foot', footText, input.footTick, input.footTock, input.footEvery);
          return draft;
        }, {
          selection: doc.selection,
          rowSelection: doc.rowSelection,
          toast: 'Diagram settings updated',
        });
        return ok;
      } catch (error) {
        get().notify(error instanceof Error ? error.message : String(error), 'error');
        return false;
      }
    },

    async copySelection(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      try {
        if (doc.rowSelection.length > 0) {
          const units = extractUnits(doc.data, doc.rowSelection);
          if (units.length === 0) {
            get().notify('Nothing selected to copy', 'warning');
            return;
          }
          const items = copyNodeItems(doc.data, doc.rowSelection);
          const result = await writeClipboard(signalPayload(items));
          get().notify(
            translate(get().language, result.system
              ? 'Copied {count} signal pattern(s) to the clipboard'
              : 'Copied signal block to the in-app clipboard', { count: items.length }),
            'success',
          );
          return;
        }
        const sel = normalizeSelection(doc.selection);
        const block = [] as string[];
        for (let row = sel.row0; row <= sel.row1; row += 1) {
          const flat = flattenLanes(doc.data)[row];
          if (!flat) {
            block.push('.'.repeat(sel.col1 - sel.col0 + 1));
            continue;
          }
          let text = '';
          for (let col = sel.col0; col <= sel.col1; col += 1) text += flat.item.wave?.[col] || '.';
          block.push(text);
        }
        const result = await writeClipboard(cellPayload(block, sel.col1 - sel.col0 + 1));
        get().notify(
          result.system ? 'Copied cell block to the clipboard' : 'Copied cell block to the in-app clipboard',
          'success',
        );
      } catch (error) {
        get().notify(error instanceof Error ? error.message : 'Copy failed', 'error');
      }
    },

    async cutSelection(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      if (doc.rowSelection.length > 0) {
        await get().copySelection(id);
        get().deleteSelectedSignals(id);
      } else {
        await get().copySelection(id);
        get().clearSelectedCells(id);
      }
    },

    async pasteClipboard(id) {
      const state = get();
      const doc = findDoc(state, id);
      if (!doc) return;
      try {
        const clipboard = await readClipboard();
        const parsed = parseClipboardText(clipboard.text);
        if (parsed.kind === 'signals' || parsed.kind === 'wavejson') {
          const items = parsed.items || [];
          const selectedRows = doc.rowSelection.length > 0
            ? [...doc.rowSelection].sort((a, b) => a - b)
            : [doc.activeCell.row];
          const insertRow = selectedRows[selectedRows.length - 1];
          const pastedLaneCount = Math.max(1, items.reduce((total, item) => total + itemLeafCount(item), 0));
          const ok = applyMutator(doc.id, (draft) => insertItemsAfterSelectionRows(draft, selectedRows, items), {
            selection: (next) => {
              const count = rowCount(next);
              const start = Math.min(insertRow + 1, count - 1);
              const end = Math.min(start + pastedLaneCount - 1, count - 1);
              return toCellSelection(start, 0, end, 0);
            },
            rowSelection: (next) => {
              const count = rowCount(next);
              const start = Math.min(insertRow + 1, count - 1);
              const end = Math.min(start + pastedLaneCount - 1, count - 1);
              return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
            },
            toast: translate(get().language, '{count} signal(s) pasted', { count: pastedLaneCount }),
          });
          if (!ok) get().notify('Nothing was pasted', 'info');
          return;
        }
        if (parsed.kind === 'cells' && parsed.rows) {
          const sel = normalizeSelection(doc.selection);
          const rows = parsed.rows;
          const width = Math.max(1, ...rows.map((row) => row.length));
          const ok = applyMutator(doc.id, (draft) => pasteCellBlock(draft, { ...sel, row0: sel.row0, col0: sel.col0 }, rows).doc, {
            selection: (next) => {
              const maxRows = rowCount(next);
              return {
                row0: sel.row0,
                col0: sel.col0,
                row1: Math.min(maxRows - 1, sel.row0 + rows.length - 1),
                col1: sel.col0 + width - 1,
              };
            },
            toast: 'Cells pasted',
          });
          if (!ok) get().notify('Clipboard cells were unchanged', 'info');
          return;
        }
        get().notify('Clipboard does not contain WaveJSON signals or waveform cells.', 'warning');
      } catch (error) {
        get().notify(error instanceof Error ? error.message : 'Paste failed', 'error');
      }
    },

    openModal(kind, payload) {
      set({ modal: { kind, payload } });
    },

    closeModal() {
      set({ modal: null });
    },

    notify(message, tone = 'info') {
      const id = `toast-${Date.now()}-${toastCounter += 1}`;
      const localized = translate(get().language, message);
      set((state) => ({ toasts: [...state.toasts, { id, message: localized, tone }].slice(-4) }));
      window.setTimeout(() => {
        useAppStore.getState().dismissToast(id);
      }, tone === 'error' ? 6500 : 3800);
    },

    dismissToast(id) {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    },

    markHydrated() {
      set({ hydrated: true });
    },
  };

  Object.assign(store, api);
  return store;
});

// The store should persist only after user-visible state exists.
useAppStore.subscribe(() => schedulePersistSoon());

// Expose a tiny debug surface for browser tests and integrations.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__WAVEDROM_STUDIO__ = {
    getState: () => useAppStore.getState(),
    clearShareParam,
    clockLength,
    normalizeKeyEvent,
    conflicts: () => findShortcutConflicts(useAppStore.getState().shortcuts),
    examples: EXAMPLES,
  };
}

export { BLANK_SOURCE, DEFAULT_EXAMPLE, EXAMPLES };
