import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileCode2,
  FileJson,
  FilePlus2,
  FolderOpen,
  Image,
  Info,
  Keyboard,
  Moon,
  Settings2,
  Share2,
  Sun,
  WandSparkles,
} from 'lucide-react';
import { useAppStore } from '../state/appStore';
import { copyShareLink, exportDiagram, openFilePicker, saveWaveJson } from '../lib/fileActions';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../lib/useI18n';

export default function Header() {
  const { docs, activeId, theme, language } = useAppStore(useShallow((state) => ({
    docs: state.docs,
    activeId: state.activeId,
    theme: state.theme,
    language: state.language,
  })));
  const activeDoc = docs.find((doc) => doc.id === activeId) || docs[0];
  const newDocument = useAppStore((state) => state.newDocument);
  const openModal = useAppStore((state) => state.openModal);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const notify = useAppStore((state) => state.notify);
  const { t } = useI18n();
  const [exportOpen, setExportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openFile = () => fileRef.current?.click();
    window.addEventListener('wds-open-file', openFile);
    return () => window.removeEventListener('wds-open-file', openFile);
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (event: PointerEvent) => {
      if (exportRef.current?.contains(event.target as Node)) return;
      setExportOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [exportOpen]);

  function handleExport(format: 'svg' | 'png') {
    setExportOpen(false);
    if (activeDoc) void exportDiagram(activeDoc, theme, format);
  }

  function handleSave() {
    setExportOpen(false);
    if (activeDoc) saveWaveJson(activeDoc);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const result = useAppStore.getState().openSourceDocument(file.name, text);
      if (!result.ok) notify(`${file.name}: ${result.error || t('Invalid WaveJSON')}`, 'error');
    } catch {
      notify(t('Could not open file'), 'error');
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 34 34" fill="none">
              <path d="M3 19h6v-9h7v16h7V9h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="3" cy="19" r="1.8" fill="currentColor" />
              <circle cx="31" cy="9" r="1.8" fill="currentColor" />
            </svg>
          </div>
          <div className="brand-copy">
            <span className="brand-name">WaveDrom <strong>Studio</strong></span>
            <span className="brand-sub">{t('Visual WaveJSON editor')}</span>
          </div>
          <span className="engine-pill">web</span>
        </div>

        <div className="header-file-actions">
          <button type="button" className="header-button" onClick={() => newDocument()} title={t('New document (Ctrl+N)')}>
            <FilePlus2 size={15} />
            <span>{t('New')}</span>
          </button>
          <button type="button" className="header-button" onClick={openFilePicker} title={t('Open JSON / JSON5 (Ctrl+O)')}>
            <FolderOpen size={15} />
            <span>{t('Open')}</span>
          </button>
          <button type="button" className="header-button hide-narrow" onClick={() => activeDoc && saveWaveJson(activeDoc)} title={t('Download WaveJSON (Ctrl+S)')}>
            <Download size={15} />
            <span>{t('Save')}</span>
          </button>
          <div className="export-wrap" ref={exportRef}>
            <button
              type="button"
              className={`header-button ${exportOpen ? 'pressed' : ''}`}
              onClick={() => setExportOpen((open) => !open)}
              title={t('Export diagram')}
            >
              <Download size={15} />
              <span>{t('Export')}</span>
              <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="header-menu">
                <button type="button" onClick={() => handleExport('svg')}>
                  <FileJson size={15} />
                  <span><strong>SVG</strong><em>{t('Vector, identical to canvas')}</em></span>
                  <kbd>Ctrl+Shift+E</kbd>
                </button>
                <button type="button" onClick={() => handleExport('png')}>
                  <Image size={15} />
                  <span><strong>PNG</strong><em>{t('3× resolution raster')}</em></span>
                </button>
                <div className="menu-sep" />
                <button type="button" onClick={handleSave}>
                  <FileCode2 size={15} />
                  <span><strong>{t('WaveJSON file')}</strong><em>{t('Download editable source')}</em></span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="header-spacer" />

        <span className={`autosave-indicator hide-narrow ${activeDoc?.dirty ? 'dirty' : ''}`}>
          <i />
          {activeDoc?.dirty ? t('Unsaved') : t('Draft autosaved')}
        </span>

        <div className="header-utility">
          <button
            type="button"
            className="icon-button header-icon"
            onClick={() => activeDoc && void copyShareLink(activeDoc)}
            title={t('Copy editable share link')}
            aria-label={t('Copy share link')}
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            className="icon-button header-icon language-toggle"
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            title={language === 'zh' ? t('Switch to English') : t('Switch to Chinese')}
            aria-label={t('Interface language')}
          >
            {language === 'zh' ? 'EN' : '中'}
          </button>
          <button
            type="button"
            className="icon-button header-icon"
            onClick={toggleTheme}
            title={t('Toggle light / dark theme')}
            aria-label={t('Toggle light / dark theme')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="icon-button header-icon"
            onClick={() => openModal('preferences')}
            title={t('Preferences')}
            aria-label={t('Preferences')}
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            className="icon-button header-icon hide-medium"
            onClick={() => openModal('diagram-settings')}
            title={t('Diagram settings')}
            aria-label={t('Diagram settings')}
          >
            <WandSparkles size={16} />
          </button>
          <button
            type="button"
            className="icon-button header-icon"
            onClick={() => openModal('shortcuts')}
            title={t('Keyboard shortcuts')}
            aria-label={t('Keyboard shortcuts')}
          >
            <Keyboard size={16} />
          </button>
          <button
            type="button"
            className="icon-button header-icon hide-narrow"
            onClick={() => openModal('about')}
            title={t('About WaveDrom Studio')}
            aria-label={t('About')}
          >
            <Info size={16} />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.json5,.txt,application/json"
          className="visually-hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </header>
    </>
  );
}
