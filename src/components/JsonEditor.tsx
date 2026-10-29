import { useEffect, useRef } from 'react';
import { Compartment, EditorState, StateEffect, StateField, type Extension, type Text } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
  type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import type { EditorDoc } from '../types';
import { buildWaveHighlights, locateWaveTokens, type WaveSourceToken } from '../model/sourceLocator';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../lib/useI18n';

const setWaveMarks = StateEffect.define<{ from: number; to: number }[]>();
const setErrorLine = StateEffect.define<number | null>();

const SEARCH_PHRASES_ZH = {
  'Go to line': '跳转到行',
  go: '跳转',
  Find: '查找',
  Replace: '替换',
  next: '下一个',
  previous: '上一个',
  all: '全部',
  'match case': '区分大小写',
  regexp: '正则表达式',
  'by word': '全词匹配',
  replace: '替换',
  'replace all': '全部替换',
  close: '关闭',
  'current match': '当前匹配',
  'on line': '行',
  'replaced match on line $': '已替换第 $ 行的匹配',
  'replaced $ matches': '已替换 $ 处匹配',
};

function searchPhrases(language: 'en' | 'zh') {
  return language === 'zh' ? SEARCH_PHRASES_ZH : {};
}

const waveMarkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setWaveMarks)) {
        const ranges = effect.value
          .filter((range) => range.to > range.from)
          .map((range) => Decoration.mark({ class: 'cm-wave-selection' }).range(range.from, range.to));
        next = Decoration.set(ranges, true);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setErrorLine)) {
        const lineNumber = effect.value;
        if (!lineNumber || lineNumber < 1 || lineNumber > transaction.state.doc.lines) {
          next = Decoration.none;
        } else {
          const line = transaction.state.doc.line(lineNumber);
          next = Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)]);
        }
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const waveHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bool, color: 'var(--syntax-bool)' },
  { tag: tags.null, color: 'var(--syntax-bool)' },
  { tag: tags.punctuation, color: 'var(--syntax-punctuation)' },
  { tag: tags.brace, color: 'var(--syntax-punctuation)' },
  { tag: tags.squareBracket, color: 'var(--syntax-punctuation)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.invalid, color: 'var(--danger)' },
]);

function makeEditorTheme() {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--editor-bg)',
        color: 'var(--text-1)',
        fontSize: '12.5px',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.62',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '10px 0 80px',
        caretColor: 'var(--accent-strong)',
      },
      '.cm-line': {
        padding: '0 18px 0 12px',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--editor-gutter)',
        color: 'var(--text-4)',
        border: 'none',
        paddingLeft: '6px',
      },
      '.cm-gutterElement': {
        padding: '0 8px 0 4px',
        fontSize: '10.5px',
        lineHeight: '1.62',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--editor-active-line)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--accent-strong)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--accent-strong)',
        borderLeftWidth: '2px',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--editor-selection) !important',
      },
      '.cm-matchingBracket': {
        backgroundColor: 'var(--accent-soft)',
        outline: '1px solid var(--accent-border)',
      },
      '.cm-nonmatchingBracket': {
        color: 'var(--danger)',
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--find-match)',
        outline: '1px solid var(--find-match-border)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--find-selected)',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'var(--find-match)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--panel-2)',
        color: 'var(--text-1)',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid var(--border-1)',
      },
      '.cm-search': {
        fontFamily: 'var(--font-ui)',
        padding: '7px 9px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        fontSize: '12px',
      },
      '.cm-search input, .cm-search button, .cm-search label': {
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        color: 'var(--text-1)',
      },
      '.cm-search input[type=text]': {
        background: 'var(--input-bg)',
        border: '1px solid var(--border-1)',
        borderRadius: '5px',
        padding: '4px 6px',
        outline: 'none',
      },
      '.cm-search button': {
        background: 'var(--panel-3)',
        border: '1px solid var(--border-1)',
        borderRadius: '5px',
        padding: '3px 8px',
        cursor: 'pointer',
        backgroundImage: 'none',
      },
      '.cm-search button:hover': {
        borderColor: 'var(--accent-border)',
      },
      '.cm-button': {
        backgroundImage: 'none',
      },
      '.cm-panel.cm-search [name=close]': {
        color: 'var(--text-2)',
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--panel-2)',
        border: '1px solid var(--border-1)',
      },
    },
    { dark: false },
  );
}

