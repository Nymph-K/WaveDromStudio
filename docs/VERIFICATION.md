# Verification notes

This file records the checks used for the v1.0.1 build. Unit tests are reproducible with `pnpm test`; interactive checks
were exercised in Chromium (Microsoft Edge) against the Vite development build, the production `dist/` build and the
single-file `WaveDromStudio.html` opened from `file://`.

## Acceptance checklist

| Requirement | Result / evidence |
| --- | --- |
| Uses the official `wavedrom` JS renderer | `src/renderer/wavedromEngine.ts` calls `WaveDrom.renderWaveElement()` with official skin definitions. Exported SVGs are serialized directly from that output. |
| Canvas paint updates `wave` and the editor within 300 ms | Canvas mutations are synchronous and canonicalize the source immediately. Browser paint checks stayed well below 300 ms. |
| Valid JSON5 updates the canvas within 300 ms | Parser debounce is 170 ms. A measured valid-input round trip previously completed in 216 ms including React rerender. |
| Invalid JSON retains the last waveform and reports line/column | Parse failures do not replace `data`; the banner reports line/column and the previous SVG stays mounted. CodeMirror line decoration is applied. |
| Continuous blank-cycle drag | Dragging past the last real cycle keeps auto-scrolling; selection grows by hundreds of cycles and painting extends the lane (verified to column 154 in a browser test). |
| Adaptive clocks | Clocks extend and shrink to the longest non-clock lane, tested both directions; comments/formatting are preserved when only clock wave literals change. The preference disables fitting. |
| Empty data labels | Empty bus labels render `+` placeholders, open via double-click, and are included in Tab navigation. Empty editor values are padded into the `data` array. |
| Ctrl+Enter | Adds a new signal below the active/selected signal and immediately opens the inline name editor (browser test). |
| Multi-row grouping | Three Ctrl-selected row grips grouped into one `["分组", …]` containing all three lanes. The group-name input receives focus with its default text selected, so typing immediately replaces it. |
| Inline name typing | Typing `ABC` into the name editor keeps `ABC`; the field is only selected when it opens, not on every keystroke. |
| Tool rail | All ten tools (select, clock, signal, bus, unknown, high-Z, gap, text, clear, node) tested with single clicks; clock cycles p → P → n → N, signal toggles 0/1, node editor commits. |
| Chinese / English UI | Header toggle and Preferences switch both tested; `lang`, tab names, dialogs and tool labels update and persist. Duration cells use “周期” (not “循环”) in Chinese. CodeMirror search phrases are localized. |
| Multi-row insert | Middle-drag across rows enables insert mode, renders three INS carets, and typing inserts into all selected rows. |
| Save prompts | Dirty tab close opens the three-way dialog; Save downloads and closes; beforeunload is cancelled while dirty and not cancelled when the preference is off. |
| Tabs keep independent selection, zoom and scroll | Browser checks switched tabs after changing scroll and zoom; each restored its own values. |
| SVG equals canvas rendering | Export uses the same `renderWaveDrom()` path, effective skin, data and theme. PNG rasterizes that exact SVG at 3×. |
| Shared and persistent documents | Verified `?doc=` decompression, system clipboard, localStorage restore and active-tab restore. |
| Static deployment | `dist/` served at `/` and under `/wavedrom-studio/` with no console errors. |
| One-click launch | `dist-single/index.html` opened from `file://`; official SVG, Ctrl+Enter, downloads and localStorage worked with no console errors. |
| Shortcut manager | 56 actions, two bindings, canonical normalization, live conflicts, three presets. All presets are conflict-free by unit test. |
| Responsive layout | Tested at 1500×980 and 390×844. Narrow mode switches to explicit Waveform / WaveJSON panes with the tool rail preserved. |

## Automated tests

```text
$ pnpm test
 ✓ src/lib/shortcuts.test.ts (6 tests)
 ✓ src/model/waveModel.test.ts (26 tests)
 ✓ src/model/clockFit.test.ts (6 tests)

 Test Files  3 passed (3)
      Tests  38 passed (38)
```

`pnpm lint` reports 0 warnings and 0 errors for the application source. `pnpm build` and `pnpm build:single` both
succeed; the only build warnings originate in the upstream WaveDrom `eva.js` file (unused) and the chunk-size advisory.

## Browser checks performed

- Official SVG renders with expected lane geometry and no console errors.
- Keyboard and drag painting; JSON source and rerendered SVG checked.
- Relaxed JSON5 comments, unquoted keys, single quotes and trailing commas.
- Invalid source retains the previous SVG and shows line/column.
- Undo/redo while focus remains in CodeMirror.
- Inline signal names, bus labels, empty label placeholders and node markers.
- Inline signal-name typing (e.g. `ABC`) preserves every character without re-selecting the field.
- Group selection by gutter (Ctrl-click), group creation with an auto-focused/selected name field, ungroup, copy/paste and move.
- Continuous drag into empty cycles, then painting and lane extension.
- Multi-row insert mode via middle-drag; carets and typed cells across all rows.
- Every left-rail tool and its click semantics.
- Adaptive clock extension/shrink and preference toggle; source comments preserved.
- Ctrl+Enter inserts the new signal directly below the selected lane and opens the inline editor.
- Chinese UI labels timing cycles as “周期”; command buttons and notifications checked.
- Tab navigation into an empty data label, commit and placeholder removal.
- Light/dark themes and SVG export; PNG export from the production build.
- Empty-label placeholders visually checked at desktop and mobile widths.
- Save-and-close, keep-editing and discarded-close paths; beforeunload gating.
- English ↔ Chinese switching, persisted language and automatically renamed default documents.
- All six examples opened and rendered.
- Splitter resizing in side-by-side and stacked modes.
- Mobile viewport and single-pane switch.
- `file://` one-click HTML launch, including local draft and downloads.

The temporary browser automation scripts were not shipped. Source, unit tests and documented flows are part of the
repository.
