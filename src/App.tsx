import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Braces, Sparkles, Waves } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import Header from './components/Header';
import TabsBar from './components/TabsBar';
import CommandBar from './components/CommandBar';
import WavePane from './components/WavePane';
import EditorPane from './components/EditorPane';
import StatusBar from './components/StatusBar';
import ModalHost from './components/ModalHost';
import Toasts from './components/Toasts';
import { useAppStore } from './state/appStore';
import { clearShareParam } from './lib/share';
import { bindingsToKeyMap, normalizeKeyEvent, shortcutAction } from './lib/shortcuts';
import { copyShareLink, exportDiagram, openFilePicker, saveWaveJson } from './lib/fileActions';
import { WAVE_CHAR_LIST } from './model/waveModel';
import { useI18n } from './lib/useI18n';
import './actions.css';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .cm-editor'));
}

function actionIsGlobal(actionId: string): boolean {
  const action = shortcutAction(actionId);
  if (action?.global) return true;
  return (
    actionId.startsWith('file.') ||
    actionId.startsWith('view.') ||
    actionId.startsWith('tab.') ||
    actionId.startsWith('help.') ||
    actionId === 'edit.undo' ||
    actionId === 'edit.redo' ||
    actionId === 'edit.format'
  );
}

export default function App() {
  const { docs, activeId, viewMode, theme, language, modal, splitRatio } = useAppStore(useShallow((state) => ({
    docs: state.docs,
    activeId: state.activeId,
    viewMode: state.viewMode,
    theme: state.theme,
    language: state.language,
    modal: state.modal,
    splitRatio: state.splitRatio,
  })));
  const shortcuts = useAppStore((state) => state.shortcuts);
  const activeDoc = useMemo(() => docs.find((doc) => doc.id === activeId) || docs[0], [docs, activeId]);
  const isNarrow = useMediaQuery('(max-width: 980px)');
  const { t } = useI18n();
  const [mobilePane, setMobilePane] = useState<'wave' | 'editor'>(() => (viewMode === 'editor' ? 'editor' : 'wave'));
  const workbenchRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    document.title = `${activeDoc?.name || 'Untitled'} · WaveDrom Studio`;
  }, [activeDoc?.name]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const state = useAppStore.getState();
      if (state.preferences.confirmClose && state.docs.some((doc) => doc.dirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (useAppStore.getState().bootedFromShare) {
      clearShareParam();
      useAppStore.getState().notify('Shared diagram opened — edits stay in this browser', 'success');
    }
  }, []);

  const showWave = !isNarrow ? viewMode !== 'editor' : mobilePane === 'wave';
  const showEditor = !isNarrow ? viewMode !== 'wave' : mobilePane === 'editor';
  const isSplit = !isNarrow && (viewMode === 'split-v' || viewMode === 'split-h');
  const splitHorizontally = viewMode === 'split-v';
  const workbenchClass = isNarrow ? 'narrow' : viewMode === 'split-h' ? 'stacked' : viewMode === 'split-v' ? 'side-by-side' : 'single-pane';

  useEffect(() => {
    const keyMap = bindingsToKeyMap(shortcuts);
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (modal) return;
      if (event.isComposing) return;
      const targetIsEditable = isEditableTarget(event.target);
      const normalized = normalizeKeyEvent(event);

      if (event.key === 'Escape' && !targetIsEditable) {
        const current = useAppStore.getState();
        const doc = current.docs.find((item) => item.id === current.activeId);
        if (doc?.insertMode) {
          current.setInsertMode(doc.id, false);
          current.notify('Insert mode off', 'info');
          event.preventDefault();
          return;
        }
      }

      const actionIds = normalized ? keyMap.get(normalized) || [] : [];
      let actionId: string | undefined;
      for (const candidate of actionIds) {
        if (targetIsEditable && !actionIsGlobal(candidate)) continue;
        actionId = candidate;
        break;
      }

      if (actionId) {
        event.preventDefault();
        event.stopPropagation();
        void executeAction(actionId);
        return;
      }

      if (targetIsEditable) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (!WAVE_CHAR_LIST.includes(event.key)) return;
      if (!showWave) return;
      useAppStore.getState().paintCharacter(event.key);
      event.preventDefault();
      event.stopPropagation();
    };

    async function executeAction(actionId: string) {
      const state = useAppStore.getState();
      const currentDoc = state.docs.find((item) => item.id === state.activeId) || state.docs[0];
      if (!currentDoc) return;
      switch (actionId) {
        case 'file.new':
          state.newDocument();
          return;
        case 'file.open':
          openFilePicker();
          return;
        case 'file.saveJson':
          saveWaveJson(currentDoc);
          return;
        case 'file.share':
          await copyShareLink(currentDoc);
          return;
        case 'file.exportSvg':
          await exportDiagram(currentDoc, state.theme, 'svg');
          return;
        case 'file.exportPng':
          await exportDiagram(currentDoc, state.theme, 'png');
          return;
        case 'edit.undo':
          state.undo(currentDoc.id);
          return;
        case 'edit.redo':
          state.redo(currentDoc.id);
          return;
        case 'edit.copy':
          if (!showWave) return;
          await state.copySelection(currentDoc.id);
          return;
        case 'edit.cut':
          if (!showWave) return;
          await state.cutSelection(currentDoc.id);
          return;
        case 'edit.paste':
          if (!showWave) return;
          await state.pasteClipboard(currentDoc.id);
          return;
        case 'edit.selectAll':
          if (!showWave) return;
          state.selectAllCells(currentDoc.id);
          return;
        case 'edit.format':
          state.formatDocument(currentDoc.id);
          return;
        case 'edit.find': {
          if (viewMode === 'wave' && !isNarrow) state.setViewMode('split-v');
          if (isNarrow) setMobilePane('editor');
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('wds:editor-find')), 140);
          return;
        }
        case 'canvas.deleteCycles':
          if (!showWave) return;
          state.deleteSelectedCycles(currentDoc.id);
          return;
        case 'canvas.clearCells':
          if (!showWave) return;
          state.clearSelectedCells(currentDoc.id);
          return;
        case 'canvas.insertBefore':
          if (!showWave) return;
          state.insertCycle('before', currentDoc.id);
          return;
        case 'canvas.insertAfter':
          if (!showWave) return;
          state.insertCycle('after', currentDoc.id);
          return;
        case 'canvas.insertMode':
          if (!showWave) return;
          state.toggleInsertMode(currentDoc.id);
          return;
        case 'canvas.editName':
          if (!showWave) return;
          if (viewMode === 'editor' && !isNarrow) state.setViewMode('split-v');
          if (isNarrow) setMobilePane('wave');
          window.setTimeout(() => window.dispatchEvent(new CustomEvent('wds:edit-name')), 140);
          return;
        case 'canvas.properties':
          if (!showWave) return;
          state.openModal('signal-properties', { row: currentDoc.activeCell.row });
          return;
        case 'nav.left':
        case 'nav.right':
        case 'nav.up':
        case 'nav.down':
        case 'nav.extendLeft':
        case 'nav.extendRight':
        case 'nav.extendUp':
        case 'nav.extendDown': {
          if (!showWave) return;
          const direction: Record<string, [number, number, boolean]> = {
            'nav.left': [0, -1, false],
            'nav.right': [0, 1, false],
            'nav.up': [-1, 0, false],
            'nav.down': [1, 0, false],
            'nav.extendLeft': [0, -1, true],
            'nav.extendRight': [0, 1, true],
            'nav.extendUp': [-1, 0, true],
            'nav.extendDown': [1, 0, true],
          };
          const [dRow, dCol, extend] = direction[actionId];
          state.navigateSelection(currentDoc.id, dRow, dCol, extend);
          return;
        }
        case 'nav.rowStart':
          if (!showWave) return;
          state.jumpSelection(currentDoc.id, 'start');
          return;
        case 'nav.rowEnd':
          if (!showWave) return;
          state.jumpSelection(currentDoc.id, 'end');
          return;
        case 'nav.selectRow':
          if (!showWave) return;
          state.selectRow(currentDoc.id, currentDoc.activeCell.row, 'replace');
          return;
        case 'signal.add':
          state.addSignal(currentDoc.id);
          if (showWave) {
            window.setTimeout(() => window.dispatchEvent(new CustomEvent('wds:edit-name')), 140);
          }
          return;
        case 'signal.insertAbove':
          state.insertSignal('above', currentDoc.id);
          return;
        case 'signal.insertBelow':
          state.insertSignal('below', currentDoc.id);
          return;
        case 'signal.addEmpty':
          state.addEmptyRow(currentDoc.id);
          return;
        case 'signal.duplicate':
          state.duplicateSignals(currentDoc.id);
          return;
        case 'signal.delete':
          state.deleteSelectedSignals(currentDoc.id);
          return;
        case 'signal.moveUp':
          state.moveSignals(-1, currentDoc.id);
          return;
        case 'signal.moveDown':
          state.moveSignals(1, currentDoc.id);
          return;
        case 'signal.group':
          state.openModal('group-name');
          return;
        case 'signal.ungroup':
          state.ungroupSelection(currentDoc.id);
          return;
        case 'signal.fitClocks':
          state.fitClocksToLongest(currentDoc.id);
          return;
        case 'view.waveOnly':
          state.setViewMode('wave');
          if (isNarrow) setMobilePane('wave');
          return;
        case 'view.editorOnly':
          state.setViewMode('editor');
          if (isNarrow) setMobilePane('editor');
          return;
        case 'view.splitSide':
          state.setViewMode('split-v');
          return;
        case 'view.splitStacked':
          state.setViewMode('split-h');
          return;
        case 'view.zoomIn':
          state.zoomStep(currentDoc.id, 1);
          return;
        case 'view.zoomOut':
          state.zoomStep(currentDoc.id, -1);
          return;
        case 'view.zoomReset':
          state.resetZoom(currentDoc.id);
          return;
        case 'view.theme':
          state.toggleTheme();
          return;
        case 'view.settings':
          state.openModal('diagram-settings');
          return;
        case 'tab.close':
          state.requestCloseDocument(currentDoc.id);
          return;
        case 'tab.next':
        case 'tab.prev': {
          const index = state.docs.findIndex((doc) => doc.id === currentDoc.id);
          const delta = actionId === 'tab.next' ? 1 : -1;
          const nextIndex = (index + delta + state.docs.length) % state.docs.length;
          state.setActiveDocument(state.docs[nextIndex].id);
          return;
        }
        case 'help.shortcuts':
          state.openModal('shortcuts');
          return;
        default:
          state.notify(`Shortcut action “${actionId}” is not available in this context.`, 'info');
      }
    }

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isNarrow, showWave, viewMode, shortcuts, modal]);

  function startSplitDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const workbench = workbenchRef.current;
    if (!workbench) return;
    document.body.classList.add('resizing-layout');
    document.body.style.userSelect = 'none';
    const rect = workbench.getBoundingClientRect();
    const horizontal = viewMode === 'split-v';
    const onMove = (pointer: PointerEvent) => {
      const ratio = horizontal
        ? (pointer.clientX - rect.left) / Math.max(1, rect.width)
        : (pointer.clientY - rect.top) / Math.max(1, rect.height);
      useAppStore.getState().setSplitRatio(ratio);
    };
    const onUp = () => {
      document.body.classList.remove('resizing-layout');
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const paneStyle = isSplit ? { flexBasis: `${splitRatio * 100}%` } : undefined;

  return (
    <div className={`app-shell ${isNarrow ? 'is-narrow' : ''}`} data-theme={theme}>
      <Header />
      <TabsBar />
      <CommandBar />
      {isNarrow && (
        <div className="mobile-pane-switch" role="tablist" aria-label={t('Workspace pane')}>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'wave'}
            className={mobilePane === 'wave' ? 'active' : ''}
            onClick={() => setMobilePane('wave')}
          >
            <Waves size={14} /> {t('Waveform')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'editor'}
            className={mobilePane === 'editor' ? 'active' : ''}
            onClick={() => setMobilePane('editor')}
          >
            <Braces size={14} /> WaveJSON
          </button>
          <span className="mobile-pane-note">
            <Sparkles size={12} /> {t('Single-column mode')}
          </span>
        </div>
      )}
      <main className={`workbench ${workbenchClass}`} ref={workbenchRef}>
        {showWave && (
          <div className={`pane-host wave-host ${isSplit ? 'sized' : ''}`} style={paneStyle}>
            <WavePane />
          </div>
        )}
        {showWave && showEditor && isSplit && (
          <div
            className={`split-handle ${splitHorizontally ? 'vertical' : 'horizontal'}`}
            onPointerDown={startSplitDrag}
            role="separator"
            aria-orientation={splitHorizontally ? 'vertical' : 'horizontal'}
            aria-label={t('Resize waveform and editor panes')}
            title={t('Drag to resize panes')}
          >
            <span><i /><i /><i /></span>
          </div>
        )}
        {showEditor && (
          <div className={`pane-host editor-host ${isSplit ? 'grow' : ''}`}>
            <EditorPane />
          </div>
        )}
      </main>
      <StatusBar />
      <ModalHost />
      <Toasts />
    </div>
  );
}
