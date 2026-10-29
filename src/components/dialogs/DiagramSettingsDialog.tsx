import { useMemo, useState, type FormEvent } from 'react';
import { Paintbrush2, SlidersHorizontal } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore, type DiagramSettingsInput } from '../../state/appStore';
import { SKIN_NAMES } from '../../renderer/wavedromEngine';
import { useI18n } from '../../lib/useI18n';

const SKIN_LABELS: Record<string, string> = {
  default: 'Default',
  lowkey: 'Low key',
  narrow: 'Narrow',
  dark: 'Dark',
};

function displaySetting(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'number' || typeof item === 'string')) return value.join(', ');
    return JSON.stringify(value);
  }
  return String(value);
}

function displayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  return '';
}

export default function DiagramSettingsDialog({ docId }: { docId: string }) {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === docId));
  const theme = useAppStore((state) => state.theme);
  const closeModal = useAppStore((state) => state.closeModal);
  const applyDiagramSettings = useAppStore((state) => state.applyDiagramSettings);
  const { t } = useI18n();
  const config = doc?.data.config && typeof doc.data.config === 'object' ? doc.data.config : {};
  const head = doc?.data.head && typeof doc.data.head === 'object' ? doc.data.head : {};
  const foot = doc?.data.foot && typeof doc.data.foot === 'object' ? doc.data.foot : {};
  const [form, setForm] = useState<DiagramSettingsInput>(() => ({
    skin: typeof config.skin === 'string' ? config.skin : 'default',
    hscale: Number(config.hscale) || 1,
    headText: displayText(head.text),
    footText: displayText(foot.text),
    headTick: displaySetting(head.tick),
    headTock: displaySetting(head.tock),
    headEvery: displaySetting(head.every),
    footTick: displaySetting(foot.tick),
    footTock: displaySetting(foot.tock),
    footEvery: displaySetting(foot.every),
  }));

  const effectiveWarning = useMemo(
    () => theme === 'dark' && form.skin !== 'dark',
    [theme, form.skin],
  );

  if (!doc) return null;

  function setField<K extends keyof DiagramSettingsInput>(key: K, value: DiagramSettingsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (applyDiagramSettings(docId, form)) closeModal();
  }

  return (
    <Dialog
      title={t('Diagram settings')}
      subtitle={t('WaveDrom config, titles and time labels')}
      icon={<SlidersHorizontal size={19} />}
      onClose={closeModal}
      width="lg"
      footer={(
        <>
          <button type="button" className="button ghost" onClick={closeModal}>{t('Cancel')}</button>
          <button type="button" className="button primary" onClick={() => {
            if (applyDiagramSettings(docId, form)) closeModal();
          }}>{t('Apply settings')}</button>
        </>
      )}
    >
      <form className="settings-form" onSubmit={submit}>
        <section className="form-section">
          <div className="section-heading">
            <Paintbrush2 size={15} />
            <div>
              <h3>{t('Appearance')}</h3>
              <p>{t('The SVG skin and horizontal timing scale.')}</p>
            </div>
          </div>
          <div className="skin-grid">
            {SKIN_NAMES.map((skin) => (
              <button
                key={skin}
                type="button"
                className={`skin-option ${form.skin === skin ? 'active' : ''} skin-${skin}`}
                onClick={() => setField('skin', skin)}
                aria-pressed={form.skin === skin}
              >
                <span className="skin-swatch"><i /><i /><i /></span>
                <span>{t(SKIN_LABELS[skin])}</span>
              </button>
            ))}
          </div>
          {effectiveWarning && (
            <p className="form-note warning-note">
              {t('Dark interface theme forces WaveDrom’s official dark skin while editing.')}
            </p>
          )}
          <label className="field-row">
            <span className="field-label">
              {t('Horizontal scale')} <span className="muted">config.hscale</span>
            </span>
            <div className="range-row">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={Number(form.hscale)}
                onChange={(event) => setField('hscale', Number(event.target.value))}
              />
              <input
                className="number-input"
                type="number"
                min={1}
                max={20}
                step={1}
                value={form.hscale}
                onChange={(event) => setField('hscale', Number(event.target.value))}
              />
            </div>
          </label>
        </section>

        <section className="form-section two-col">
          <div className="caption-column">
            <div className="section-heading compact">
              <h3>{t('Head')}</h3>
              <p>{t('Title above the lanes.')}</p>
            </div>
            <label className="field">
              <span className="field-label">{t('Text')}</span>
              <textarea
                rows={2}
                value={form.headText}
                placeholder={t('Diagram title — JSONML accepted')}
                onChange={(event) => setField('headText', event.target.value)}
              />
            </label>
            <div className="triple-fields">
              <label className="field">
                <span className="field-label">{t('Tick')}</span>
                <input value={form.headTick} placeholder="0" onChange={(event) => setField('headTick', event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{t('Tock')}</span>
                <input value={form.headTock} placeholder="—" onChange={(event) => setField('headTock', event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{t('Every')}</span>
                <input value={form.headEvery} placeholder="2" onChange={(event) => setField('headEvery', event.target.value)} />
              </label>
            </div>
          </div>
          <div className="caption-column">
            <div className="section-heading compact">
              <h3>{t('Foot')}</h3>
              <p>{t('Caption below the lanes.')}</p>
            </div>
            <label className="field">
              <span className="field-label">{t('Text')}</span>
              <textarea
                rows={2}
                value={form.footText}
                placeholder={t('Optional caption')}
                onChange={(event) => setField('footText', event.target.value)}
              />
            </label>
            <div className="triple-fields">
              <label className="field">
                <span className="field-label">{t('Tick')}</span>
                <input value={form.footTick} placeholder="—" onChange={(event) => setField('footTick', event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{t('Tock')}</span>
                <input value={form.footTock} placeholder="—" onChange={(event) => setField('footTock', event.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{t('Every')}</span>
                <input value={form.footEvery} placeholder="—" onChange={(event) => setField('footEvery', event.target.value)} />
              </label>
            </div>
          </div>
        </section>

        <p className="dialog-hint">
          {t('Numeric tick/tock values can be comma-separated. A single number starts a sequence; arrays and text are passed through WaveDrom unchanged.')}
        </p>
        <button type="submit" className="visually-hidden" tabIndex={-1}>{t('Apply')}</button>
      </form>
    </Dialog>
  );
}
