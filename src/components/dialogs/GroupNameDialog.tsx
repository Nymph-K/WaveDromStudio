import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Layers } from 'lucide-react';
import Dialog from '../Dialog';
import { useAppStore } from '../../state/appStore';
import { selectionRows } from '../../model/waveModel';
import { useI18n } from '../../lib/useI18n';

export default function GroupNameDialog({ rows }: { rows?: number[] }) {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === state.activeId));
  const closeModal = useAppStore((state) => state.closeModal);
  const groupSelection = useAppStore((state) => state.groupSelection);
  const { t } = useI18n();
  const [name, setName] = useState(() => t('Group'));
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRows = rows && rows.length > 0
    ? rows
    : doc
      ? doc.rowSelection.length > 0
        ? doc.rowSelection
        : selectionRows(doc.selection)
      : [];

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  if (!doc) return null;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const targetDoc = useAppStore.getState().docs.find((item) => item.id === doc?.id);
    if (!targetDoc) return;
    groupSelection(name.trim() || t('Group'), targetRows, targetDoc.id);
    closeModal();
  }

  return (
    <Dialog
      title={t('Group signals')}
      subtitle={t('Wrap {count} signal(s) in a named WaveJSON group', { count: targetRows.length })}
      icon={<Layers size={19} />}
      onClose={closeModal}
      width="sm"
      footer={(
        <>
          <button type="button" className="button ghost" onClick={closeModal}>{t('Cancel')}</button>
          <button type="button" className="button primary" onClick={() => submit()}>{t('Create group')}</button>
        </>
      )}
    >
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">{t('Group name')}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('e.g. Master')}
            maxLength={80}
          />
        </label>
        <p className="dialog-hint">{t('The group becomes an editable WaveJSON array. Groups can be nested, copied, moved and ungrouped later.')}</p>
      </form>
    </Dialog>
  );
}
