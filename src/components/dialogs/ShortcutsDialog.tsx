import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertTriangle, Check, Command, Keyboard, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore } from '../../state/appStore';
import {
  DEFAULT_BINDINGS,
  SHORTCUT_ACTIONS,
  SHORTCUT_PRESETS,
  categoryOrder,
  displayKey,
  findShortcutConflicts,
  normalizeKeyEvent,
  shortcutAction,
} from '../../lib/shortcuts';
import { WAVE_CHAR_LIST } from '../../model/waveModel';
import { useI18n } from '../../lib/useI18n';

interface CaptureState {
  actionId: string;
  slot: number | 'new';
}

const CHAR_LABELS: Record<string, string> = {
  '0': 'low',
  '1': 'high',
  x: 'unknown',
  z: 'high-Z',
  '=': 'bus',
  u: 'up',
  d: 'down',
  p: 'clock+',
  n: 'clock−',
  P: 'edge+',
  N: 'edge−',
  l: 'low clock',
  L: 'low edge',
  h: 'high clock',
  H: 'high edge',
  '2': 'bus 2',
  '3': 'bus 3',
  '4': 'bus 4',
  '5': 'bus 5',
  '6': 'bus 6',
  '7': 'bus 7',
  '8': 'bus 8',
  '9': 'bus 9',
  '|': 'gap',
  '.': 'repeat',
  '<': 'sub-cycle',
  '>': 'sub-cycle off',
};

