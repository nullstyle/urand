// Generated - do not edit
import { decodeBase64 } from "@std/encoding/base64";
import { WASM_BASE64 } from "./wasm-bytes.ts";

let wasm: {
  create: (s: bigint) => number;
  destroy: (handle: number) => void;
  nextU64: (handle: number) => bigint;
  nextF64: (handle: number) => number;
  nextU32Range: (handle: number, min: number, max: number) => number;
};

const wasmBytes = decodeBase64(WASM_BASE64);
const { instance } = await WebAssembly.instantiate(wasmBytes) as unknown as {
  instance: WebAssembly.Instance;
};
wasm = instance.exports as typeof wasm;

export class Prng {
  #handle: number;

  constructor(seed: bigint | number) {
    this.#handle = wasm.create(BigInt(seed));
    if (this.#handle < 0) {
      throw new Error("Failed to create PRNG instance (max instances reached)");
    }
  }

  nextU64(): bigint {
    return wasm.nextU64(this.#handle);
  }

  nextF64(): number {
    return wasm.nextF64(this.#handle);
  }

  nextU32Range(min: number, max: number): number {
    return wasm.nextU32Range(this.#handle, min, max);
  }

  destroy(): void {
    wasm.destroy(this.#handle);
  }

  [Symbol.dispose](): void {
    this.destroy();
  }
}
