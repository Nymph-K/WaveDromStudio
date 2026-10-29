import type { ShortcutAction } from '../types';

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  // File
  { id: 'file.new', label: 'New document', category: 'File', defaultKeys: ['Ctrl+N'] },
  { id: 'file.open', label: 'Open WaveJSON file…', category: 'File', defaultKeys: ['Ctrl+O'] },
  { id: 'file.saveJson', label: 'Download WaveJSON', category: 'File', defaultKeys: ['Ctrl+S'] },
  { id: 'file.share', label: 'Copy share link', category: 'File', defaultKeys: ['Ctrl+Shift+L'], global: true },
  { id: 'file.exportSvg', label: 'Export SVG', category: 'File', defaultKeys: ['Ctrl+Shift+E'] },
  { id: 'file.exportPng', label: 'Export PNG', category: 'File', defaultKeys: [] },

  // Editing
  { id: 'edit.undo', label: 'Undo', category: 'Editing', defaultKeys: ['Ctrl+Z'], global: true },
  { id: 'edit.redo', label: 'Redo', category: 'Editing', defaultKeys: ['Ctrl+Shift+Z', 'Ctrl+Y'], global: true },
  { id: 'edit.copy', label: 'Copy selected cells or signals', category: 'Editing', defaultKeys: ['Ctrl+C'] },
  { id: 'edit.cut', label: 'Cut selected cells or signals', category: 'Editing', defaultKeys: ['Ctrl+X'] },
  { id: 'edit.paste', label: 'Paste cells or signals', category: 'Editing', defaultKeys: ['Ctrl+V'] },
  { id: 'edit.selectAll', label: 'Select all cells', category: 'Editing', defaultKeys: ['Ctrl+A'] },
  { id: 'edit.format', label: 'Format WaveJSON', category: 'Editing', defaultKeys: ['Ctrl+Shift+F'] },
  { id: 'edit.find', label: 'Find in WaveJSON', category: 'Editing', defaultKeys: ['Ctrl+F'] },

  // Canvas editing
  { id: 'canvas.deleteCycles', label: 'Delete selected cycles', category: 'Canvas', defaultKeys: ['Delete'] },
  { id: 'canvas.clearCells', label: 'Clear cells to "."', category: 'Canvas', defaultKeys: ['Shift+Delete'] },
  { id: 'canvas.insertBefore', label: 'Insert cycle before selection', category: 'Canvas', defaultKeys: ['Ctrl+Shift+ArrowLeft'] },
  { id: 'canvas.insertAfter', label: 'Insert cycle after selection', category: 'Canvas', defaultKeys: ['Ctrl+Shift+ArrowRight'] },
  { id: 'canvas.insertMode', label: 'Toggle continuous insert mode', category: 'Canvas', defaultKeys: ['Ctrl+Alt+I'] },
  { id: 'canvas.editName', label: 'Edit signal name inline', category: 'Canvas', defaultKeys: ['F2'] },
  { id: 'canvas.properties', label: 'Signal properties…', category: 'Canvas', defaultKeys: ['Ctrl+Shift+P'] },

  // Selection
  { id: 'nav.left', label: 'Move selection left', category: 'Selection', defaultKeys: ['ArrowLeft'] },
  { id: 'nav.right', label: 'Move selection right', category: 'Selection', defaultKeys: ['ArrowRight'] },
  { id: 'nav.up', label: 'Move selection up', category: 'Selection', defaultKeys: ['ArrowUp'] },
  { id: 'nav.down', label: 'Move selection down', category: 'Selection', defaultKeys: ['ArrowDown'] },
  { id: 'nav.extendLeft', label: 'Extend selection left', category: 'Selection', defaultKeys: ['Shift+ArrowLeft'] },
  { id: 'nav.extendRight', label: 'Extend selection right', category: 'Selection', defaultKeys: ['Shift+ArrowRight'] },
  { id: 'nav.extendUp', label: 'Extend selection up', category: 'Selection', defaultKeys: ['Shift+ArrowUp'] },
  { id: 'nav.extendDown', label: 'Extend selection down', category: 'Selection', defaultKeys: ['Shift+ArrowDown'] },
  { id: 'nav.rowStart', label: 'Jump to row start', category: 'Selection', defaultKeys: ['Home'] },
  { id: 'nav.rowEnd', label: 'Jump to row end', category: 'Selection', defaultKeys: ['End'] },
  { id: 'nav.selectRow', label: 'Select current row', category: 'Selection', defaultKeys: ['Ctrl+Space'] },

  // Signals
  { id: 'signal.add', label: 'Add signal at end', category: 'Signals', defaultKeys: ['Ctrl+Enter'] },
  { id: 'signal.insertAbove', label: 'Insert signal above', category: 'Signals', defaultKeys: ['Insert'] },
  { id: 'signal.insertBelow', label: 'Insert signal below', category: 'Signals', defaultKeys: ['Ctrl+Insert'] },
  { id: 'signal.addEmpty', label: 'Insert empty {} row', category: 'Signals', defaultKeys: ['Ctrl+Shift+Insert'] },
  { id: 'signal.duplicate', label: 'Duplicate selected signals', category: 'Signals', defaultKeys: ['Ctrl+D'] },
  { id: 'signal.delete', label: 'Delete selected signals', category: 'Signals', defaultKeys: ['Ctrl+Delete'] },
  { id: 'signal.moveUp', label: 'Move selected signals up', category: 'Signals', defaultKeys: ['Alt+ArrowUp'] },
  { id: 'signal.moveDown', label: 'Move selected signals down', category: 'Signals', defaultKeys: ['Alt+ArrowDown'] },
  { id: 'signal.group', label: 'Group selected signals…', category: 'Signals', defaultKeys: ['Ctrl+G'] },
  { id: 'signal.ungroup', label: 'Ungroup selected signals', category: 'Signals', defaultKeys: ['Ctrl+Shift+G'] },
  { id: 'signal.fitClocks', label: 'Fit clocks to longest lane', category: 'Signals', defaultKeys: ['Ctrl+Shift+9'] },

  // View and tabs
  { id: 'view.waveOnly', label: 'Waveform only', category: 'View & tabs', defaultKeys: ['Ctrl+1'] },
  { id: 'view.editorOnly', label: 'JSON editor only', category: 'View & tabs', defaultKeys: ['Ctrl+2'] },
  { id: 'view.splitSide', label: 'Split side by side', category: 'View & tabs', defaultKeys: ['Ctrl+3'] },
  { id: 'view.splitStacked', label: 'Split top / bottom', category: 'View & tabs', defaultKeys: ['Ctrl+4'] },
  { id: 'view.zoomIn', label: 'Zoom in', category: 'View & tabs', defaultKeys: ['Ctrl+='] },
  { id: 'view.zoomOut', label: 'Zoom out', category: 'View & tabs', defaultKeys: ['Ctrl+-'] },
  { id: 'view.zoomReset', label: 'Reset zoom', category: 'View & tabs', defaultKeys: ['Ctrl+0'] },
  { id: 'view.theme', label: 'Toggle light / dark theme', category: 'View & tabs', defaultKeys: ['Ctrl+Shift+T'], global: true },
  { id: 'view.settings', label: 'Diagram settings…', category: 'View & tabs', defaultKeys: ['Ctrl+Alt+G'] },
  { id: 'tab.close', label: 'Close current tab', category: 'View & tabs', defaultKeys: ['Ctrl+W'], global: true },
  { id: 'tab.next', label: 'Next tab', category: 'View & tabs', defaultKeys: ['Ctrl+Tab'], global: true },
  { id: 'tab.prev', label: 'Previous tab', category: 'View & tabs', defaultKeys: ['Ctrl+Shift+Tab'], global: true },
  { id: 'help.shortcuts', label: 'Shortcuts & quick help', category: 'Help', defaultKeys: ['F1'], global: true },
];

