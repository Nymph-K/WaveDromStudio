import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FilePlus2, Layers3, Library, X } from 'lucide-react';
import { EXAMPLES, useAppStore } from '../state/appStore';
import { useI18n } from '../lib/useI18n';

export default function TabsBar() {
  const docs = useAppStore((state) => state.docs);
  const activeId = useAppStore((state) => state.activeId);
  const setActive = useAppStore((state) => state.setActiveDocument);
  const requestCloseDocument = useAppStore((state) => state.requestCloseDocument);
  const newDocument = useAppStore((state) => state.newDocument);
  const renameDocument = useAppStore((state) => state.renameDocument);
  const { t } = useI18n();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const examplesRef = useRef<HTMLDivElement>(null);
  const examplesButtonRef = useRef<HTMLButtonElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    const tab = tabScrollRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`);
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  useEffect(() => {
    if (!examplesOpen) return;
    const close = (event: PointerEvent) => {
      if (examplesRef.current?.contains(event.target as Node)) return;
      setExamplesOpen(false);
    };
    const onResize = () => setExamplesOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', onResize);
    };
  }, [examplesOpen]);

  function commitRename() {
    if (!editing) return;
    renameDocument(editing.id, editing.value);
    setEditing(null);
  }

  function openExamples() {
    if (!examplesOpen) {
      const rect = examplesButtonRef.current?.getBoundingClientRect();
      if (rect) {
        const width = Math.min(438, window.innerWidth - 16);
        const x = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setMenuPos({ x, y: rect.bottom + 6 });
      }
    }
    setExamplesOpen((open) => !open);
  }

  return (
    <div className="tabsbar">
      <div
        className="tabs-scroll"
        ref={tabScrollRef}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && tabScrollRef.current) {
            tabScrollRef.current.scrollLeft += event.deltaY;
          }
        }}
      >
        {docs.map((doc, index) => {
          const active = doc.id === activeId;
          return (
            <div
              className={`document-tab ${active ? 'active' : ''} ${doc.parseError ? 'has-error' : ''} ${doc.dirty ? 'has-unsaved' : ''}`}
              key={doc.id}
              data-tab-id={doc.id}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  requestCloseDocument(doc.id);
                }
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setEditing({ id: doc.id, value: doc.name });
              }}
            >
              <div
                className="tab-main"
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => setActive(doc.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActive(doc.id);
                  }
                }}
                title={doc.dirty ? `${doc.name} · ${t('Unsaved')}` : doc.name}
              >
                <span className="tab-index">{String(index + 1).padStart(2, '0')}</span>
                {editing?.id === doc.id ? (
                  <input
                    ref={editInputRef}
                    className="tab-rename"
                    value={editing.value}
                    onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditing(null);
                      }
                    }}
                  />
                ) : (
                  <span className="tab-name">{doc.name}</span>
                )}
                {doc.dirty && <i className="tab-unsaved-dot" title={t('Unsaved changes')} />}
                {doc.parseError && <i className="tab-error-dot" title={t('JSON error')} />}
              </div>
              <button
                type="button"
                className="tab-close"
                aria-label={t('Close {name}', { name: doc.name })}
                onClick={(event) => {
                  event.stopPropagation();
                  requestCloseDocument(doc.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="tabs-tools">
        <button type="button" className="tabs-add" onClick={() => newDocument()} title={t('New tab (Ctrl+N)')}>
          <FilePlus2 size={14} />
        </button>
        <div className="examples-wrap" ref={examplesRef}>
          <button
            ref={examplesButtonRef}
            type="button"
            className={`examples-button ${examplesOpen ? 'active' : ''}`}
            onClick={openExamples}
            title={t('Examples')}
          >
            <Library size={14} />
            <span>{t('Examples')}</span>
            <ChevronDown size={12} />
          </button>
          {examplesOpen && menuPos && (
            <div className="examples-menu" style={{ left: menuPos.x, top: menuPos.y }}>
              <div className="examples-menu-head">
                <Layers3 size={15} />
                <div>
                  <strong>{t('Example gallery')}</strong>
                  <span>{t('Core WaveDrom scenarios, ready to edit')}</span>
                </div>
              </div>
              <div className="examples-list">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.id}
                    type="button"
                    className="example-item"
                    onClick={() => {
                      setExamplesOpen(false);
                      newDocument(t(example.title), example.source);
                    }}
                  >
                    <span className="example-thumb" aria-hidden="true">
                      <i /><i /><i /><i />
                    </span>
                    <span className="example-copy">
                      <strong>{t(example.title)}</strong>
                      <em>{t(example.description)}</em>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
