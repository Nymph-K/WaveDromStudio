# Changelog

## v1.0.1 — 2026-10-30

### Fixed

- Grouping selected signals now focuses and selects the group-name field immediately, so the default name can be replaced by typing.
- New signals are inserted below the active/selected signal instead of at the end of the diagram.
- Inline signal-name editing no longer re-selects the field after every keystroke; typed text is preserved.
- The Chinese term for timing cycles is now **周期** instead of **循环** throughout the UI and documentation.

## v1.0.0 — 2026-10-30

First public release.

### Added

- Left editing-tool rail: select, clock, signal (0/1 toggle), bus, unknown, high-Z, gap, text, clear and node.
- Adaptive `clk` / `clock` lane fitting with a Preferences switch and a one-shot `Ctrl+Shift+9` action.
- English / 简体中文 interface switch with persisted language, localized dialogs, shortcut manager and CodeMirror search.
- One-click single-file HTML build (`pnpm build:single`) plus `START.cmd` launcher and portable release zip.
- Empty `data` label placeholders and Tab navigation into blank labels.
- Unsaved-change tracking, tab dots, a Save / Discard / Keep editing dialog and browser `beforeunload` protection.
- Preferences dialog for language, clock fitting, close confirmation, auto-advance, ruler and grid.
- `pnpm start` opens the development server in a browser.

### Fixed

- Blank cycles can now be selected continuously to the right with automatic scrolling and lane extension.
- Multi-selected signal rows now produce one group containing every selected row.
- `Ctrl+Enter` now opens the inline signal-name editor after adding the signal.
- Middle-drag across rows enters multi-row insert mode and the INS caret is rendered on every selected row.
- Text tool opens inline editors reliably on a single click.
- Adaptive clocks shrink as well as grow, target the longest non-clock lane and preserve JSON5 comments when patched.
- Closing the last tab, closing a dirty tab and closing the browser tab now respect unsaved changes.
