import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Crosshair,
  Gauge,
  GripVertical,
  Layers,
  PencilLine,
  Plus,
  Rows3,
  Ruler,
  Scissors,
  Settings2,
  Trash2,
  Ungroup,
  X,
} from 'lucide-react';
import type { CanvasTool, CellPoint, CellSelection, WaveDoc, WaveLaneFlat } from '../types';
import {
  dataLabels,
  flattenLanes,
  listGroups,
  maxWaveWidth,
  selectionRows,
} from '../model/waveModel';
import { renderWaveDrom, type RenderGeometry } from '../renderer/wavedromEngine';
import { useAppStore } from '../state/appStore';
import { useI18n } from '../lib/useI18n';

const GUTTER = 22;
const RULER_HEIGHT = 30;

const TOOL_ITEMS: { id: CanvasTool; glyph: string; label: string; hint: string }[] = [
  { id: 'select', glyph: '↖', label: 'Select', hint: 'Select and draw with the keyboard.' },
  { id: 'clock', glyph: 'p', label: 'Clock', hint: 'Click to draw a clock. Click again to cycle p → P → n → N.' },
  { id: 'signal', glyph: '1', label: 'Signal tool', hint: 'Click a level signal to toggle 0 / 1.' },
  { id: 'bus', glyph: '=', label: 'Bus', hint: 'Click to toggle a data bus cell.' },
  { id: 'unknown', glyph: 'x', label: 'Unknown', hint: 'Click to toggle an unknown (x) cell.' },
  { id: 'highz', glyph: 'z', label: 'High-Z', hint: 'Click to toggle a high-impedance (z) cell.' },
  { id: 'gap', glyph: '|', label: 'Gap', hint: 'Click to toggle a gap marker.' },
  { id: 'text', glyph: 'T', label: 'Text', hint: 'Click a signal name or bus data label to edit its text.' },
  { id: 'clear', glyph: '.', label: 'Clear', hint: 'Click to clear a cell to "."' },
  { id: 'node', glyph: 'a', label: 'Node', hint: 'Click to edit the node marker at a cycle.' },
];

