import { useCallback } from 'react';
import { useAppStore } from '../state/appStore';
import { translate } from '../i18n';
import type { Language } from '../types';

export function useI18n(): {
  language: Language;
  t: (text: string, vars?: Record<string, string | number>) => string;
} {
  const language = useAppStore((state) => state.language);
  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => translate(language, text, vars),
    [language],
  );
  return { language, t };
}