export default function ShortcutsDialog() {
  const closeModal = useAppStore((state) => state.closeModal);
  const currentBindings = useAppStore((state) => state.shortcuts);
  const setShortcuts = useAppStore((state) => state.setShortcuts);
  const notify = useAppStore((state) => state.notify);
  const { t } = useI18n();
  const [draft, setDraft] = useState<Record<string, string[]>>(() => Object.fromEntries(
    Object.entries(currentBindings).map(([id, keys]) => [id, [...keys]]),
  ));
  const [query, setQuery] = useState('');
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [category, setCategory] = useState<string>('All');
  const captureRef = useRef<HTMLInputElement>(null);
  const conflicts = useMemo(() => findShortcutConflicts(draft), [draft]);
  const conflictActionIds = useMemo(() => new Set(conflicts.flatMap((conflict) => conflict.actionIds)), [conflicts]);

  useEffect(() => {
    if (capture) {
      captureRef.current?.focus();
    }
  }, [capture]);

  const filteredActions = SHORTCUT_ACTIONS.filter((action) => {
    if (category !== 'All' && action.category !== category) return false;
    if (!query.trim()) return true;
    const haystack = `${t(action.label)} ${t(action.category)} ${action.label} ${action.category} ${draft[action.id]?.join(' ')}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const grouped = categoryOrder()
    .map((group) => ({ group, actions: filteredActions.filter((action) => action.category === group) }))
    .filter((entry) => entry.actions.length > 0);

  function setBindings(actionId: string, keys: string[]) {
    setDraft((current) => ({ ...current, [actionId]: keys }));
  }

  function onCaptureKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!capture) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCapture(null);
      return;
    }
    const normalized = normalizeKeyEvent(event.nativeEvent);
    if (!normalized) return;
    event.preventDefault();
    event.stopPropagation();
    const actionId = capture.actionId;
    const current = draft[actionId] || [];
    let next: string[];
    if (capture.slot === 'new') {
      next = [...current, normalized].slice(0, 2);
    } else {
      next = current.map((key, index) => (index === capture.slot ? normalized : key));
    }
    setBindings(actionId, [...new Set(next)]);
    setCapture(null);
  }

  function removeBinding(actionId: string, index: number) {
    const current = draft[actionId] || [];
    setBindings(actionId, current.filter((_, slot) => slot !== index));
  }

  function applyPreset(name: string) {
    const preset = SHORTCUT_PRESETS[name];
    if (!preset) return;
    setDraft(Object.fromEntries(Object.entries(preset.bindings).map(([id, keys]) => [id, [...keys]])));
    setCapture(null);
    notify(t('Loaded “{name}” preset into the editor', { name: t(preset.label) }), 'info');
  }

  function save() {
    if (conflicts.length > 0) return;
    setShortcuts(draft);
    closeModal();
    notify('Keyboard shortcuts updated', 'success');
  }

  return (
    <Dialog
      title={t('Keyboard shortcuts')}
      subtitle={t('A complete, remappable shortcut reference')}
      icon={<Keyboard size={19} />}
      onClose={closeModal}
      width="xl"
      className="shortcuts-dialog"
      footer={(
        <>
          <span className={`conflict-summary ${conflicts.length > 0 ? 'bad' : 'ok'}`}>
            {conflicts.length > 0
              ? <><AlertTriangle size={14} /> {t('{count} key conflict(s) need attention', { count: conflicts.length })}</>
              : <><Check size={14} /> {t('All bindings are unambiguous')}</>}
          </span>
          <div className="footer-spacer" />
          <button type="button" className="button ghost" onClick={() => setDraft(Object.fromEntries(Object.entries(DEFAULT_BINDINGS).map(([id, keys]) => [id, [...keys]])))}>
            <RotateCcw size={14} /> {t('Defaults')}
          </button>
          <button type="button" className="button ghost" onClick={closeModal}>{t('Cancel')}</button>
          <button type="button" className="button primary" onClick={save} disabled={conflicts.length > 0}>
            {t('Apply shortcuts')}
          </button>
        </>
      )}
    >
      <div className="shortcut-toolbar">
        <div className="preset-row">
          <Sparkles size={14} />
          <span className="toolbar-label">{t('Preset')}</span>
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) applyPreset(event.target.value);
              event.target.value = '';
            }}
          >
            <option value="" disabled>{t('Load a preset…')}</option>
            {Object.entries(SHORTCUT_PRESETS).map(([id, preset]) => (
              <option key={id} value={id}>{t(preset.label)}</option>
            ))}
          </select>
        </div>
        <div className="shortcut-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Filter actions or keys…')}
            aria-label={t('Filter shortcuts')}
          />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>{t('Resolve these conflicts before saving')}</strong>
            <ul>
              {conflicts.map((conflict) => (
                <li key={conflict.key}>
                  <kbd>{displayKey(conflict.key)}</kbd>
                  <span>{conflict.actionIds.map((id) => {
                    const action = shortcutAction(id);
                    return action ? t(action.label) : id;
                  }).join('  /  ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="shortcut-layout">
        <nav className="shortcut-categories" aria-label={t('Shortcut categories')}>
          {['All', ...categoryOrder()].map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {t(item)}
              {item === 'All' && <em>{SHORTCUT_ACTIONS.length}</em>}
            </button>
          ))}
        </nav>
        <div className="shortcut-table-wrap">
          {grouped.map((group) => (
            <section key={group.group} className="shortcut-section">
              <h3>{t(group.group)}</h3>
              <div className="shortcut-grid">
                {group.actions.map((action) => {
                  const keys = draft[action.id] || [];
                  const hasConflict = conflictActionIds.has(action.id);
                  return (
                    <div className={`shortcut-row ${hasConflict ? 'conflict' : ''}`} key={action.id}>
                      <div className="shortcut-label">
                        <span>{t(action.label)}</span>
                        {action.id.startsWith('signal.') || action.id.startsWith('canvas.') ? <em>{action.id}</em> : null}
                      </div>
                      <div className="shortcut-keys">
                        {keys.map((key, index) => (
                          <span className="key-chip" key={`${key}-${index}`}>
                            <kbd>{displayKey(key)}</kbd>
                            <button
                              type="button"
                              aria-label={t('Remove {key} from {action}', { key: displayKey(key), action: t(action.label) })}
                              onClick={() => removeBinding(action.id, index)}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        {capture?.actionId === action.id ? (
                          <input
                            ref={captureRef}
                            className="key-capture"
                            value=""
                            placeholder={t('Press keys…')}
                            aria-label={t('Press a new shortcut for {action}', { action: t(action.label) })}
                            onChange={() => undefined}
                            onKeyDown={onCaptureKeyDown}
                            onBlur={() => {
                              window.setTimeout(() => setCapture((current) => (current?.actionId === action.id ? null : current)), 80);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="add-binding"
                            disabled={keys.length >= 2}
                            title={keys.length >= 2 ? t('Remove a shortcut first') : t('Add a shortcut')}
                            onClick={() => setCapture({ actionId: action.id, slot: 'new' })}
                          >
                            {t('+ key')}
                          </button>
                        )}
                        {hasConflict && <AlertTriangle size={13} className="row-conflict-icon" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {grouped.length === 0 && <div className="empty-shortcuts">{t('No shortcuts match “{query}”.', { query })}</div>}
        </div>
      </div>

      <div className="char-cheatsheet">
        <div className="char-cheatsheet-title"><Command size={14} /> {t('WaveDrom character reference')}</div>
        <div className="char-grid">
          {WAVE_CHAR_LIST.map((char) => (
            <div className="char-cell" key={char}>
              <kbd>{char}</kbd>
              <span>{t(CHAR_LABELS[char] || 'wave')}</span>
            </div>
          ))}
        </div>
        <p>{t('Drawing keys work when the waveform has focus and no dialog or text field is active. Shift+letter is used for uppercase clock marks (P, N, L, H).')}</p>
      </div>
    </Dialog>
  );
}
