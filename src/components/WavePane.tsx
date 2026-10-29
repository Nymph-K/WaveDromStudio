import { AlertTriangle, CircleDot, Gauge, Rows3 } from 'lucide-react';
import { useAppStore } from '../state/appStore';
import { effectiveSkin } from '../renderer/wavedromEngine';
import { flattenLanes, maxWaveWidth } from '../model/waveModel';
import WaveCanvas from './WaveCanvas';
import { useI18n } from '../lib/useI18n';

const PAINT_CHARS: { char: string; label: string; group: string }[] = [
  { char: '0', label: 'Low level', group: 'logic' },
  { char: '1', label: 'High level', group: 'logic' },
  { char: 'x', label: 'Unknown / don’t care', group: 'logic' },
  { char: 'z', label: 'High impedance', group: 'logic' },
  { char: '.', label: 'Repeat previous state', group: 'logic' },
  { char: '=', label: 'Data bus', group: 'bus' },
  { char: '2', label: 'Coloured bus', group: 'bus' },
  { char: '3', label: 'Coloured bus', group: 'bus' },
  { char: '4', label: 'Coloured bus', group: 'bus' },
  { char: '5', label: 'Coloured bus', group: 'bus' },
  { char: '6', label: 'Coloured bus', group: 'bus' },
  { char: '7', label: 'Coloured bus', group: 'bus' },
  { char: '8', label: 'Coloured bus', group: 'bus' },
  { char: '9', label: 'Coloured bus', group: 'bus' },
  { char: 'u', label: 'Bus up transition', group: 'bus' },
  { char: 'd', label: 'Bus down transition', group: 'bus' },
  { char: 'p', label: 'Positive clock', group: 'clock' },
  { char: 'n', label: 'Negative clock', group: 'clock' },
  { char: 'P', label: 'Positive edge marker', group: 'clock' },
  { char: 'N', label: 'Negative edge marker', group: 'clock' },
  { char: 'h', label: 'High clock phase', group: 'clock' },
  { char: 'l', label: 'Low clock phase', group: 'clock' },
  { char: 'H', label: 'High edge marker', group: 'clock' },
  { char: 'L', label: 'Low edge marker', group: 'clock' },
  { char: '|', label: 'Gap marker', group: 'special' },
  { char: '<', label: 'Sub-cycle on', group: 'special' },
  { char: '>', label: 'Sub-cycle off', group: 'special' },
];

export default function WavePane() {
  const doc = useAppStore((state) => state.docs.find((item) => item.id === state.activeId) || state.docs[0]);
  const theme = useAppStore((state) => state.theme);
  const paintCharacter = useAppStore((state) => state.paintCharacter);
  const { t } = useI18n();
  if (!doc) return null;
  const laneCount = flattenLanes(doc.data).length;
  const width = maxWaveWidth(doc.data);
  const skin = effectiveSkin(doc.data.config?.skin, theme === 'dark');

  return (
    <section className="pane wave-pane" aria-label={t('Waveform')}>
      <div className="pane-toolbar wave-toolbar">
        <div className="pane-title-group">
          <div className="pane-eyebrow">
            <span className="pane-kicker"><CircleDot size={11} /> {t('WAVEFORM')}</span>
            <span className="pane-meta"><Rows3 size={12} /> {laneCount} {t('lanes')}</span>
            <span className="pane-meta"><Gauge size={12} /> {width} {t('cycles')}</span>
          </div>
          <div className="doc-title-row">
            <h1>{doc.name}</h1>
            <span className="render-badge">WaveDrom SVG</span>
            <span className="skin-badge">{t(skin)} {t('skin')}</span>
            {doc.parseError && (
              <span className="stale-badge" title={t('The canvas is showing the last valid WaveJSON')}>
                <AlertTriangle size={11} /> {t('stale preview')}
              </span>
            )}
          </div>
        </div>
        <div className="pane-toolbar-spacer" />
        <div className="paint-tools" role="group" aria-label={t('Paint waveform characters')}>
          <span className="paint-label">{t('PAINT')}</span>
          <div className="paint-chars">
            {PAINT_CHARS.map((item, index) => {
              const previous = PAINT_CHARS[index - 1];
              return (
                <span className={`paint-key-wrap ${previous && previous.group !== item.group ? 'group-start' : ''}`} key={item.char}>
                  <button
                    type="button"
                    className={`paint-key paint-${item.group}`}
                    title={`${item.char} — ${t(item.label)}`}
                    onClick={() => paintCharacter(item.char, doc.id)}
                  >
                    {item.char}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <WaveCanvas key={doc.id} doc={doc} />
    </section>
  );
}
