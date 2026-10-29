import {
  Columns2,
  Copy,
  Layers,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Redo2,
  Rows2,
  Scissors,
  Trash2,
  Undo2,
  Ungroup,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../state/appStore';
import type { ViewMode } from '../types';
import { displayKey } from '../lib/shortcuts';
import { useI18n } from '../lib/useI18n';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: typeof Columns2; hint: string }[] = [
  { id: 'wave', label: 'Wave', icon: PanelLeftClose, hint: 'Waveform only' },
  { id: 'split-v', label: 'Side by side', icon: Columns2, hint: 'Waveform + JSON side by side' },
  { id: 'split-h', label: 'Stacked', icon: Rows2, hint: 'Waveform above JSON' },
  { id: 'editor', label: 'JSON', icon: PanelRightClose, hint: 'WaveJSON editor only' },
];

export default function CommandBar() {
  const { doc, viewMode } = useAppStore(useShallow((state) => ({
    doc: state.docs.find((item) => item.id === state.activeId) || state.docs[0],
    viewMode: state.viewMode,
  })));
  const shortcuts = useAppStore((state) => state.shortcuts);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const openModal = useAppStore((state) => state.openModal);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const addSignal = useAppStore((state) => state.addSignal);
  const addEmptyRow = useAppStore((state) => state.addEmptyRow);
  const duplicateSignals = useAppStore((state) => state.duplicateSignals);
  const ungroupSelection = useAppStore((state) => state.ungroupSelection);
  const deleteSelectedSignals = useAppStore((state) => state.deleteSelectedSignals);
  const insertCycle = useAppStore((state) => state.insertCycle);
  const deleteSelectedCycles = useAppStore((state) => state.deleteSelectedCycles);
  const { t } = useI18n();
  if (!doc) return null;

  function shortcut(actionId: string): string {
    const key = shortcuts[actionId]?.[0];
    return key ? ` (${displayKey(key)})` : '';
  }

  function withHint(label: string, actionId: string): string {
    return `${t(label)}${shortcut(actionId)}`;
  }

  function disabled(actionId: string): boolean {
    if (actionId === 'edit.undo') return doc.history.past.length === 0;
    if (actionId === 'edit.redo') return doc.history.future.length === 0;
    return false;
  }

  return (
    <div className="command-bar">
      <div className="history-group">
        <button type="button" className="command-icon" onClick={() => undo(doc.id)} disabled={disabled('edit.undo')} title={withHint('Undo', 'edit.undo')} aria-label={t('Undo')}>
          <Undo2 size={15} />
        </button>
        <button type="button" className="command-icon" onClick={() => redo(doc.id)} disabled={disabled('edit.redo')} title={withHint('Redo', 'edit.redo')} aria-label={t('Redo')}>
          <Redo2 size={15} />
        </button>
      </div>
      <div className="command-divider" />
      <button type="button" className="command-button primary-soft" onClick={() => addSignal(doc.id)} title={withHint('Add signal at end', 'signal.add')}>
        <Plus size={14} />
        <span>{t('Signal')}</span>
      </button>
      <button type="button" className="command-button" onClick={() => addEmptyRow(doc.id)} title={t('Insert empty {} row')}>
        <span className="command-braces">{'{}'}</span>
        <span className="label-wide">{t('Empty row')}</span>
      </button>
      <button type="button" className="command-button" onClick={() => duplicateSignals(doc.id)} title={withHint('Duplicate selected signals', 'signal.duplicate')}>
        <Copy size={14} />
        <span className="label-wide">{t('Duplicate')}</span>
      </button>
      <button type="button" className="command-button" onClick={() => openModal('group-name')} title={withHint('Group selected signals…', 'signal.group')}>
        <Layers size={14} />
        <span className="label-wide">{t('Group')}</span>
      </button>
      <button type="button" className="command-button" onClick={() => ungroupSelection(doc.id)} title={withHint('Ungroup selected signals', 'signal.ungroup')}>
        <Ungroup size={14} />
        <span className="label-wide">{t('Ungroup')}</span>
      </button>
      <button type="button" className="command-icon danger-hover" onClick={() => deleteSelectedSignals(doc.id)} title={withHint('Delete selected signals', 'signal.delete')} aria-label={t('Delete signals')}>
        <Trash2 size={15} />
      </button>
      <div className="command-divider" />
      <button type="button" className="command-button" onClick={() => insertCycle('before', doc.id)} title={withHint('Insert cycle before selection', 'canvas.insertBefore')}>
        <Plus size={14} />
        <span className="label-wide">{t('Cycle')}</span>
      </button>
      <button type="button" className="command-button quiet-danger" onClick={() => deleteSelectedCycles(doc.id)} title={withHint('Delete selected cycles', 'canvas.deleteCycles')}>
        <Scissors size={14} />
        <span className="label-wide">{t('Delete cycles')}</span>
      </button>

      <div className="command-spacer" />

      <div className="view-switcher" role="group" aria-label={t('Workspace view')}>
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon;
          const actionId = option.id === 'wave' ? 'view.waveOnly' : option.id === 'editor' ? 'view.editorOnly' : option.id === 'split-v' ? 'view.splitSide' : 'view.splitStacked';
          return (
            <button
              key={option.id}
              type="button"
              className={viewMode === option.id ? 'active' : ''}
              onClick={() => setViewMode(option.id)}
              title={`${t(option.hint)}${shortcut(actionId)}`}
              aria-pressed={viewMode === option.id}
            >
              <Icon size={15} />
              <span className="view-label">{t(option.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
