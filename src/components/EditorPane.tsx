import { AlertCircle, Braces, CheckCircle2, Copy, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useAppStore } from '../state/appStore';
import JsonEditor from './JsonEditor';
import { writeClipboard } from '../lib/clipboard';
import { useI18n } from '../lib/useI18n';

export default function EditorPane() {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === state.activeId) || state.docs[0]);
  const formatDocument = useAppStore((state) => state.formatDocument);
  const notify = useAppStore((state) => state.notify);
  const { t } = useI18n();
  if (!doc) return null;
  const lineCount = doc.source.split('\n').length;
  const state = doc.parseError ? 'error' : doc.pendingParse ? 'pending' : 'live';

  async function copySource() {
    await writeClipboard(doc.source);
    notify('WaveJSON copied to the clipboard', 'success');
  }

  const errorLocation = doc.parseError?.line != null
    ? doc.parseError.column != null
      ? t('Line {line}, column {column}', { line: doc.parseError.line, column: doc.parseError.column })
      : t('Line {line}', { line: doc.parseError.line })
    : t('Invalid WaveJSON');

  return (
    <section className="pane editor-pane" aria-label={t('WaveJSON editor')}>
      <div className="pane-toolbar editor-toolbar">
        <div className="pane-title-group editor-title-group">
          <div className="pane-eyebrow">
            <span className="pane-kicker"><Braces size={11} /> WAVEJSON</span>
            <span className="pane-meta">{t('JSON5 accepted')}</span>
          </div>
          <div className="doc-title-row">
            <h2>{t('Source')}</h2>
            <span className={`live-badge ${state}`}>
              {state === 'error' ? <AlertCircle size={11} /> : state === 'pending' ? <LoaderCircle size={11} /> : <CheckCircle2 size={11} />}
              {state === 'error' ? t('Error') : state === 'pending' ? t('Parsing') : t('Live')}
            </span>
            <span className="editor-file-label">{doc.name}.json</span>
          </div>
        </div>
        <div className="pane-toolbar-spacer" />
        <div className="editor-actions">
          <button type="button" className="pane-action" onClick={() => formatDocument(doc.id)} title={t('Format JSON (Ctrl+Shift+F)')}>
            <Sparkles size={13} />
            <span>{t('Format')}</span>
          </button>
          <button
            type="button"
            className="pane-action"
            onClick={() => window.dispatchEvent(new CustomEvent('wds:editor-find'))}
            title={t('Find in editor (Ctrl+F)')}
          >
            <Search size={13} />
            <span className="action-label-wide">{t('Find')}</span>
          </button>
          <button type="button" className="pane-action" onClick={() => void copySource()} title={t('Copy the source')}>
            <Copy size={13} />
            <span className="action-label-wide">{t('Copy')}</span>
          </button>
        </div>
      </div>
      {doc.parseError && (
        <div className="editor-error-banner" role="alert">
          <AlertCircle size={15} />
          <div>
            <strong>{errorLocation}</strong>
            <span>{doc.parseError.message.replace(/^JSON5:\s*/, '')}</span>
            <em>{t('The waveform is showing the last valid document.')}</em>
          </div>
        </div>
      )}
      <div className="editor-body">
        <JsonEditor key={doc.id} doc={doc} />
      </div>
      <div className="editor-foot">
        <span>{t('{count} lines', { count: lineCount })}</span>
        <span>{t('{count} chars', { count: doc.source.length.toLocaleString() })}</span>
        <span className="editor-foot-spacer" />
        <span>JSON · JSON5</span>
        <span>UTF-8</span>
      </div>
    </section>
  );
}
