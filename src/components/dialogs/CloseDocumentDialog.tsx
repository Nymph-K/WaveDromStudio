import { FileWarning, Save, Trash2 } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore } from '../../state/appStore';
import { useI18n } from '../../lib/useI18n';
import { saveWaveJson } from '../../lib/fileActions';

export default function CloseDocumentDialog({ docId }: { docId: string }) {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === docId));
  const closeDocument = useAppStore((state) => state.closeDocument);
  const closeModal = useAppStore((state) => state.closeModal);
  const { t } = useI18n();
  if (!doc) return null;

  function saveAndClose() {
    saveWaveJson(doc!);
    closeDocument(doc!.id);
    closeModal();
  }

  function discardAndClose() {
    closeDocument(doc!.id);
    closeModal();
  }

  return (
    <Dialog
      title={t('Unsaved changes')}
      subtitle={t('“{name}” has changes that have not been saved. Save the WaveJSON file before closing this tab?', { name: doc.name })}
      icon={<FileWarning size={19} />}
      onClose={closeModal}
      width="sm"
      footer={(
        <>
          <button type="button" className="button ghost" onClick={closeModal}>{t('Keep editing')}</button>
          <div className="footer-spacer" />
          <button type="button" className="button danger-ghost" onClick={discardAndClose}>
            <Trash2 size={14} /> {t('Discard and close')}
          </button>
          <button type="button" className="button primary" onClick={saveAndClose}>
            <Save size={14} /> {t('Save and close')}
          </button>
        </>
      )}
    >
      <p className="dialog-hint unsaved-hint">
        {t('A local draft is automatically kept in this browser, but the WaveJSON file has not been downloaded.')}
      </p>
    </Dialog>
  );
}
