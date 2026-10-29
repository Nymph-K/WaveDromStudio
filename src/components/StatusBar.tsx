import { AlertTriangle, Check, MousePointer2, Plus, Rows3, ZoomIn } from 'lucide-react';
import { useAppStore } from '../state/appStore';
import { flattenLanes, maxWaveWidth, normalizeSelection } from '../model/waveModel';
import { useI18n } from '../lib/useI18n';

export default function StatusBar() {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === state.activeId) || state.docs[0]);
  const viewMode = useAppStore((state) => state.viewMode);
  const { t } = useI18n();
  if (!doc) return null;
  const lanes = flattenLanes(doc.data);
  const sel = normalizeSelection(doc.selection);
  const activeLane = lanes[doc.activeCell.row];
  const char = activeLane?.item.wave?.[doc.activeCell.col] || '·';
  const selectedCells = (sel.row1 - sel.row0 + 1) * (sel.col1 - sel.col0 + 1);
  const signalName = activeLane?.item.name || (activeLane?.isSpacer ? t('empty row') : t('signal'));
  const errors = doc.parseError;
  const viewLabel = viewMode === 'split-v'
    ? t('side-by-side')
    : viewMode === 'split-h'
      ? t('stacked')
      : viewMode === 'wave'
        ? t('wave')
        : t('editor');

  return (
    <footer className="statusbar">
      <div className="status-cluster">
        <span className={`status-pill ${errors ? 'warning' : 'success'}`}>
          {errors ? <AlertTriangle size={11} /> : <Check size={11} />}
          {errors ? t('JSON invalid · last valid preview') : doc.pendingParse ? t('Parsing…') : t('Live sync')}
        </span>
        <span className="status-divider" />
        <span className="status-item">
          <MousePointer2 size={11} />
          <span className="status-strong">{signalName}</span>
          <span className="mono">
            {t('row')} {doc.activeCell.row + 1} · {t('col')} {doc.activeCell.col + 1} · “{char}”
          </span>
        </span>
      </div>
      <div className="status-cluster status-middle">
        <span className="status-item"><Rows3 size={11} /> {t('{count} selected', { count: selectedCells.toLocaleString() })}</span>
        <span className="status-divider" />
        <span className="status-item">{t('{lanes} lanes · {cycles} cycles', { lanes: lanes.length, cycles: maxWaveWidth(doc.data) })}</span>
        <span className="status-divider" />
        <span className="status-item">{t('view')}: {viewLabel}</span>
      </div>
      <div className="status-cluster status-right">
        {doc.insertMode && <span className="status-pill insert"><Plus size={11} /> {t('Insert mode')}</span>}
        <span className="status-item"><ZoomIn size={11} /> {Math.round(doc.zoom * 100)}%</span>
        <span className="status-divider" />
        <span className="status-engine">WaveDrom 3.8.0</span>
      </div>
    </footer>
  );
}
