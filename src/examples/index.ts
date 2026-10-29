import spiSource from '../../examples/spi-transaction.json?raw';
import busSource from '../../examples/bus-write.json?raw';
import groupsSource from '../../examples/nested-groups.json?raw';
import edgesSource from '../../examples/edges-and-nodes.json?raw';
import ddrSource from '../../examples/ddr-read.json?raw';
import handshakeSource from '../../examples/handshake.json?raw';

export interface ExampleDocument {
  id: string;
  name: string;
  title: string;
  description: string;
  source: string;
  featured?: boolean;
}

export const EXAMPLES: ExampleDocument[] = [
  {
    id: 'spi',
    name: 'SPI transaction',
    title: 'SPI transaction',
    description: 'Clock, chip select, nested master lanes, bus labels and a relation.',
    source: spiSource,
    featured: true,
  },
  {
    id: 'bus',
    name: 'AXI write',
    title: 'AXI write handshake',
    description: 'Wide hscale waveform with valid/ready signalling and 32-bit data.',
    source: busSource,
  },
  {
    id: 'groups',
    name: 'Nested groups',
    title: 'Nested groups',
    description: 'Master/Slave groups, a nested ctrl group and an empty spacer row.',
    source: groupsSource,
    featured: true,
  },
  {
    id: 'edges',
    name: 'Edges & nodes',
    title: 'Edges and nodes',
    description: 'Node markers, curved relations, orthogonal sharp lines and JSONML text.',
    source: edgesSource,
    featured: true,
  },
  {
    id: 'ddr',
    name: 'DDR read',
    title: 'DDR read transaction',
    description: 'The classic WaveDrom tutorial DDR example with period and phase.',
    source: ddrSource,
  },
  {
    id: 'handshake',
    name: 'Handshake',
    title: 'Request / acknowledge',
    description: 'A minimal, beginner-friendly handshake diagram.',
    source: handshakeSource,
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0];

export const BLANK_SOURCE = JSON.stringify(
  {
    signal: [
      { name: 'clk', wave: 'p.......' },
      { name: 'signal', wave: '0.1..0..' },
    ],
    head: { text: 'Untitled diagram', tick: 0 },
    config: { hscale: 2, skin: 'default' },
  },
  null,
  2,
);
