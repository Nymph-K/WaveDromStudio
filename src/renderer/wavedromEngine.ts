import WaveDrom from 'wavedrom';
import defaultSkin from 'wavedrom/skins/default.js';
import darkSkin from 'wavedrom/skins/dark.js';
import lowkeySkin from 'wavedrom/skins/lowkey.js';
import narrowSkin from 'wavedrom/skins/narrow.js';
import type { WaveDoc } from '../types';
import { deepClone } from '../model/waveModel';

export const SKIN_NAMES = ['default', 'lowkey', 'narrow', 'dark'] as const;
export type SkinName = (typeof SKIN_NAMES)[number];

const skins: Record<string, unknown> = {
  default: (defaultSkin as any).default,
  dark: (darkSkin as any).dark,
  lowkey: (lowkeySkin as any).lowkey,
  narrow: (narrowSkin as any).narrow,
};

export interface RenderGeometry {
  width: number;
  height: number;
  lanesX: number;
  lanesY: number;
  cellWidth: number;
  rowHeight: number;
  rowTop: number;
  rowCount: number;
  hscale: number;
}

export interface RenderOutcome {
  ok: boolean;
  svg?: SVGSVGElement;
  geometry?: RenderGeometry;
  error?: string;
  skin: SkinName;
}

export interface RenderOptions {
  /** Skin selected in config. Dark theme forces the dark skin. */
  skin?: string;
  darkTheme?: boolean;
  background?: string;
}

export function effectiveSkin(configSkin: string | undefined, darkTheme: boolean): SkinName {
  if (darkTheme) return 'dark';
  return (SKIN_NAMES as readonly string[]).includes(configSkin || '') ? (configSkin as SkinName) : 'default';
}

function parseTranslate(value: string | null): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 };
  const match = /translate\(\s*([-+\d.eE]+)(?:[,\s]+([-+\d.eE]+))?\s*\)/.exec(value);
  if (!match) return { x: 0, y: 0 };
  return { x: Number(match[1]) || 0, y: Number(match[2]) || 0 };
}

function normalizeHscale(value: unknown): number {
  const numeric = Number(value);
  const normalized = numeric > 0 ? Math.round(numeric) : 1;
  return Math.max(1, Math.min(100, normalized));
}

function getNumberAttribute(element: Element | null, name: string, fallback: number): number {
  if (!element) return fallback;
  const value = Number.parseFloat(element.getAttribute(name) || '');
  return Number.isFinite(value) ? value : fallback;
}

function findLaneGroups(svg: SVGSVGElement): SVGGElement[] {
  const all = Array.from(svg.querySelectorAll<SVGGElement>('g[id]'));
  return all.filter((element) => /^wavelane_\d+_\d+$/.test(element.id));
}

function computeGeometry(svg: SVGSVGElement, source: WaveDoc, rowCountHint: number): RenderGeometry {
  const width = getNumberAttribute(svg, 'width', 480);
  const height = getNumberAttribute(svg, 'height', 120);
  const lanesGroup = svg.querySelector<SVGGElement>('g[id^="lanes_"]');
  const translate = parseTranslate(lanesGroup?.getAttribute('transform') || null);
  const laneGroups = findLaneGroups(svg);
  const yPositions = laneGroups.map((group) => parseTranslate(group.getAttribute('transform')).y);
  let rowHeight = 30;
  if (yPositions.length >= 2) {
    const diff = yPositions[1] - yPositions[0];
    if (Number.isFinite(diff) && diff > 0) rowHeight = diff;
  }
  const rowCount = Math.max(rowCountHint, yPositions.length);
  const hscale = normalizeHscale(source.config?.hscale);
  const socket = svg.querySelector('#socket rect');
  const xs = getNumberAttribute(socket, 'width', 20);
  const firstMark = svg.querySelector('#gmarks_0 line');
  const secondMark = svg.querySelectorAll('#gmarks_0 line')[1];
  let cellWidth = 2 * hscale * xs;
  if (firstMark && secondMark) {
    const x1 = getNumberAttribute(firstMark, 'x1', 0);
    const x2 = getNumberAttribute(secondMark, 'x1', 0);
    if (x2 > x1) cellWidth = x2 - x1;
  }
  return {
    width,
    height,
    lanesX: translate.x,
    lanesY: translate.y,
    cellWidth,
    rowHeight,
    rowTop: translate.y,
    rowCount,
    hscale,
  };
}

function applyBackground(svg: SVGSVGElement, background: string) {
  const waves = svg.querySelector('g[id^="waves_"]');
  if (!waves) return;
  const rect = Array.from(waves.children).find((child) => child.tagName.toLowerCase() === 'rect');
  if (rect) {
    rect.setAttribute('style', `stroke:none;fill:${background}`);
    rect.setAttribute('fill', background);
  }
  svg.style.backgroundColor = background;
}

export function skinBackground(skin: SkinName): string {
  return skin === 'dark' ? '#0b1020' : '#ffffff';
}

/**
 * Render WaveJSON through the official WaveDrom engine into a detached host,
 * then return the SVG. Rendering to a temporary node means a WaveDrom failure
 * cannot destroy the last valid diagram.
 */
export function renderWaveDrom(source: WaveDoc, options: RenderOptions = {}): RenderOutcome {
  const skin = effectiveSkin(source.config?.skin, Boolean(options.darkTheme));
  const host = document.createElement('div');
  const renderSource = deepClone(source);
  renderSource.config = { ...(renderSource.config || {}), skin };
  const background = options.background || skinBackground(skin);
  try {
    WaveDrom.renderWaveElement(0, renderSource, host, skins, false, false);
    const svg = host.querySelector<SVGSVGElement>('svg');
    if (!svg) throw new Error('WaveDrom did not produce an SVG element.');
    applyBackground(svg, background);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'WaveDrom timing diagram');
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!svg.getAttribute('xmlns:xlink')) svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const rowCountHint = countLanes(source.signal);
    const geometry = computeGeometry(svg, renderSource, rowCountHint);
    return { ok: true, svg, geometry, skin };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      skin,
    };
  }
}

function countLanes(items: unknown[]): number {
  let count = 0;
  for (const item of items) {
    if (Array.isArray(item)) count += countLanes(item.slice(1));
    else if (item && typeof item === 'object') count += 1;
  }
  return count;
}

export function serializeSvgElement(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('class');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const serialized = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`;
}

export function svgBlob(svgSource: string): Blob {
  return new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
}

export async function renderPngFromSvg(svg: SVGSVGElement, scale = 3): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = Number.parseFloat(clone.getAttribute('width') || '480');
  const height = Number.parseFloat(clone.getAttribute('height') || '160');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    const safeScale = Math.min(scale, Math.max(1, 12000 / Math.max(width, height)));
    canvas.width = Math.max(1, Math.round(width * safeScale));
    canvas.height = Math.max(1, Math.round(height * safeScale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG export is not supported in this browser.');
    const waves = clone.querySelector('g[id^="waves_"] rect');
    const background = waves?.getAttribute('fill') || '#ffffff';
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Could not encode the PNG.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not rasterize the SVG.'));
    image.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(name: string, extension: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'wavedrom';
  return `${base}.${extension}`;
}
