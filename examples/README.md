# Example WaveJSON files

These files are loaded by the in-app **Examples** menu and are bundled into the static build through
`src/examples/index.ts`.

| File | What it demonstrates |
| --- | --- |
| `spi-transaction.json` | Positive/negative clocks, a named group, bus labels, a relation label, header and footer |
| `bus-write.json` | AXI-style handshakes, a wide `hscale` rendering, 32-bit bus payloads |
| `nested-groups.json` | Nested named groups, an empty `{}` spacer lane, array data labels |
| `edges-and-nodes.json` | Node markers, curved edges, orthogonal sharp lines, JSONML head text, mixed phases |
| `ddr-read.json` | The original WaveDrom DDR tutorial sequence with per-lane `period` and `phase` |
| `handshake.json` | Minimal request/acknowledge logic with an annotation node |

To inspect one outside the app:

```bash
pnpm dev
# open the Examples menu, or open examples/<name>.json in a text editor
```

All files are strict JSON, although the in-app editor also accepts JSON5. Unknown WaveJSON fields are preserved when the
application renders and rewrites a document.