const editorThemeExtension: Extension = [makeEditorTheme()];

const scrollMemory = new Map<string, { top: number; cursor: number }>();

function fullReplaceTransaction(view: EditorView, source: string) {
  const current = view.state.doc.toString();
  if (current === source) return;
  const selection = view.state.selection.main;
  const anchor = Math.min(selection.anchor, source.length);
  const head = Math.min(selection.head, source.length);
  view.dispatch({
    changes: { from: 0, to: current.length, insert: source },
    selection: { anchor, head },
    annotations: [],
  });
}

function decorationRanges(
  doc: Text,
  docData: EditorDoc,
  tokens: WaveSourceToken[],
): { from: number; to: number }[] {
  if (docData.parseError) return [];
  const highlights = buildWaveHighlights(docData.source, docData.data, docData.selection, tokens);
  return highlights
    .map((highlight) => ({
      from: Math.max(0, Math.min(doc.length, highlight.from)),
      to: Math.max(0, Math.min(doc.length, highlight.to)),
    }))
    .filter((range) => range.to > range.from);
}

export default function JsonEditor({ doc }: { doc: EditorDoc }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRef = useRef(false);
  const tokenCache = useRef<{ source: string; tokens: WaveSourceToken[] }>({ source: '', tokens: [] });
  const i18nCompartment = useRef(new Compartment());
  const { language, t } = useI18n();

  function tokensFor(source: string): WaveSourceToken[] {
    if (tokenCache.current.source !== source) {
      tokenCache.current = { source, tokens: locateWaveTokens(source) };
    }
    return tokenCache.current.tokens;
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const state = EditorState.create({
      doc: doc.source,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(waveHighlightStyle),
        json(),
        search({ top: true }),
        highlightSelectionMatches(),
        i18nCompartment.current.of([
          placeholder(t('Paste or type WaveJSON or JSON5…')),
          EditorState.phrases.of(searchPhrases(language)),
        ]),
        editorThemeExtension,
        waveMarkField,
        errorLineField,
        keymap.of([...defaultKeymap, ...searchKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || applyingRef.current) return;
          useAppStore.getState().updateSource(doc.id, update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    const memory = scrollMemory.get(doc.id);
    if (memory) {
      view.dispatch({
        selection: { anchor: Math.min(memory.cursor, view.state.doc.length) },
        effects: EditorView.scrollIntoView(Math.min(memory.cursor, view.state.doc.length), { y: 'center' }),
      });
      view.scrollDOM.scrollTop = memory.top;
    }
    const onFind = () => {
      view.focus();
      openSearchPanel(view);
    };
    window.addEventListener('wds:editor-find', onFind);
    return () => {
      window.removeEventListener('wds:editor-find', onFind);
      scrollMemory.set(doc.id, {
        top: view.scrollDOM.scrollTop,
        cursor: view.state.selection.main.head,
      });
      view.destroy();
      viewRef.current = null;
    };
    // The editor is mounted per document; source updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: i18nCompartment.current.reconfigure([
        placeholder(t('Paste or type WaveJSON or JSON5…')),
        EditorState.phrases.of(searchPhrases(language)),
      ]),
    });
  }, [language, t]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== doc.source) {
      applyingRef.current = true;
      fullReplaceTransaction(view, doc.source);
      applyingRef.current = false;
    }
    const tokens = tokensFor(doc.source);
    const ranges = decorationRanges(view.state.doc, doc, tokens);
    const line = doc.parseError?.line ?? null;
    const effects: StateEffect<unknown>[] = [setWaveMarks.of(ranges), setErrorLine.of(line)];
    const firstRange = ranges[0];
    if (firstRange && !view.hasFocus) {
      effects.push(EditorView.scrollIntoView(firstRange.from, { y: 'center' }));
    }
    view.dispatch({ effects });
  }, [doc]);

  return <div className="json-editor-host" data-testid="json-editor" ref={hostRef} />;
}
