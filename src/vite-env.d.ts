/// <reference types="vite/client" />

declare module 'wavedrom' {
  interface WavedromSkin {
    [name: string]: unknown;
  }
  const WaveDrom: {
    version: string;
    renderWaveElement: (
      index: number,
      source: unknown,
      outputElement: HTMLElement,
      waveSkin: WavedromSkin,
      notFirstSignal?: boolean,
      notFirstAssign?: boolean,
    ) => void;
    renderAny: (index: number, source: unknown, waveSkin: WavedromSkin, notFirstSignal?: boolean, notFirstAssign?: boolean) => unknown;
    waveSkin: unknown;
  };
  export default WaveDrom;
}

declare module 'wavedrom/skins/default.js' {
  const skin: { default: unknown };
  export default skin;
}
declare module 'wavedrom/skins/dark.js' {
  const skin: { dark: unknown };
  export default skin;
}
declare module 'wavedrom/skins/lowkey.js' {
  const skin: { lowkey: unknown };
  export default skin;
}
declare module 'wavedrom/skins/narrow.js' {
  const skin: { narrow: unknown };
  export default skin;
}
