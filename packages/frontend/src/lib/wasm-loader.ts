let wasmModule: any = null;
let loadingPromise: Promise<any> | null = null;

export async function loadTwinWasm(): Promise<{
  compute_twin_frame: (json: string, time: number) => string;
  interpolate_frames: (a: string, b: string, t: number) => string;
  map_signals_to_regions: (json: string) => string;
  compute_protocol_projection: (snapshot: string, protocols: string, cohort: string, weeks: number, time: number) => string;
} | null> {
  if (wasmModule) return wasmModule;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const wasmUrl = '/wasm/longevity_twin_bg.wasm';
      const response = await fetch(wasmUrl);
      const bytes = await response.arrayBuffer();

      const importObject = {
        './longevity_twin_bg.js': {
          __wbindgen_init_externref_table: function () {
            const table = (instance.exports as any).__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
          },
        },
      };

      const { instance } = await WebAssembly.instantiate(bytes, importObject);
      const wasm = instance.exports as any;

      // Initialize
      wasm.__wbindgen_start();

      let cachedUint8Memory: Uint8Array | null = null;
      function getMemory() {
        if (!cachedUint8Memory || cachedUint8Memory.byteLength === 0) {
          cachedUint8Memory = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8Memory;
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
      let WASM_VECTOR_LEN = 0;

      function passString(arg: string): number {
        const buf = encoder.encode(arg);
        const ptr = wasm.__wbindgen_malloc(buf.length, 1) >>> 0;
        getMemory().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
      }

      function getString(ptr: number, len: number): string {
        return decoder.decode(getMemory().subarray(ptr >>> 0, (ptr >>> 0) + len));
      }

      function compute_twin_frame(signalsJson: string, time: number): string {
        let d0 = 0, d1 = 0;
        try {
          const ptr0 = passString(signalsJson);
          const len0 = WASM_VECTOR_LEN;
          cachedUint8Memory = null;
          const ret = wasm.compute_twin_frame(ptr0, len0, time);
          d0 = ret[0]; d1 = ret[1];
          cachedUint8Memory = null;
          return getString(ret[0], ret[1]);
        } finally {
          wasm.__wbindgen_free(d0, d1, 1);
          cachedUint8Memory = null;
        }
      }

      function interpolate_frames(a: string, b: string, t: number): string {
        let d0 = 0, d1 = 0;
        try {
          const ptr0 = passString(a);
          const len0 = WASM_VECTOR_LEN;
          const ptr1 = passString(b);
          const len1 = WASM_VECTOR_LEN;
          cachedUint8Memory = null;
          const ret = wasm.interpolate_frames(ptr0, len0, ptr1, len1, t);
          d0 = ret[0]; d1 = ret[1];
          cachedUint8Memory = null;
          return getString(ret[0], ret[1]);
        } finally {
          wasm.__wbindgen_free(d0, d1, 1);
          cachedUint8Memory = null;
        }
      }

      function map_signals_to_regions(json: string): string {
        let d0 = 0, d1 = 0;
        try {
          const ptr0 = passString(json);
          const len0 = WASM_VECTOR_LEN;
          cachedUint8Memory = null;
          const ret = wasm.map_signals_to_regions(ptr0, len0);
          d0 = ret[0]; d1 = ret[1];
          cachedUint8Memory = null;
          return getString(ret[0], ret[1]);
        } finally {
          wasm.__wbindgen_free(d0, d1, 1);
          cachedUint8Memory = null;
        }
      }

      function compute_protocol_projection(snapshot: string, protocols: string, cohort: string, weeks: number, time: number): string {
        let d0 = 0, d1 = 0;
        try {
          const ptr0 = passString(snapshot);
          const len0 = WASM_VECTOR_LEN;
          const ptr1 = passString(protocols);
          const len1 = WASM_VECTOR_LEN;
          const ptr2 = passString(cohort);
          const len2 = WASM_VECTOR_LEN;
          cachedUint8Memory = null;
          const ret = wasm.compute_protocol_projection(ptr0, len0, ptr1, len1, ptr2, len2, weeks, time);
          d0 = ret[0]; d1 = ret[1];
          cachedUint8Memory = null;
          return getString(ret[0], ret[1]);
        } finally {
          wasm.__wbindgen_free(d0, d1, 1);
          cachedUint8Memory = null;
        }
      }

      wasmModule = { compute_twin_frame, interpolate_frames, map_signals_to_regions, compute_protocol_projection };
      return wasmModule;
    } catch (err) {
      console.warn('WASM twin failed to load, using JS fallback:', err);
      return null;
    }
  })();

  return loadingPromise;
}
