import { useMemo, useState, type FormEvent } from 'react';
import { Settings2, Trash2 } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore } from '../../state/appStore';
import { dataLabels, flattenLanes, listGroups, WAVE_CHAR_LIST } from '../../model/waveModel';
import { useI18n } from '../../lib/useI18n';

export default function SignalPropertiesDialog({ row }: { row: number }) {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === state.activeId));
  const closeModal = useAppStore((state) => state.closeModal);
  const applyLaneProperties = useAppStore((state) => state.applyLaneProperties);
  const notify = useAppStore((state) => state.notify);
  const { t } = useI18n();
  const lane = doc ? flattenLanes(doc.data)[row] : undefined;
  const ancestors = lane?.groups.map((group) => group.name).filter(Boolean) || [];
  const groups = useMemo(() => (doc ? listGroups(doc.data).filter((group) => group.start <= row && group.end >= row) : []), [doc, row]);
  const [form, setForm] = useState(() => ({
    name: lane?.item.name || '',
    wave: lane?.item.wave || '',
    node: lane?.item.node || '',
    dataText: dataLabels(lane?.item).join('\n'),
    period: lane?.item.period != null ? String(lane.item.period) : '',
    phase: lane?.item.phase != null ? String(lane.item.phase) : '',
  }));

  if (!doc || !lane) return null;

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    for (const char of form.wave) {
      if (!WAVE_CHAR_LIST.includes(char)) {
        notify(t('“{char}” is not a WaveDrom waveform character', { char }), 'warning');
        return;
      }
    }
    const labels = form.dataText === ''
      ? []
      : form.dataText.split(/\r?\n/).map((line) => line.trim());
    const targetDoc = useAppStore.getState().docs.find((item) => item.id === doc?.id);
    if (!targetDoc) return;
    const ok = applyLaneProperties(targetDoc.id, row, {
      name: form.name.trim(),
      wave: form.wave,
      node: form.node,
      data: labels,
      period: form.period,
      phase: form.phase,
    });
    if (ok) closeModal();
  }

  return (
    <Dialog
      title={t('Signal properties')}
      subtitle={ancestors.length
        ? t('Row {row} · inside {groups}', { row: row + 1, groups: ancestors.join(' / ') })
        : t('Row {row}', { row: row + 1 })}
      icon={<Settings2 size={19} />}
      onClose={closeModal}
      width="md"
      footer={(
        <>
          <button
            type="button"
            className="button danger-ghost"
            onClick={() => {
              const state = useAppStore.getState();
              state.setSelection(doc.id, { row0: row, col0: 0, row1: row, col1: 0 }, [row]);
              state.deleteSelectedSignals(doc.id);
              closeModal();
            }}
          >
            <Trash2 size={14} /> {t('Delete signal')}
          </button>
          <div className="footer-spacer" />
          <button type="button" className="button ghost" onClick={closeModal}>{t('Cancel')}</button>
          <button type="button" className="button primary" onClick={() => submit()}>{t('Apply changes')}</button>
        </>
      )}
    >
      <form className="properties-form" onSubmit={submit}>
        <div className="form-row">
          <label className="field grow">
            <span className="field-label">{t('Name')}</span>
            <input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder={t('signal name')} />
          </label>
          {groups.length > 0 && (
            <div className="property-meta">
              <span className="meta-label">{t('Groups')}</span>
              <div className="meta-chips">
                {groups.map((group) => <span className="tiny-chip" key={group.path.join('.')}>{group.name || t('(unnamed)')}</span>)}
              </div>
            </div>
          )}
        </div>
        <label className="field">
          <span className="field-label">{t('Wave')} <span className="muted">wave</span></span>
          <input
            className="mono-input"
            value={form.wave}
            onChange={(event) => setField('wave', event.target.value)}
            placeholder="p......."
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('Data labels')} <span className="muted">{t('one per line')}</span></span>
          <textarea
            className="mono-input"
            rows={3}
            value={form.dataText}
            onChange={(event) => setField('dataText', event.target.value)}
            placeholder={'HEAD\nBODY\nTAIL'}
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('Nodes')} <span className="muted">node</span></span>
          <input
            className="mono-input"
            value={form.node}
            onChange={(event) => setField('node', event.target.value)}
            placeholder="........"
            spellCheck={false}
          />
        </label>
        <div className="form-row">
          <label className="field grow">
            <span className="field-label">{t('Period')} <span className="muted">signal.period</span></span>
            <input
              className="mono-input"
              type="number"
              step={1}
              min={1}
              value={form.period}
              onChange={(event) => setField('period', event.target.value)}
              placeholder="1"
            />
          </label>
          <label className="field grow">
            <span className="field-label">{t('Phase')} <span className="muted">signal.phase</span></span>
            <input
              className="mono-input"
              type="number"
              step={0.1}
              min={0}
              max={1}
              value={form.phase}
              onChange={(event) => setField('phase', event.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <p className="dialog-hint">
          {t('Wave characters: {chars}. Changes are applied to the live WaveJSON and can be undone.', { chars: WAVE_CHAR_LIST.join(' ') })}
        </p>
        <button type="submit" className="visually-hidden" tabIndex={-1}>{t('Apply')}</button>
      </form>
    </Dialog>
  );
}