interface GroupBox {
  index: number;
  name: string;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InlineEdit {
  kind: 'name' | 'data' | 'node';
  row: number;
  dataIndex?: number;
  nodeCol?: number;
  value: string;
  left: number;
  top: number;
  width: number;
  key: string;
}

interface FieldAnchor {
  kind: 'name' | 'data';
  row: number;
  dataIndex?: number;
  rect: { left: number; top: number; width: number; height: number };
}

interface DataMarker {
  row: number;
  dataIndex: number;
  value: string;
  hasText: boolean;
  rect: { left: number; top: number; width: number; height: number };
}

interface DataPlaceholder {
  row: number;
  dataIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DragRef {
  active: boolean;
  anchorRow: number;
  anchorCol: number;
  lastRow: number;
  lastCol: number;
  moved: boolean;
  pointer: { clientX: number; clientY: number } | null;
  frame: number | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  row: number;
  col: number;
  groupRows?: number[];
  groupName?: string;
}

interface DragState {
  row: number;
  startY: number;
  moved: boolean;
  boundary: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSelection(selection: CellSelection): CellSelection {
  return {
    row0: Math.min(selection.row0, selection.row1),
    col0: Math.min(selection.col0, selection.col1),
    row1: Math.max(selection.row0, selection.row1),
    col1: Math.max(selection.col0, selection.col1),
  };
}

function rectInfo(rect: DOMRect): FieldAnchor['rect'] {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function niceTickStep(cellWidth: number): number {
  const target = 56;
  const raw = Math.max(1, Math.ceil(target / Math.max(1, cellWidth)));
  for (const step of [1, 2, 4, 5, 10, 20, 25, 50]) {
    if (step >= raw) return step;
  }
  return 100;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest('input, textarea, [contenteditable="true"], .cm-editor'));
}

function readDataMarkersFromSvg(svg: SVGSVGElement, rows: number): DataMarker[] {
  const result: DataMarker[] = [];
  for (let row = 0; row < rows; row += 1) {
    const draw = svg.querySelector<SVGGElement>(`#wavelane_draw_${row}_0`);
    if (!draw) continue;
    const children = Array.from(draw.children);
    const uses = children.filter((child) => child.tagName.toLowerCase() === 'use') as SVGUseElement[];
    const texts = children.filter((child) => child.tagName.toLowerCase() === 'text') as SVGTextElement[];
    const runs: SVGUseElement[][] = [];
    let run: SVGUseElement[] = [];
    for (const use of uses) {
      const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      const id = href.replace(/^#/, '');
      if (/^vvv-[2-9]$/.test(id)) {
        run.push(use);
      } else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
    runs.forEach((markerRun, index) => {
      const first = markerRun[0].getBoundingClientRect();
      const last = markerRun[markerRun.length - 1].getBoundingClientRect();
      const centerX = (first.left + last.right) / 2;
      const centerY = first.top + first.height / 2;
      const label = texts[index];
      const value = (label?.textContent || '').trim();
      const hasText = Boolean(label && value);
      const rect = hasText && label
        ? rectInfo(label.getBoundingClientRect())
        : { left: centerX - 32, top: centerY - 9, width: 64, height: 18 };
      result.push({ row, dataIndex: index, value, hasText, rect });
    });
  }
  return result;
}

function buildGroupBoxes(svg: SVGSVGElement, docData: WaveDoc): GroupBox[] {
  const groups = listGroups(docData);
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>('#groups_0 path[id^="group_"]'));
  const boxes: GroupBox[] = [];
  paths.forEach((path, index) => {
    const group = groups[index];
    if (!group) return;
    try {
      const box = path.getBBox();
      if (box.width <= 0 && box.height <= 0) return;
      boxes.push({
        index,
        name: group.name,
        start: group.start,
        end: group.end,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    } catch {
      // Ignore groups that cannot be measured.
    }
  });
  return boxes;
}

export interface WaveCanvasHandle {
  exportSvg: () => SVGSVGElement | null;
}

export default function WaveCanvas({ doc }: { doc: ReturnType<typeof useAppStore.getState>['docs'][number] }) {
  const theme = useAppStore((state) => state.theme);
  const showRuler = useAppStore((state) => state.preferences.showRuler);
  const showGrid = useAppStore((state) => state.preferences.showGrid);
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<RenderGeometry | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [groupBoxes, setGroupBoxes] = useState<GroupBox[]>([]);
  const [dataPlaceholders, setDataPlaceholders] = useState<DataPlaceholder[]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const [hoverCell, setHoverCell] = useState<CellPoint | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draggingSelection, setDraggingSelection] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [tool, setTool] = useState<CanvasTool>('select');
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const suppressBlurRef = useRef(false);
  const dragRef = useRef<DragRef | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const cellFromEventRef = useRef<(event: { clientX: number; clientY: number }) => { row: number; col: number; inGrid: boolean } | null>(() => null);
  const latestScrollRef = useRef(doc.scroll);
  const lastActiveRef = useRef<CellPoint>({ ...doc.activeCell });
  const scrollSaveFrame = useRef<number | null>(null);

  const zoom = doc.zoom;
  const lanes = useMemo(() => flattenLanes(doc.data), [doc.data]);
  const rows = Math.max(1, lanes.length);
  const waveMax = maxWaveWidth(doc.data);
  const normalized = useMemo(() => normalizeSelection(doc.selection), [doc.selection]);
  const selectedRowsSet = useMemo(() => new Set(doc.rowSelection), [doc.rowSelection]);
  const overlayCols = Math.min(2048, Math.max(24, waveMax + 10, normalized.col1 + 2));
  const stageHeight = geometry ? geometry.height * zoom : 280;
  const gridLeft = GUTTER + (geometry?.lanesX ?? 70) * zoom;
  const cellWidth = (geometry?.cellWidth ?? 40) * zoom;
  const rowTop = (geometry?.rowTop ?? 55) * zoom;
  const rowHeight = (geometry?.rowHeight ?? 30) * zoom;
  const hscale = Math.max(1, geometry?.hscale ?? 1);
  const brickWidth = cellWidth / (2 * hscale);
  const laneMappings = useMemo(() => {
    return Array.from({ length: rows }, (_, row) => {
      const lane = lanes[row];
      const period = Math.max(1, Number(lane?.item.period) || 1);
      const phase = Math.max(0, Number(lane?.item.phase) || 0);
      const offsetBricks = phase > 0 ? Math.ceil(2 * phase) - 2 * phase : -2 * phase;
      return {
        x: gridLeft + offsetBricks * brickWidth,
        width: cellWidth * period,
        period,
      };
    });
  }, [rows, lanes, gridLeft, brickWidth, cellWidth]);
  const maxWaveEnd = laneMappings.reduce((max, mapping, row) => {
    const length = lanes[row]?.item.wave?.length || 0;
    return Math.max(max, mapping.x + Math.max(length, 1) * mapping.width);
  }, gridLeft);
  const stageWidth = Math.max(
    viewportWidth,
    GUTTER + (geometry?.width ?? 820) * zoom,
    gridLeft + (overlayCols + 2) * cellWidth + 28,
    maxWaveEnd + 8 * cellWidth + 28,
    ...laneMappings.map((mapping) => mapping.x + (normalized.col1 + 1) * mapping.width + 28),
  );
  const endOfWaveX = laneMappings.reduce((max, mapping, row) => {
    const length = lanes[row]?.item.wave?.length || 0;
    return Math.max(max, mapping.x + length * mapping.width);
  }, gridLeft);
  const activeMapping = laneMappings[doc.activeCell.row] || laneMappings[0];
  const insertRows = doc.insertMode
    ? (doc.rowSelection.length > 0
      ? [...doc.rowSelection].sort((a, b) => a - b)
      : selectionRows(normalized))
    : [];
  const insertCarets = insertRows
    .map((row, index) => {
      const mapping = laneMappings[row];
      if (!mapping) return null;
      return { row, index, x: mapping.x + doc.activeCell.col * mapping.width };
    })
    .filter((item): item is { row: number; index: number; x: number } => Boolean(item));
  const selectionSegments = useMemo(() => {
    const segments: { row0: number; row1: number; x: number; width: number }[] = [];
    for (let row = normalized.row0; row <= normalized.row1; row += 1) {
      const mapping = laneMappings[row];
      if (!mapping) continue;
      const x = mapping.x + normalized.col0 * mapping.width;
      const width = (normalized.col1 - normalized.col0 + 1) * mapping.width;
      const previous = segments[segments.length - 1];
      if (previous && previous.row1 === row - 1 && Math.abs(previous.x - x) < 0.01 && Math.abs(previous.width - width) < 0.01) {
        previous.row1 = row;
      } else {
        segments.push({ row0: row, row1: row, x, width });
      }
    }
    return segments;
  }, [normalized, laneMappings]);

  const rerender = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const result = renderWaveDrom(doc.data, {
      darkTheme: theme === 'dark',
    });
    if (result.ok && result.svg && result.geometry) {
      const svg = result.svg;
      svg.style.display = 'block';
      svg.style.width = '100%';
      svg.style.height = '100%';
      host.replaceChildren(svg);
      setGeometry(result.geometry);
      setRenderError(null);
      setGroupBoxes(buildGroupBoxes(svg, doc.data));
      setRenderVersion((value) => value + 1);
    } else {
      setRenderError(result.error || 'WaveDrom could not render this document.');
    }
  }, [doc.data, theme]);

  useLayoutEffect(() => {
    rerender();
  }, [rerender]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      setDataPlaceholders([]);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) {
      setDataPlaceholders([]);
      return;
    }
    const markers = readDataMarkersFromSvg(svg, rows);
    const placeholders = markers
      .filter((marker) => !marker.hasText)
      .map((marker) => ({
        row: marker.row,
        dataIndex: marker.dataIndex,
        left: marker.rect.left + marker.rect.width / 2 - stageRect.left,
        top: marker.rect.top + marker.rect.height / 2 - stageRect.top,
        width: 40,
        height: 16,
      }));
    setDataPlaceholders(placeholders);
  }, [renderVersion, zoom, rows, doc.data]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!inlineEdit) return;
    const input = inlineInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [inlineEdit]);