export const DEFAULT_BINDINGS: Record<string, string[]> = Object.fromEntries(
  SHORTCUT_ACTIONS.map((action) => [action.id, [...action.defaultKeys]]),
);

export const SHORTCUT_PRESETS: Record<string, { label: string; description: string; bindings: Record<string, string[]> }> = {
  studio: {
    label: 'WaveDrom Studio',
    description: 'Complete keyboard workflow with all signal and cycle operations.',
    bindings: DEFAULT_BINDINGS,
  },
  wavedromgen: {
    label: 'WaveDromGen classic',
    description: 'Desktop-editor muscle memory: paint, insert/delete cycles and group.',
    bindings: {
      ...DEFAULT_BINDINGS,
      'canvas.deleteCycles': ['Delete'],
      'canvas.clearCells': ['Shift+Delete'],
      'canvas.insertBefore': ['Ctrl+Shift+ArrowLeft'],
      'canvas.insertAfter': ['Ctrl+Shift+ArrowRight'],
      'view.theme': ['Ctrl+Alt+Shift+D'],
      'file.share': ['Ctrl+Alt+S'],
    },
  },
  minimal: {
    label: 'Minimal',
    description: 'Navigation, editing and view controls only; signal shortcuts freed.',
    bindings: {
      ...Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map((id) => [id, []])),
      'file.new': ['Ctrl+N'],
      'file.open': ['Ctrl+O'],
      'file.saveJson': ['Ctrl+S'],
      'edit.undo': ['Ctrl+Z'],
      'edit.redo': ['Ctrl+Shift+Z', 'Ctrl+Y'],
      'edit.copy': ['Ctrl+C'],
      'edit.paste': ['Ctrl+V'],
      'edit.cut': ['Ctrl+X'],
      'edit.selectAll': ['Ctrl+A'],
      'edit.format': ['Ctrl+Shift+F'],
      'canvas.deleteCycles': ['Delete'],
      'canvas.clearCells': ['Shift+Delete'],
      'nav.left': ['ArrowLeft'],
      'nav.right': ['ArrowRight'],
      'nav.up': ['ArrowUp'],
      'nav.down': ['ArrowDown'],
      'nav.extendLeft': ['Shift+ArrowLeft'],
      'nav.extendRight': ['Shift+ArrowRight'],
      'nav.extendUp': ['Shift+ArrowUp'],
      'nav.extendDown': ['Shift+ArrowDown'],
      'view.waveOnly': ['Ctrl+1'],
      'view.editorOnly': ['Ctrl+2'],
      'view.splitSide': ['Ctrl+3'],
      'view.splitStacked': ['Ctrl+4'],
      'view.zoomIn': ['Ctrl+='],
      'view.zoomOut': ['Ctrl+-'],
      'view.zoomReset': ['Ctrl+0'],
      'view.theme': ['Ctrl+Shift+T'],
      'tab.close': ['Ctrl+W'],
      'help.shortcuts': ['F1'],
    },
  },
};

