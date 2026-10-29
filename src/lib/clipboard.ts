import type { CellClipboard, SignalClipboard, SignalItem } from '../types';

let memoryClipboard = '';

async function trySystemWrite(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function trySystemRead(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.readText) return null;
    const text = await navigator.clipboard.readText();
    return text || null;
  } catch {
    return null;
  }
}

export async function writeClipboard(text: string): Promise<{ ok: boolean; system: boolean }> {
  memoryClipboard = text;
  const system = await trySystemWrite(text);
  return { ok: system || text.length > 0, system };
}

export async function readClipboard(): Promise<{ text: string; system: boolean }> {
  const systemText = await trySystemRead();
  if (systemText) return { text: systemText, system: true };
  return { text: memoryClipboard, system: false };
}

export function signalPayload(items: SignalItem[]): string {
  const payload: SignalClipboard = {
    format: 'wavedrom-studio/signals',
    version: 1,
    items,
  };
  return JSON.stringify(payload, null, 2);
}

export function cellPayload(rows: string[], width: number): string {
  const payload: CellClipboard = {
    format: 'wavedrom-studio/cells',
    version: 1,
    rows,
    width,
  };
  return JSON.stringify(payload);
}

export interface ParsedClipboard {
  kind: 'signals' | 'cells' | 'text' | 'wavejson';
  items?: SignalItem[];
  rows?: string[];
  width?: number;
  text?: string;
}

function isSignalItem(value: unknown): value is SignalItem {
  if (Array.isArray(value)) {
    return value.length > 0 && typeof value[0] === 'string';
  }
  return Boolean(value) && typeof value === 'object';
}

function coerceItems(value: unknown): SignalItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isSignalItem)) return null;
  return value as SignalItem[];
}

export function parseClipboardText(raw: string): ParsedClipboard {
  const text = raw.trim();
  if (!text) return { kind: 'text', text: '' };
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.format === 'wavedrom-studio/signals') {
      const items = coerceItems(parsed.items);
      if (items) return { kind: 'signals', items };
    }
    if (parsed && parsed.format === 'wavedrom-studio/cells' && Array.isArray(parsed.rows)) {
      const rows = parsed.rows.map((row: unknown) => String(row));
      return { kind: 'cells', rows, width: Number(parsed.width) || Math.max(...rows.map((row: string) => row.length)) };
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.signal)) {
      const items = coerceItems(parsed.signal);
      if (items) return { kind: 'wavejson', items };
    }
    const direct = coerceItems(parsed);
    if (direct) return { kind: 'wavejson', items: direct };
  } catch {
    // Not JSON; try a plain cell grid below.
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((line) => /^[01xz=udpPnNlLhH23456789|.<>]+$/.test(line))) {
    return {
      kind: 'cells',
      rows: lines,
      width: Math.max(...lines.map((line) => line.length)),
    };
  }
  return { kind: 'text', text: raw };
}