  // Restore the per-tab scroll position after the diagram has a size.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    latestScrollRef.current = doc.scroll;
    const frame = window.requestAnimationFrame(() => {
      container.scrollLeft = doc.scroll.left;
      container.scrollTop = doc.scroll.top;
    });
    return () => window.cancelAnimationFrame(frame);
    // The canvas is keyed by document id in App, so this is mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (scrollSaveFrame.current !== null) window.cancelAnimationFrame(scrollSaveFrame.current);
      useAppStore.getState().updateScroll(doc.id, latestScrollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    window.addEventListener('wds:edit-name', handleEditNameShortcut);
    return () => window.removeEventListener('wds:edit-name', handleEditNameShortcut);
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      useAppStore.getState().zoomStep(doc.id, event.deltaY < 0 ? 1 : -1);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [doc.id]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => setViewportWidth(Math.max(0, Math.floor(container.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const menu = contextMenu;
    if (!menu) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof PointerEvent && (event.target as Element)?.closest?.('.canvas-context-menu')) return;
      setContextMenu(null);
    };
    const onResize = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', onResize);
    };
  }, [contextMenu]);

  useEffect(() => {
    const prev = lastActiveRef.current;
    const active = doc.activeCell;
    if (prev.row === active.row && prev.col === active.col) return;
    lastActiveRef.current = { ...active };
    const container = scrollRef.current;
    if (!container || isEditableTarget(document.activeElement)) return;
    const mapping = laneMappings[active.row] || { x: gridLeft, width: cellWidth };
    const x = mapping.x + active.col * mapping.width;
    const y = rowTop + active.row * rowHeight;
    const visibleLeft = container.scrollLeft;
    const visibleTop = container.scrollTop;
    const visibleRight = visibleLeft + container.clientWidth;
    const visibleBottom = visibleTop + container.clientHeight;
    const horizontalPad = Math.min(80, mapping.width);
    if (x < visibleLeft + horizontalPad) container.scrollLeft = Math.max(0, x - horizontalPad);
    else if (x + mapping.width > visibleRight - horizontalPad) container.scrollLeft = x + mapping.width - container.clientWidth + horizontalPad;
    if (y < visibleTop + 40) container.scrollTop = Math.max(0, y - 50);
    else if (y + rowHeight > visibleBottom - 24) container.scrollTop = y + rowHeight - container.clientHeight + 24;
  }, [doc.activeCell, cellWidth, gridLeft, laneMappings, rowHeight, rowTop]);

  function onScroll() {
    const container = scrollRef.current;
    if (!container) return;
    latestScrollRef.current = { top: container.scrollTop, left: container.scrollLeft };
    if (scrollSaveFrame.current !== null) return;
    scrollSaveFrame.current = window.requestAnimationFrame(() => {
      scrollSaveFrame.current = null;
      useAppStore.getState().updateScroll(doc.id, latestScrollRef.current);
    });
  }

  function cellFromEvent(event: { clientX: number; clientY: number }): { row: number; col: number; inGrid: boolean } | null {
    const stage = stageRef.current;
    if (!stage || !geometry) return null;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (y < 0) return null;
    const row = clamp(Math.floor((y - rowTop) / rowHeight), 0, rows - 1);
    const mapping = laneMappings[row];
    const inGrid = x >= gridLeft;
    const colFloat = mapping ? Math.floor((x - mapping.x) / Math.max(1, mapping.width)) : Math.floor((x - gridLeft) / Math.max(1, cellWidth));
    const col = clamp(colFloat, 0, overlayCols - 1);
    return { row, col, inGrid };
  }
  cellFromEventRef.current = cellFromEvent;

  function focusStage() {
    stageRef.current?.focus({ preventScroll: true });
  }

  function chooseTool(next: CanvasTool) {
    setTool(next);
    setContextMenu(null);
    if (next !== 'select') {
      useAppStore.getState().setInsertMode(doc.id, false);
    }
  }

  function beginSelectionDrag(
    anchorRow: number,
    anchorCol: number,
    options: { onEnd?: (moved: boolean) => void } = {},
  ) {
    dragCleanupRef.current?.();
    const ref: DragRef = {
      active: true,
      anchorRow,
      anchorCol,
      lastRow: anchorRow,
      lastCol: anchorCol,
      moved: false,
      pointer: null,
      frame: null,
    };
    dragRef.current = ref;
    setDraggingSelection(true);

    const update = () => {
      const pointer = ref.pointer;
      if (!pointer) return;
      const point = cellFromEventRef.current(pointer);
      if (!point) return;
      const nextCol = point.inGrid ? point.col : 0;
      if (point.row === ref.lastRow && nextCol === ref.lastCol) return;
      ref.lastRow = point.row;
      ref.lastCol = nextCol;
      if (point.row !== anchorRow || nextCol !== anchorCol) ref.moved = true;
      useAppStore.getState().setSelection(doc.id, {
        row0: anchorRow,
        col0: anchorCol,
        row1: point.row,
        col1: nextCol,
      });
    };

    const tick = () => {
      if (!ref.active) return;
      const container = scrollRef.current;
      const pointer = ref.pointer;
      if (container && pointer) {
        const viewport = container.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (pointer.clientX > viewport.right - 42) dx = 15;
        else if (pointer.clientX < viewport.left + 42) dx = -15;
        if (pointer.clientY > viewport.bottom - 34) dy = 15;
        else if (pointer.clientY < viewport.top + 42) dy = -15;
        if (dx || dy) {
          container.scrollLeft += dx;
          container.scrollTop += dy;
          update();
        }
      }
      ref.frame = window.requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (!ref.active) return;
      ref.pointer = { clientX: event.clientX, clientY: event.clientY };
      update();
    };
    const cleanup = () => {
      if (!ref.active) return;
      ref.active = false;
      if (ref.frame !== null) window.cancelAnimationFrame(ref.frame);
      ref.frame = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);
      dragRef.current = null;
      setDraggingSelection(false);
      options.onEnd?.(ref.moved);
    };
    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('blur', cleanup);
    ref.frame = window.requestAnimationFrame(tick);
  }

  function beginToolPaint(row: number, col: number) {
    const state = useAppStore.getState();
    state.applyToolAt(doc.id, row, col, tool);
    let last = { row, col };
    const onMove = (event: PointerEvent) => {
      const container = scrollRef.current;
      if (container) {
        const viewport = container.getBoundingClientRect();
        if (event.clientX > viewport.right - 28) container.scrollLeft += 20;
        else if (event.clientX < viewport.left + 28) container.scrollLeft -= 20;
      }
      const point = cellFromEventRef.current(event);
      if (!point || !point.inGrid || (point.row === last.row && point.col === last.col)) return;
      last = { row: point.row, col: point.col };
      useAppStore.getState().applyToolAt(doc.id, point.row, point.col, tool, true);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  }

  function openTextToolAt(point: { row: number; col: number; inGrid: boolean }, target: EventTarget | null) {
    const byTarget = findFieldFromTarget(target);
    if (byTarget) {
      openInlineFromAnchor(byTarget);
      return;
    }
    if (!point.inGrid) {
      const nameAnchor = collectNameAnchors().find((anchor) => anchor.row === point.row);
      if (nameAnchor) openInlineFromAnchor(nameAnchor);
      return;
    }
    const lane = lanes[point.row];
    const current = lane?.item.wave?.[point.col] || '';
    const markers = readDataMarkers().filter((marker) => marker.row === point.row);
    if (markers.length > 0 && /^[=23456789]$/.test(current)) {
      const mapping = laneMappings[point.row];
      const center = mapping ? mapping.x + (point.col + 0.5) * mapping.width : 0;
      const nearest = markers.reduce((best, marker) => {
        const markerCenter = marker.rect.left + marker.rect.width / 2;
        const distance = Math.abs(markerCenter - (stageRef.current!.getBoundingClientRect().left + center));
        return !best || distance < best.distance ? { marker, distance } : best;
      }, null as { marker: DataMarker; distance: number } | null);
      if (nearest) {
        openInlineFromAnchor({
          kind: 'data',
          row: point.row,
          dataIndex: nearest.marker.dataIndex,
          rect: nearest.marker.rect,
        });
        return;
      }
    }
    const nameAnchor = collectNameAnchors().find((anchor) => anchor.row === point.row);
    if (nameAnchor) openInlineFromAnchor(nameAnchor);
  }

  function onStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isEditableTarget(event.target)) return;
    const point = cellFromEvent(event);
    if (!point) return;
    const state = useAppStore.getState();
    if (event.button === 1) {
      event.preventDefault();
      focusStage();
      const wasInsert = doc.insertMode;
      state.setSelection(doc.id, { row0: point.row, col0: point.col, row1: point.row, col1: point.col });
      state.setInsertMode(doc.id, true);
      beginSelectionDrag(point.row, point.col, {
        onEnd: (moved) => {
          if (!moved && wasInsert) useAppStore.getState().setInsertMode(doc.id, false);
        },
      });
      return;
    }
    if (event.button !== 0) return;
    focusStage();
    if (!point.inGrid) {
      if (tool === 'text') {
        const target = event.target;
        window.setTimeout(() => openTextToolAt(point, target), 0);
        return;
      }
      state.selectRow(doc.id, point.row, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace');
      return;
    }
    if (tool === 'text') {
      event.preventDefault();
      const target = event.target;
      window.setTimeout(() => openTextToolAt(point, target), 0);
      return;
    }
    if (tool === 'node') {
      event.preventDefault();
      openNodeEditorAt(point.row, point.col);
      return;
    }
    if (tool !== 'select') {
      event.preventDefault();
      beginToolPaint(point.row, point.col);
      return;
    }
    state.setSelection(doc.id, {
      row0: point.row,
      col0: point.col,
      row1: point.row,
      col1: point.col,
    });
    beginSelectionDrag(point.row, point.col);
  }

  function onStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      setHoverCell(null);
      return;
    }
    const point = cellFromEvent(event);
    if (!point || !point.inGrid) {
      setHoverCell(null);
      return;
    }
    setHoverCell({ row: point.row, col: point.col });
  }

  function startRowDrag(event: ReactPointerEvent<HTMLButtonElement>, row: number) {
    event.preventDefault();
    event.stopPropagation();
    focusStage();
    if (event.shiftKey) {
      useAppStore.getState().selectRow(doc.id, row, 'range');
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      useAppStore.getState().selectRow(doc.id, row, 'toggle');
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const startState: DragState = { row, startY: event.clientY, moved: false, boundary: row };
    setDrag(startState);
    let last = startState;
    const computeBoundary = (clientY: number): number => {
      const container = scrollRef.current;
      if (!container) return row;
      const viewport = container.getBoundingClientRect();
      if (clientY > viewport.bottom - 26) container.scrollBy({ top: 16 });
      else if (clientY < viewport.top + 34) container.scrollBy({ top: -16 });
      const rect = stage.getBoundingClientRect();
      const y = clientY - rect.top;
      return clamp(Math.round((y - rowTop) / rowHeight), 0, rows);
    };
    const onMove = (pointer: PointerEvent) => {
      const boundary = computeBoundary(pointer.clientY);
      const moved = last.moved || Math.abs(pointer.clientY - startState.startY) > 3;
      last = { ...last, moved, boundary };
      setDrag(last);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const final = last;
      setDrag(null);
      if (!final.moved) {
        useAppStore.getState().selectRow(doc.id, row, 'replace');
        return;
      }
      let targetRow: number;
      let after: boolean;
      if (final.boundary >= rows) {
        targetRow = rows - 1;
        after = true;
      } else {
        targetRow = final.boundary;
        after = false;
      }
      if (targetRow === row || (after && targetRow === row - 1)) return;
      useAppStore.getState().reorderSignal(doc.id, row, targetRow, after);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onStageContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    const point = cellFromEvent(event);
    if (!point) return;
    if (point.inGrid) {
      useAppStore.getState().setSelection(doc.id, {
        row0: point.row,
        col0: point.col,
        row1: point.row,
        col1: point.col,
      });
    } else {
      useAppStore.getState().selectRow(doc.id, point.row, 'replace');
    }
    setContextMenu({ x: event.clientX, y: event.clientY, row: point.row, col: point.col });
  }

  function onGroupContextMenu(event: ReactMouseEvent<HTMLButtonElement>, box: GroupBox) {
    event.preventDefault();
    event.stopPropagation();
    openGroupSelection(box);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      row: box.start,
      col: 0,
      groupRows: Array.from({ length: box.end - box.start + 1 }, (_, index) => box.start + index),
      groupName: box.name,
    });
  }

  function openGroupSelection(box: GroupBox) {
    const state = useAppStore.getState();
    const col = clamp(doc.activeCell.col, 0, Math.max(0, waveMax - 1));
    state.setSelection(
      doc.id,
      { row0: box.start, col0: col, row1: box.end, col1: col },
      Array.from({ length: box.end - box.start + 1 }, (_, index) => box.start + index),
    );
  }

  function findFieldFromTarget(target: EventTarget | null): FieldAnchor | null {
    if (!(target instanceof Element)) return null;
    const text = target.closest('text');
    if (!text) return null;
    const draw = text.closest('g[id^="wavelane_draw_"]');
    if (draw) {
      const match = /^wavelane_draw_(\d+)_/.exec(draw.id);
      if (!match) return null;
      const row = Number(match[1]);
      const labels = Array.from(draw.children).filter((child) => child.tagName.toLowerCase() === 'text');
      const dataIndex = labels.indexOf(text);
      if (dataIndex < 0) return null;
      return {
        kind: 'data',
        row,
        dataIndex,
        rect: rectInfo(text.getBoundingClientRect()),
      };
    }
    const lane = text.closest('g[id^="wavelane_"]');
    if (!lane) return null;
    const match = /^wavelane_(\d+)_/.exec(lane.id);
    if (!match) return null;
    const row = Number(match[1]);
    const nameText = Array.from(lane.children).find(
      (child) => child.tagName.toLowerCase() === 'text' && !child.closest('[id^="wavelane_draw_"]'),
    ) as SVGTextElement | undefined;
    if (nameText !== text) return null;
    return {
      kind: 'name',
      row,
      rect: rectInfo(text.getBoundingClientRect()),
    };
  }

  function onStageDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (tool !== 'select' && tool !== 'text') return;
    const field = findFieldFromTarget(event.target);
    if (!field) return;
    event.preventDefault();
    event.stopPropagation();
    openInlineFromAnchor(field);
  }

  function collectNameAnchors(): FieldAnchor[] {
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return [];
    const result: FieldAnchor[] = [];
    for (let row = 0; row < rows; row += 1) {
      const lane = svg.querySelector<SVGGElement>(`#wavelane_${row}_0`);
      if (!lane) continue;
      const name = Array.from(lane.children).find((child) => child.tagName.toLowerCase() === 'text') as SVGTextElement | undefined;
      if (!name) continue;
      result.push({ kind: 'name', row, rect: rectInfo(name.getBoundingClientRect()) });
    }
    return result;
  }

  function readDataMarkers(): DataMarker[] {
    const svg = hostRef.current?.querySelector('svg');
    if (!svg) return [];
    return readDataMarkersFromSvg(svg, rows);
  }

  function collectDataAnchors(): FieldAnchor[] {
    return readDataMarkers().map((marker) => ({
      kind: 'data',
      row: marker.row,
      dataIndex: marker.dataIndex,
      rect: marker.rect,
    }));
  }

  function openNodeEditorAt(row: number, col: number) {
    const stage = stageRef.current;
    const mapping = laneMappings[row];
    if (!stage || !mapping) return;
    const lane = lanes[row];
    const node = typeof lane?.item.node === 'string' ? lane.item.node : '';
    const value = node[col] && node[col] !== '.' ? node[col] : '';
    const width = Math.min(180, Math.max(96, mapping.width + 40));
    const left = mapping.x + col * mapping.width + mapping.width / 2 - width / 2;
    const top = rowTop + row * rowHeight - 7;
    setInlineEdit({
      kind: 'node',
      row,
      nodeCol: col,
      value,
      left,
      top,
      width,
      key: `node-${row}-${col}-${Date.now()}`,
    });
  }

  function openInlineFromAnchor(anchor: FieldAnchor) {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const current = useAppStore.getState().docs.find((item) => item.id === doc.id);
    const lane = current ? flattenLanes(current.data)[anchor.row] : undefined;
    if (!lane) return;
    if (anchor.kind === 'name') {
      const width = Math.min(230, Math.max(110, anchor.rect.width + 48));
      setInlineEdit({
        kind: 'name',
        row: anchor.row,
        value: lane.item.name || '',
        left: anchor.rect.left - stageRect.left + anchor.rect.width - width,
        top: anchor.rect.top - stageRect.top - 5,
        width,
        key: `name-${anchor.row}-${Date.now()}`,
      });
    } else {
      const index = anchor.dataIndex || 0;
      const width = Math.min(240, Math.max(92, anchor.rect.width + 40));
      setInlineEdit({
        kind: 'data',
        row: anchor.row,
        dataIndex: index,
        value: dataLabels(lane.item)[index] || '',
        left: anchor.rect.left - stageRect.left + anchor.rect.width / 2 - width / 2,
        top: anchor.rect.top - stageRect.top - 5,
        width,
        key: `data-${anchor.row}-${index}-${Date.now()}`,
      });
    }
  }

  function commitInlineValue(edit: InlineEdit) {
    const state = useAppStore.getState();
    if (edit.kind === 'name') {
      state.renameLane(doc.id, edit.row, edit.value);
    } else if (edit.kind === 'node') {
      state.setNodeAt(doc.id, edit.row, edit.nodeCol || 0, edit.value);
    } else {
      state.setLaneDataAt(doc.id, edit.row, edit.dataIndex || 0, edit.value);
    }
  }

  function closeInline() {
    suppressBlurRef.current = true;
    setInlineEdit(null);
    window.setTimeout(() => {
      suppressBlurRef.current = false;
    }, 0);
  }

  function nextField(current: InlineEdit, fieldKind: 'name' | 'data', direction: 1 | -1): FieldAnchor | null {
    if (fieldKind === 'name') {
      const anchors = collectNameAnchors();
      if (anchors.length === 0) return null;
      let index: number;
      if (current.kind === 'name') index = anchors.findIndex((anchor) => anchor.row === current.row);
      else index = anchors.findIndex((anchor) => anchor.row > current.row);
      if (index < 0) index = direction > 0 ? 0 : anchors.length - 1;
      else index = (index + (current.kind === 'name' ? direction : 0) + anchors.length) % anchors.length;
      return anchors[index];
    }
    const anchors = collectDataAnchors();
    if (anchors.length === 0) return null;
    let index: number;
    if (current.kind === 'data') {
      index = anchors.findIndex((anchor) => anchor.row === current.row && anchor.dataIndex === current.dataIndex);
    } else {
      const candidates = anchors.map((anchor, anchorIndex) => ({ anchor, anchorIndex })).filter(({ anchor }) => anchor.row >= current.row);
      if (candidates.length > 0) return candidates[0].anchor;
      index = -1;
    }
    if (index < 0) index = direction > 0 ? 0 : anchors.length - 1;
    else index = (index + (current.kind === 'data' ? direction : 0) + anchors.length) % anchors.length;
    return anchors[index];
  }

  function onInlineKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!inlineEdit) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeInline();
      focusStage();
      return;
    }
    if (inlineEdit.kind === 'node') {
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        commitInlineValue(inlineEdit);
        closeInline();
        focusStage();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const edit = inlineEdit;
      const direction = event.shiftKey ? -1 : 1;
      const target = nextField(edit, 'name', direction);
      commitInlineValue(edit);
      suppressBlurRef.current = true;
      setInlineEdit(null);
      if (target) {
        window.setTimeout(() => {
          suppressBlurRef.current = false;
          openInlineFromAnchor(target);
        }, 0);
      } else {
        suppressBlurRef.current = false;
        focusStage();
      }
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const edit = inlineEdit;
      const direction = event.shiftKey ? -1 : 1;
      const target = nextField(edit, 'data', direction);
      commitInlineValue(edit);
      suppressBlurRef.current = true;
      setInlineEdit(null);
      if (target) {
        window.setTimeout(() => {
          suppressBlurRef.current = false;
          openInlineFromAnchor(target);
        }, 0);
      } else {
        suppressBlurRef.current = false;
        useAppStore.getState().notify('No data labels in this diagram', 'info');
        focusStage();
      }
    }
  }

  function onInlineBlur() {
    if (!inlineEdit || suppressBlurRef.current) return;
    commitInlineValue(inlineEdit);
    setInlineEdit(null);
  }

  function handleEditNameShortcut() {
    const anchor = collectNameAnchors().find((item) => item.row === doc.activeCell.row);
    if (anchor) openInlineFromAnchor(anchor);
    else useAppStore.getState().notify('This row does not have a name field', 'info');
  }

  function closeContextAndRun(action: () => void) {
    setContextMenu(null);
    action();
  }

  function contextMenuItems() {
    if (!contextMenu) return null;
    const state = useAppStore.getState();
    const lane = flattenLanes(doc.data)[contextMenu.row] as WaveLaneFlat | undefined;
    const name = lane?.item.name || t('unnamed signal');
    const isGroupContext = Boolean(contextMenu.groupRows);
    if (isGroupContext) {
      return (
        <>
          <div className="ctx-title"><Layers size={14} /> {contextMenu.groupName || t('Group')}</div>
          <button onClick={() => closeContextAndRun(() => state.openModal('group-name', { rows: contextMenu.groupRows }))}>
            <Layers size={14} /> {t('Group selection…')}
          </button>
          <button onClick={() => closeContextAndRun(() => state.ungroupSelection(doc.id))}>
            <Ungroup size={14} /> {t('Ungroup')}
          </button>
          <div className="ctx-sep" />
          <button onClick={() => closeContextAndRun(() => state.copySelection(doc.id))}>
            <Copy size={14} /> {t('Copy group')}
          </button>
          <button onClick={() => closeContextAndRun(() => void state.pasteClipboard(doc.id))}>
            <Copy size={14} /> {t('Paste')}
          </button>
          <button onClick={() => closeContextAndRun(() => state.moveSignals(-1, doc.id))}>
            <Rows3 size={14} /> {t('Move group up')}
          </button>
          <button onClick={() => closeContextAndRun(() => state.moveSignals(1, doc.id))}>
            <Rows3 size={14} /> {t('Move group down')}
          </button>
          <button className="danger" onClick={() => closeContextAndRun(() => state.deleteSelectedSignals(doc.id))}>
            <Trash2 size={14} /> {t('Delete group')}
          </button>
        </>
      );
    }
    return (
      <>
        <div className="ctx-title"><Rows3 size={14} /> {name || t('signal')} <span>{t('Row {row}', { row: contextMenu.row + 1 })}</span></div>
        <button onClick={() => closeContextAndRun(() => state.openModal('signal-properties', { row: contextMenu.row }))}>
          <Settings2 size={14} /> {t('Signal properties…')}
        </button>
        <button onClick={() => closeContextAndRun(() => {
          const target = collectNameAnchors().find((anchor) => anchor.row === contextMenu.row);
          if (target) openInlineFromAnchor(target);
        })}>
          <PencilLine size={14} /> {t('Rename signal')}
        </button>
        <div className="ctx-sep" />
        <button onClick={() => closeContextAndRun(() => {
          state.selectRow(doc.id, contextMenu.row, 'replace');
          state.insertSignal('above', doc.id);
        })}>
          <Plus size={14} /> {t('Insert signal above')}
        </button>
        <button onClick={() => closeContextAndRun(() => {
          state.selectRow(doc.id, contextMenu.row, 'replace');
          state.insertSignal('below', doc.id);
        })}>
          <Plus size={14} /> {t('Insert signal below')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.addEmptyRow(doc.id))}>
          <span className="ctx-braces">{'{}'}</span> {t('Insert empty row')}
        </button>
        <div className="ctx-sep" />
        <button onClick={() => closeContextAndRun(() => state.insertCycle('before', doc.id))}>
          <Plus size={14} /> {t('Insert cycle before')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.insertCycle('after', doc.id))}>
          <Plus size={14} /> {t('Insert cycle after')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.clearSelectedCells(doc.id))}>
          <Crosshair size={14} /> {t('Clear cells to “.”')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.deleteSelectedCycles(doc.id))}>
          <Scissors size={14} /> {t('Delete selected cycles')}
        </button>
        <div className="ctx-sep" />
        <button onClick={() => closeContextAndRun(() => state.copySelection(doc.id))}>
          <Copy size={14} /> {t('Copy cells')}
        </button>
        <button onClick={() => closeContextAndRun(() => void state.pasteClipboard(doc.id))}>
          <Copy size={14} /> {t('Paste')}
        </button>
        <button onClick={() => closeContextAndRun(() => {
          state.selectRow(doc.id, contextMenu.row, 'replace');
          void state.copySelection(doc.id);
        })}>
          <Copy size={14} /> {t('Copy signal')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.duplicateSignals(doc.id))}>
          <Rows3 size={14} /> {t('Duplicate signal')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.openModal('group-name', { rows: [contextMenu.row] }))}>
          <Layers size={14} /> {t('Group selection…')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.fitClocksToLongest(doc.id))}>
          <Gauge size={14} /> {t('Fit clocks to longest lane')}
        </button>
        <button onClick={() => closeContextAndRun(() => state.deleteSelectedSignals(doc.id))} className="danger">
          <Trash2 size={14} /> {t('Delete signal')}
        </button>
      </>
    );
  }

  const tickStep = niceTickStep(cellWidth);
  const ticks = useMemo(() => {
    const result: number[] = [];
    const count = Math.floor((stageWidth - gridLeft) / Math.max(1, cellWidth));
    for (let index = 0; index <= count; index += 1) {
      if (index % tickStep === 0) result.push(index);
    }
    return result;
  }, [cellWidth, gridLeft, stageWidth, tickStep]);

  const groupHitStyle = (box: GroupBox): CSSProperties => ({
    left: GUTTER + (box.x - 5) * zoom,
    top: box.y * zoom,
    height: Math.max(12, box.height * zoom),
    width: Math.max(15, (box.width + 9) * zoom),
  });

  return (
    <div className={`wave-canvas tool-${tool} ${doc.insertMode ? 'insert-mode' : ''}`} data-render-version={renderVersion}>
      <div className="wave-canvas-main">
        <aside className="wave-tool-rail" role="toolbar" aria-orientation="vertical" aria-label={t('Waveform tools')}>
          <span className="tool-rail-title">{t('TOOLS')}</span>
          {TOOL_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`wave-tool ${tool === item.id ? 'active' : ''} tool-${item.id}`}
              data-tool={item.id}
              title={`${t(item.label)} — ${t(item.hint)}`}
              aria-label={t(item.label)}
              aria-pressed={tool === item.id}
              onClick={() => chooseTool(item.id)}
            >
              {item.glyph}
            </button>
          ))}
        </aside>
        <div className="canvas-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="canvas-content" style={{ width: stageWidth, minWidth: '100%' }}>
          {showRuler && (
            <div className="time-ruler" style={{ height: RULER_HEIGHT, width: stageWidth }}>
              <div className="ruler-gutter">{t('TIME')}</div>
              <div className="ruler-track" style={{ left: gridLeft, width: Math.max(0, stageWidth - gridLeft) }}>
                <div className="ruler-baseline" />
                {ticks.map((tick) => (
                  <div key={tick} className="ruler-tick" style={{ left: tick * cellWidth }}>
                    <span>{tick}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            className={`wave-stage ${showGrid ? '' : 'no-grid'}`}
            ref={stageRef}
            style={{
              width: stageWidth,
              height: stageHeight,
              backgroundSize: showGrid ? `${Math.max(8, cellWidth)}px ${Math.max(8, rowHeight)}px, ${Math.max(8, cellWidth)}px ${Math.max(8, rowHeight)}px` : undefined,
              backgroundPosition: showGrid ? `${gridLeft}px ${rowTop}px, ${gridLeft}px ${rowTop}px` : undefined,
            }}
            tabIndex={0}
            role="application"
            aria-label={t('Interactive WaveDrom canvas')}
            data-canvas-stage="true"
            data-grid-left={gridLeft}
            data-cell-width={cellWidth}
            data-row-top={rowTop}
            data-row-height={rowHeight}
            data-row-count={rows}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerLeave={() => setHoverCell(null)}
            onDoubleClick={onStageDoubleClick}
            onContextMenu={onStageContextMenu}
            onAuxClick={(event) => {
              if (event.button === 1) event.preventDefault();
            }}
          >
            <div
              className="wavedrom-svg"
              ref={hostRef}
              style={{
                left: GUTTER,
                width: geometry ? geometry.width * zoom : 0,
                height: geometry ? geometry.height * zoom : 0,
              }}
            />
            <div className="canvas-gutter-layer" style={{ left: 0, width: GUTTER, height: stageHeight }}>
              {Array.from({ length: rows }, (_, row) => {
                const lane = lanes[row];
                const selected = selectedRowsSet.has(row);
                return (
                  <button
                    key={row}
                    type="button"
                    className={`row-grip ${selected ? 'selected' : ''} ${lane?.isSpacer ? 'spacer' : ''}`}
                    style={{ top: rowTop + row * rowHeight + Math.max(0, rowHeight - 22) / 2 }}
                    title={lane?.isSpacer ? t('Empty {} row — drag to reorder') : t('Drag to reorder {name}', { name: lane?.item.name || t('row') })}
                    aria-label={t('Row {row} drag handle', { row: row + 1 })}
                    onPointerDown={(event) => startRowDrag(event, row)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      useAppStore.getState().selectRow(doc.id, row, 'replace');
                      setContextMenu({ x: event.clientX, y: event.clientY, row, col: doc.activeCell.col });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        useAppStore.getState().selectRow(doc.id, row, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace');
                      }
                    }}
                  >
                    {lane?.isSpacer ? <span className="spacer-brace">{'{}'}</span> : <GripVertical size={13} />}
                  </button>
                );
              })}
            </div>

            <div className="row-undertone-layer" aria-hidden="true">
              {Array.from({ length: rows }, (_, row) => (
                <div
                  key={row}
                  className={`lane-strip ${row % 2 === 0 ? 'even' : 'odd'} ${selectedRowsSet.has(row) ? 'row-selected' : ''} ${hoverCell?.row === row ? 'row-hover' : ''}`}
                  style={{ top: rowTop + row * rowHeight, height: rowHeight, left: gridLeft - 4, width: Math.max(0, stageWidth - gridLeft + 4) }}
                />
              ))}
            </div>

            {insertCarets.map((caret) => (
              <div
                key={`insert-${caret.row}`}
                className={`insert-caret ${caret.row === doc.activeCell.row ? 'active-row' : ''}`}
                data-insert-row={caret.row}
                style={{ left: caret.x, top: rowTop + caret.row * rowHeight, height: rowHeight }}
              >
                {caret.index === 0 && <span>{t('INS')}</span>}
              </div>
            ))}

            {hoverCell && !draggingSelection && laneMappings[hoverCell.row] && (
              <div
                className="hover-cell"
                style={{
                  left: laneMappings[hoverCell.row].x + hoverCell.col * laneMappings[hoverCell.row].width,
                  top: rowTop + hoverCell.row * rowHeight + 2,
                  width: laneMappings[hoverCell.row].width,
                  height: rowHeight - 4,
                }}
              />
            )}

            {selectionSegments.map((segment) => (
              <div
                key={`selection-${segment.row0}-${segment.row1}`}
                className="selection-box"
                data-testid="selection-overlay"
                data-row0={normalized.row0}
                data-col0={normalized.col0}
                data-row1={normalized.row1}
                data-col1={normalized.col1}
                data-segment-row0={segment.row0}
                data-segment-row1={segment.row1}
                style={{
                  left: segment.x,
                  top: rowTop + segment.row0 * rowHeight + 2,
                  width: segment.width,
                  height: (segment.row1 - segment.row0 + 1) * rowHeight - 4,
                }}
              />
            ))}
            {activeMapping && (
              <div
                className="active-cell-ring"
                style={{
                  left: activeMapping.x + doc.activeCell.col * activeMapping.width,
                  top: rowTop + doc.activeCell.row * rowHeight + 2,
                  width: activeMapping.width,
                  height: rowHeight - 4,
                }}
              />
            )}

            {waveMax > 0 && (
              <div className="wave-end-marker" style={{ left: endOfWaveX, top: rowTop, height: Math.max(0, stageHeight - rowTop - 4) }}>
                <span>{t('end · paint to extend')}</span>
              </div>
            )}

            {groupBoxes.map((box) => (
              <button
                key={`${box.index}-${box.name}`}
                type="button"
                className="group-hit"
                style={groupHitStyle(box)}
                title={t('Select group {name}', { name: box.name || t('(unnamed)') })}
                aria-label={t('Select group {name}', { name: box.name || t('(unnamed)') })}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  focusStage();
                  openGroupSelection(box);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    focusStage();
                    openGroupSelection(box);
                  }
                }}
                onContextMenu={(event) => onGroupContextMenu(event, box)}
              />
            ))}

            {dataPlaceholders.map((placeholder) => (
              <button
                key={`data-placeholder-${placeholder.row}-${placeholder.dataIndex}`}
                type="button"
                className="data-placeholder"
                style={{
                  left: placeholder.left - placeholder.width / 2,
                  top: placeholder.top - placeholder.height / 2,
                  width: placeholder.width,
                  height: placeholder.height,
                }}
                title={t('Empty data label — double-click to edit')}
                aria-label={t('Edit empty data label in row {row}', { row: placeholder.row + 1 })}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (tool === 'text') {
                    event.preventDefault();
                    const anchor = collectDataAnchors().find(
                      (item) => item.row === placeholder.row && item.dataIndex === placeholder.dataIndex,
                    );
                    if (anchor) openInlineFromAnchor(anchor);
                  }
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const anchor = collectDataAnchors().find(
                    (item) => item.row === placeholder.row && item.dataIndex === placeholder.dataIndex,
                  );
                  if (anchor) openInlineFromAnchor(anchor);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const anchor = collectDataAnchors().find(
                      (item) => item.row === placeholder.row && item.dataIndex === placeholder.dataIndex,
                    );
                    if (anchor) openInlineFromAnchor(anchor);
                  }
                }}
              >
                +
              </button>
            ))}

            {drag && (
              <div className="drag-insert-line" style={{ top: rowTop + drag.boundary * rowHeight, left: GUTTER }} />
            )}

            {contextMenu && createPortal(
              <div
                className="canvas-context-menu"
                style={(() => {
                  const menuWidth = 246;
                  const left = Math.max(8, Math.min(contextMenu.x, window.innerWidth - menuWidth - 8));
                  const availableBelow = window.innerHeight - contextMenu.y - 8;
                  if (availableBelow < 340 && contextMenu.y > 340) {
                    return {
                      left,
                      top: 'auto',
                      bottom: Math.max(8, window.innerHeight - contextMenu.y),
                      maxHeight: Math.min(640, contextMenu.y - 8),
                    } as CSSProperties;
                  }
                  return {
                    left,
                    top: contextMenu.y,
                    maxHeight: Math.min(640, availableBelow),
                  } as CSSProperties;
                })()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {contextMenuItems()}
              </div>,
              document.body,
            )}

            {inlineEdit && (
              <div
                className={`inline-label-editor ${inlineEdit.kind}`}
                style={{ left: inlineEdit.left, top: inlineEdit.top, width: inlineEdit.width }}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <span className="inline-kind">
                  {inlineEdit.kind === 'name' ? t('name') : inlineEdit.kind === 'node' ? t('node') : t('data')}
                </span>
                <input
                  key={inlineEdit.key}
                  ref={inlineInputRef}
                  value={inlineEdit.value}
                  maxLength={inlineEdit.kind === 'node' ? 1 : undefined}
                  aria-label={inlineEdit.kind === 'name' ? t('Signal name') : inlineEdit.kind === 'node' ? t('Node marker') : t('Data label')}
                  onChange={(event) => setInlineEdit({ ...inlineEdit, value: event.target.value })}
                  onKeyDown={onInlineKeyDown}
                  onBlur={onInlineBlur}
                />
                <button type="button" className="inline-close" onMouseDown={(event) => event.preventDefault()} onClick={() => { closeInline(); focusStage(); }}>
                  <X size={12} />
                </button>
              </div>
            )}

            {renderError && (
              <div className="canvas-render-error">
                <strong>{t('WaveDrom render error')}</strong>
                <span>{renderError}</span>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      <div className="canvas-floating-tools">
        <button
          type="button"
          className={`mini-toggle ${doc.insertMode ? 'active' : ''}`}
          onClick={() => useAppStore.getState().toggleInsertMode(doc.id)}
          title={t('Continuous insert mode (middle click on a cell)')}
        >
          <Plus size={13} /> {t('Insert mode')}
        </button>
        <span className="canvas-scale-readout">{Math.round(doc.zoom * 100)}%</span>
        <button type="button" className="mini-icon" onClick={() => useAppStore.getState().zoomStep(doc.id, -1)} title={t('Zoom out (Ctrl+-)')}>−</button>
        <button type="button" className="mini-icon" onClick={() => useAppStore.getState().zoomStep(doc.id, 1)} title={t('Zoom in (Ctrl+=)')}>+</button>
        <button type="button" className="mini-icon" onClick={() => useAppStore.getState().resetZoom(doc.id)} title={t('Reset zoom (Ctrl+0)')}>
          <Crosshair size={13} />
        </button>
        <button type="button" className="mini-icon" onClick={() => useAppStore.getState().setPreferences({ showRuler: !showRuler })} title={t('Toggle time ruler')}>
          <Ruler size={13} />
        </button>
      </div>
    </div>
  );
}
