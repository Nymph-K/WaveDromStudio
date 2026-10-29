import { useAppStore } from '../state/appStore';
import DiagramSettingsDialog from './dialogs/DiagramSettingsDialog';
import SignalPropertiesDialog from './dialogs/SignalPropertiesDialog';
import GroupNameDialog from './dialogs/GroupNameDialog';
import ShortcutsDialog from './dialogs/ShortcutsDialog';
import PreferencesDialog from './dialogs/PreferencesDialog';
import CloseDocumentDialog from './dialogs/CloseDocumentDialog';
import Dialog from './Dialog';
import { Code2, Heart, Info, Zap } from 'lucide-react';
import { EXAMPLES } from '../examples';
import { useI18n } from '../lib/useI18n';

function AboutDialog() {
  const close = useAppStore((state) => state.closeModal);
  const { t } = useI18n();
  return (
    <Dialog
      title="WaveDrom Studio"
      subtitle={t('A visual WaveJSON editor for the web')}
      icon={<Zap size={19} />}
      onClose={close}
      width="sm"
      footer={<button className="button primary" type="button" onClick={close}>{t('Close')}</button>}
    >
      <div className="about-body">
        <div className="about-mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p>
          {t('Built on the official')}{' '}
          <a href="https://github.com/wavedrom/wavedrom" target="_blank" rel="noreferrer">WaveDrom</a>{' '}
          {t('SVG renderer. Every diagram is rendered by WaveDrom itself; the canvas interaction layer sits on top of the official geometry.')}
        </p>
        <ul className="about-facts">
          <li><strong>{t('Engine')}</strong><span>WaveDrom 3.8.0</span></li>
          <li><strong>{t('Examples')}</strong><span>{t('{count} bundled diagrams', { count: EXAMPLES.length })}</span></li>
          <li><strong>{t('Privacy')}</strong><span>{t('All edits stay in your browser')}</span></li>
        </ul>
        <p className="about-license">
          {t('WaveDrom is MIT licensed. WaveDrom Studio is an independent open-source companion UI, made with')} <Heart size={12} /> {t('for hardware people.')}
        </p>
        <div className="about-links">
          <a href="https://wavedrom.com/tutorial.html" target="_blank" rel="noreferrer"><Info size={13} /> {t('WaveDrom tutorial')}</a>
          <a href="https://github.com/wavedrom/wavedrom" target="_blank" rel="noreferrer"><Code2 size={13} /> {t('WaveDrom on GitHub')}</a>
          <a href="./LICENSE.txt" target="_blank" rel="noreferrer">{t('MIT license')}</a>
          <a href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">{t('Third-party notices')}</a>
        </div>
      </div>
    </Dialog>
  );
}

export default function ModalHost() {
  const modal = useAppStore((state) => state.modal);
  const activeId = useAppStore((state) => state.activeId);
  if (!modal) return null;
  switch (modal.kind) {
    case 'diagram-settings':
      return <DiagramSettingsDialog docId={activeId} />;
    case 'signal-properties':
      return <SignalPropertiesDialog row={Number(modal.payload?.row) || 0} />;
    case 'group-name':
      return <GroupNameDialog rows={modal.payload?.rows as number[] | undefined} />;
    case 'shortcuts':
    case 'help':
      return <ShortcutsDialog />;
    case 'preferences':
      return <PreferencesDialog />;
    case 'close-document':
      return <CloseDocumentDialog docId={String(modal.payload?.docId || activeId)} />;
    case 'about':
      return <AboutDialog />;
    default:
      return null;
  }
}
