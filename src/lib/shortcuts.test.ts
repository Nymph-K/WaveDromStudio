import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BINDINGS,
  SHORTCUT_ACTIONS,
  SHORTCUT_PRESETS,
  bindingsToKeyMap,
  findShortcutConflicts,
  normalizeShortcutString,
} from './shortcuts';

describe('shortcut defaults', () => {
  it('defines a binding entry for every action', () => {
    for (const action of SHORTCUT_ACTIONS) {
      expect(DEFAULT_BINDINGS[action.id]).toBeDefined();
    }
  });

  it('has no duplicate key combinations in the default preset', () => {
    expect(findShortcutConflicts(DEFAULT_BINDINGS)).toEqual([]);
  });

  it('keeps every preset conflict-free', () => {
    for (const [name, preset] of Object.entries(SHORTCUT_PRESETS)) {
      const conflicts = findShortcutConflicts(preset.bindings);
      expect(conflicts, `${name} has conflicts: ${JSON.stringify(conflicts)}`).toEqual([]);
    }
  });
});

describe('shortcut normalization', () => {
  it('orders modifiers consistently and normalizes case', () => {
    expect(normalizeShortcutString('shift+ctrl+z')).toBe('Ctrl+Shift+Z');
    expect(normalizeShortcutString('alt+meta+shift+d')).toBe('Alt+Shift+Meta+D');
    expect(normalizeShortcutString('Ctrl+Shift+Alt+D')).toBe('Ctrl+Alt+Shift+D');
    expect(normalizeShortcutString('ctrl+=')).toBe('Ctrl+=');
  });

  it('maps equivalent spellings to the same key', () => {
    const a = bindingsToKeyMap({ one: ['Ctrl+Shift+Alt+D'] });
    const b = bindingsToKeyMap({ one: ['shift+alt+control+d'] });
    expect([...a.keys()]).toEqual([...b.keys()]);
  });

  it('reports cross-action key conflicts', () => {
    const conflict = findShortcutConflicts({ a: ['Ctrl+K'], b: ['Ctrl+K'] });
    expect(conflict).toHaveLength(1);
    expect(conflict[0].key).toBe('Ctrl+K');
    expect(findShortcutConflicts({ a: ['Ctrl+K'] })).toEqual([]);
  });
});
