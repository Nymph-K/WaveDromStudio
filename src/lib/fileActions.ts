import type { EditorDoc, ThemeMode } from '../types';
import {
  downloadBlob,
  renderPngFromSvg,
  renderWaveDrom,
  safeFilename,
  serializeSvgElement,
} from '../renderer/wavedromEngine';
import { buildShareUrl } from './share';
import { writeClipboard } from './clipboard';
import { useAppStore } from '../state/appStore';
import { translate } from '../i18n';

function downloadText(text: string, filename: string, type = 'application/json') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

export function saveWaveJson(doc: EditorDoc) {
  const store = useAppStore.getState();
  const extension = doc.parseError ? 'json5' : 'json';
  downloadText(doc.source.endsWith('\n') ? doc.source : `${doc.source}\n`, safeFilename(doc.name, extension));
  store.markDocumentSaved(doc.id);
  store.notify(translate(store.language, 'Downloaded {name}', { name: safeFilename(doc.name, extension) }), 'success');
}

export async function copyShareLink(doc: EditorDoc) {
  const store = useAppStore.getState();
  if (doc.parseError) {
    store.notify('Fix the JSON error before sharing this diagram.', 'warning');
    return;
  }
  const url = buildShareUrl({ v: 1, name: doc.name, source: doc.source });
  const result = await writeClipboard(url);
  if (result.system) {
    store.notify('Editable share link copied to the clipboard', 'success');
  } else {
    store.notify('Copy was blocked by the browser. The share link has been placed in the in-app clipboard.', 'warning');
  }
}

export async function exportDiagram(doc: EditorDoc, theme: ThemeMode, format: 'svg' | 'png') {
  const store = useAppStore.getState();
  const rendered = renderWaveDrom(doc.data, { darkTheme: theme === 'dark' });
  if (!rendered.ok || !rendered.svg) {
    store.notify(rendered.error || 'Could not render the diagram for export.', 'error');
    return;
  }
  try {
    if (format === 'svg') {
      const source = serializeSvgElement(rendered.svg);
      downloadBlob(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), safeFilename(doc.name, 'svg'));
      store.notify('SVG exported', 'success');
    } else {
      const png = await renderPngFromSvg(rendered.svg, 3);
      downloadBlob(png, safeFilename(doc.name, 'png'));
      store.notify('PNG exported at 3× resolution', 'success');
    }
  } catch (error) {
    store.notify(error instanceof Error ? error.message : 'Export failed', 'error');
  }
}

export function openFilePicker() {
  window.dispatchEvent(new CustomEvent('wds-open-file'));
}
