import { useState } from 'react';
import { Languages, Settings2 } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore } from '../../state/appStore';
import { useI18n } from '../../lib/useI18n';
import type { Language } from '../../types';

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="preference-row">
      <span className="preference-copy">
        <strong>{label}</strong>
        <em>{description}</em>
      </span>
      <span className={`switch-control ${checked ? 'checked' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track"><span className="switch-thumb" /></span>
      </span>
    </label>
  );
}

export default function PreferencesDialog() {
  const preferences = useAppStore((state) => state.preferences);
  const currentLanguage = useAppStore((state) => state.language);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const applyClockFitToAll = useAppStore((state) => state.applyClockFitToAll);
  const closeModal = useAppStore((state) => state.closeModal);
  const { t } = useI18n();
  const [language, setLocalLanguage] = useState<Language>(currentLanguage);
  const [draft, setDraft] = useState({ ...preferences });

  function apply() {
    const fitTurnedOn = !preferences.autoFitClocks && draft.autoFitClocks;
    setPreferences(draft);
    setLanguage(language);
    if (fitTurnedOn) applyClockFitToAll();
    closeModal();
  }

  return (
    <Dialog
      title={t('Preferences')}
      subtitle={t('Editor behavior, language and display preferences')}
      icon={<Settings2 size={19} />}
      onClose={closeModal}
      width="md"
      footer={(
        <>
          <span className="dialog-hint inline-hint">{t('Your preferences are saved locally.')}</span>
          <div className="footer-spacer" />
          <button type="button" className="button ghost" onClick={closeModal}>{t('Cancel')}</button>
          <button type="button" className="button primary" onClick={apply}>{t('Apply preferences')}</button>
        </>
      )}
    >
      <div className="preferences-form">
        <section className="form-section">
          <div className="section-heading">
            <Languages size={15} />
            <div>
              <h3>{t('Interface language')}</h3>
              <p>{t('Switch between English and Simplified Chinese.')}</p>
            </div>
          </div>
          <div className="language-choice">
            <button
              type="button"
              className={language === 'en' ? 'active' : ''}
              onClick={() => setLocalLanguage('en')}
            >
              <span className="language-badge">EN</span>
              <span>English</span>
            </button>
            <button
              type="button"
              className={language === 'zh' ? 'active' : ''}
              onClick={() => setLocalLanguage('zh')}
            >
              <span className="language-badge">中</span>
              <span>简体中文</span>
            </button>
          </div>
        </section>

        <section className="form-section preferences-section">
          <div className="section-heading">
            <Settings2 size={15} />
            <div>
              <h3>{t('Behavior')}</h3>
            </div>
          </div>
          <Toggle
            checked={draft.autoFitClocks}
            onChange={(checked) => setDraft({ ...draft, autoFitClocks: checked })}
            label={t('Auto-fit clock lanes')}
            description={t('Automatically extend or shrink lanes whose name contains clk / clock to the longest signal.')}
          />
          <Toggle
            checked={draft.confirmClose}
            onChange={(checked) => setDraft({ ...draft, confirmClose: checked })}
            label={t('Confirm before closing tabs')}
            description={t('Ask before closing a modified document, and warn before leaving the page.')}
          />
          <Toggle
            checked={draft.autoAdvance}
            onChange={(checked) => setDraft({ ...draft, autoAdvance: checked })}
            label={t('Auto-advance after painting a cell')}
            description={t('Move the active cell one column to the right after a single-cell paint.')}
          />
          <Toggle
            checked={draft.showRuler}
            onChange={(checked) => setDraft({ ...draft, showRuler: checked })}
            label={t('Show time ruler')}
            description={t('Show the time ruler above the waveform.')}
          />
          <Toggle
            checked={draft.showGrid}
            onChange={(checked) => setDraft({ ...draft, showGrid: checked })}
            label={t('Show timing grid')}
            description={t('Show the canvas timing grid.')}
          />
        </section>
      </div>
    </Dialog>
  );
}