export const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Dead']);

export function normalizeKeyEvent(event: KeyboardEvent): string {
  const rawKey = event.key;
  if (!rawKey || MODIFIER_KEYS.has(rawKey)) return '';
  let key: string;
  if (rawKey === ' ') key = 'Space';
  else if (rawKey === 'Esc') key = 'Escape';
  else if (rawKey === 'Del') key = 'Delete';
  else if (rawKey === 'Ins') key = 'Insert';
  else if (rawKey === '+') key = '=';
  else if (rawKey.length === 1) key = rawKey.toUpperCase();
  else key = rawKey;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) {
    // '+' is produced with Shift+= on most layouts; treat it as the '=' key.
    if (rawKey !== '+') parts.push('Shift');
  }
  if (event.metaKey) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export function eventHasOnlyModifiers(event: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(event.key);
}

export function normalizeShortcutString(key: string): string {
  if (!key) return '';
  const parts = key.split('+').filter(Boolean);
  if (parts.length === 0) return '';
  const modifiers = new Set<string>();
  let main = '';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') modifiers.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') modifiers.add('Alt');
    else if (lower === 'shift') modifiers.add('Shift');
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') modifiers.add('Meta');
    else main = part.length === 1 ? part.toUpperCase() : part;
  }
  if (!main) return '';
  const ordered: string[] = [];
  for (const modifier of ['Ctrl', 'Alt', 'Shift', 'Meta']) {
    if (modifiers.has(modifier)) ordered.push(modifier);
  }
  ordered.push(main);
  return ordered.join('+');
}

export function bindingsToKeyMap(bindings: Record<string, string[]>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [actionId, keys] of Object.entries(bindings)) {
    for (const key of keys) {
      if (!key) continue;
      const normalized = normalizeShortcutString(key);
      if (!normalized) continue;
      const actions = map.get(normalized) || [];
      actions.push(actionId);
      map.set(normalized, actions);
    }
  }
  return map;
}

export interface ShortcutConflict {
  key: string;
  actionIds: string[];
}

export function findShortcutConflicts(bindings: Record<string, string[]>): ShortcutConflict[] {
  const map = bindingsToKeyMap(bindings);
  const conflicts: ShortcutConflict[] = [];
  for (const [key, actions] of map.entries()) {
    if (actions.length > 1) conflicts.push({ key, actionIds: actions });
  }
  return conflicts;
}

export function shortcutAction(actionId: string): ShortcutAction | undefined {
  return SHORTCUT_ACTIONS.find((action) => action.id === actionId);
}

export function categoryOrder(): string[] {
  return ['File', 'Editing', 'Canvas', 'Selection', 'Signals', 'View & tabs', 'Help'];
}

export function displayKey(key: string): string {
  return normalizeShortcutString(key)
    .replace(/Meta/g, '⌘')
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/Arrow/g, '')
    .replace(/\+/g, ' + ');
}

export function sameBindings(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key] || [];
    const bv = b[key] || [];
    if (av.length !== bv.length || av.some((value, index) => value !== bv[index])) return false;
  }
  return true;
}
