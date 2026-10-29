# Architecture

WaveDrom Studio is a static React application with deliberately separate rendering, model, state and interaction layers.
The most important rule is that the official WaveDrom renderer owns all waveform SVG geometry. The editor never draws its
own clocks, buses or arrows. A single-file build embeds the complete client into one HTML file for one-click launches.

## 1. Render layer — `src/renderer/wavedromEngine.ts`

Responsibilities:

- Load the four official WaveDrom skins (`default`, `lowkey`, `narrow`, `dark`).
- Clone WaveJSON before handing it to WaveDrom (WaveDrom mutates `head`/`foot` during rendering).
- Force the effective skin to `dark` when the UI theme is dark.
- Call `WaveDrom.renderWaveElement(0, source, detachedHost, skins, false)`.
- Return a detached `<svg>` so a failed render cannot destroy the previous valid diagram.
- Measure the resulting lane geometry: SVG size, lanes origin, cycle width, row height and row count.
- Apply the background rectangle colour for light/dark presentation.
- Serialize the exact rendered SVG; rasterize it 3× for PNG through a canvas.

This module has no knowledge of selections, tabs, history or mouse events.

## 2. Model layer — `src/model/`

`waveModel.ts` is a pure-ish tree model for WaveJSON:

- `flattenLanes()` provides a visible-lane view while keeping real array paths (including group-name offsets).
- Groups are represented as arrays (`["Name", ...children]`); empty `{}` objects remain legal lanes.
- Group-span reporting follows WaveDrom's group order (post-order) so runtime group hit rectangles can be associated with
  model spans.
- Editing helpers cover painting cells, extending lanes, insert/clear/delete cycles, data labels, lane properties,
  insertion, deletion, duplication, reorder, group/ungroup, move and explicit clock fitting.
- `validateDocument()` protects the renderer from structurally invalid WaveJSON while allowing unknown fields to survive.
- `parseSource()` accepts JSON5 and normalizes errors to line/column.

`sourceLocator.ts` is a small, comment-aware scanner that finds `wave` string tokens in the original source. It records
the raw offset of every decoded character, which makes it possible to mark only the selected cycles in CodeMirror even
with escaped characters or single-quoted JSON5 strings.

`clockFit.ts` contains adaptive-clock fitting. Clocks are measured against the longest non-clock lane, then only the
affected clock `wave` literals are replaced in the original text; comments, formatting and unrelated fields survive.
Canvas mutations apply the same rule through `applyMutator()` when the preference is enabled. `setNodeMarker()` and the
wide empty-cycle selection clamp are also part of the model layer.

## 3. State layer — `src/state/appStore.ts`

A single Zustand store holds:

- documents (`source`, `savedSource`, dirty flag, last valid `data`, parse error, selection, row selection, active cell,
  insert mode, zoom, scroll);
- per-tab undo/redo snapshots;
- theme, language, view mode, splitter ratio and tab identity;
- shortcut bindings, preferences, modals, close prompts and toasts.

Important flows:

- **Editor → canvas** — `updateSource()` updates text immediately, starts a 170 ms parse timer and pushes one history
  snapshot per typing burst. Successful parsing updates `data`, clamped selection and `revision`; failures preserve the
  previous valid `data`.
- **Canvas → editor** — cell/tool operations are routed through `applyMutator()`: ensure the current text is parsed,
  record a snapshot, apply a model operation, optionally fit clocks, validate the result, canonicalize to JSON and replace
  `source`. Empty-cycle selections use a wide logical runway so the canvas can scroll and extend while dragging.
- **Undo/redo** — both editor and canvas changes create snapshots. Restoring parses the target source again, restores
  selection/row selection, recalculates `dirty` against `savedSource`, and cancels pending timers. History is per document.
- **Language** — `setLanguage()` updates the i18n dictionary, automatically renames only default example/untitled
  documents and persists the choice. I18n is pure and component-facing; the store uses the same `translate()` helper for
  notifications.
- **Close protection** — `requestCloseDocument()` checks `dirty` and `preferences.confirmClose`, opens the three-way close
  dialog, or closes immediately. A window-level `beforeunload` handler checks all dirty documents.
- **Persistence** — a debounced serializer writes documents, `savedSource`, language and UI preferences to
  `localStorage`; parse errors are not fatal because the last valid `data` is persisted alongside the source.
- **Sharing** — the Share action encodes the current source and name with `lz-string` into an editable `?doc=` link.
- **Clipboard** — blocks are JSON payloads using `wavedrom-studio/signals` or `wavedrom-studio/cells`; the browser
  clipboard is preferred with an in-memory fallback.

Timers and pending parse state live outside React. All mutations that depend on parsed JSON first force pending parsing,
which keeps interactions coherent when the user edits and immediately clicks the canvas.

## 4. Interaction and view layer — `src/components/`

### WaveCanvas

The canvas is an overlay on top of the official SVG, not a second renderer.

1. The official SVG is inserted into an absolutely positioned host.
2. Geometry (`lanesX`, `lanesY`, base cycle width, row height) is measured from that SVG.
3. Logical lane cells are mapped to screen coordinates. Each lane has its own character width:
   `baseCycleWidth × period`, plus WaveDrom's `phase` brick offset. This keeps selection and painting aligned even for
   DDR-style lanes with different periods.
4. A pointer position is converted to `(row, character index)`. Selection is stored as a logical rectangle.
5. Selection, hover, caret, group hit areas, drag insertion line and inline label editors are rendered as DOM/SVG overlays.
6. The inline fields are placed using the official `<text>` bounding boxes, so names and bus labels line up with the
   rendered glyphs.
7. Data-marker positions are read from the official `<use>` bricks at runtime. This lets empty `data` labels receive
   clickable `+` overlays and participate in `Tab` navigation without reimplementing WaveDrom's brick algorithm.

The component also handles:

- click, rectangular drag, continuous auto-scroll into empty cycles, middle-click drag for multi-row insert mode;
- context menu, keyboard-driven palette and the left editing-tool rail (clock, signal, bus, unknown, high-Z, gap, text,
  clear, node);
- row reorder with drop indication;
- per-lane inline name, `data` and node editors with `Enter`/`Tab` navigation;
- an INS caret per selected row in insert mode;
- measurement for group bracket hit areas;
- per-tab scroll restoration and ruler updates;
- automatic clock fitting after canvas mutations.

### JsonEditor

CodeMirror 6 provides text editing, line numbers, syntax highlighting, search and scrolling. Two custom state fields add:

- **wave selection marks** computed from the logical rectangle and source offsets;
- **error line marks** computed from `parseError.line`.

The component applies external document changes without triggering another store update. It preserves the scroll position
per document in a small module-level memory map.

### Dialogs and chrome

The header, tabs, command bar, pane headers, status bar and dialogs are thin React views over the store. The shortcut
manager operates on a draft binding table, computes conflicts from the canonical key map, and only writes the valid draft
back to the store. `src/i18n.ts` supplies a pure English/Chinese dictionary, and `useI18n()` exposes the current language
to components. The Preferences and close-document dialogs are store-driven like the other modals.

## Rendering independence

WaveDrom Studio deliberately does not fork or copy the brick rendering algorithm. The only code that draws waveform paths
is the `wavedrom` package. The overlay owns editor affordances (selection tint, active cell outline, group hit areas,
inline inputs, empty-label pins) and never attempts to redraw the signal geometry. Marker hit boxes are derived from the
official `use` elements, not from a new renderer. This makes exports identical to the official renderer and keeps future
WaveDrom skin/geometry updates effective.

## 5. Build targets

- `pnpm build` produces a conventional relative-base static site in `dist/`.
- `pnpm build:single` uses `vite-plugin-singlefile` to inline the JS, CSS and favicon into one `dist-single/index.html`.
  The release copies it as `WaveDromStudio.html`; it runs directly from `file://` without a server.
- Deployment configs for GitHub Pages, Netlify and Vercel are included. No backend or environment variables are required.

## Test strategy

- Unit tests cover path offsets in nested groups, grouping/ungrouping, drag reorder across group boundaries, duplicate,
  paste-as-sibling, cycle edits, JSON5 parsing, character-level source highlighting, adaptive clock fitting, node markers,
  wide empty-cycle selections and all shortcut presets.
- Browser smoke tests were used during development for two-way sync latency, invalid-source preservation, inline/empty
  label navigation, Ctrl+Enter editing, multi-row insert carets, continuous blank-cycle dragging, clock fitting,
  tab-local scroll/zoom/selection, clipboard exchange, share-link round trips, export dimensions, dark-skin switching,
  language persistence, close prompts and responsive layout.
- The final bundle is verified with `pnpm build`, `pnpm build:single`, `pnpm preview` and a direct `file://` launch of the
  one-file release.
