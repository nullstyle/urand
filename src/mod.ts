import { decodeBase64 } from "@std/encoding/base64";
import { WASM_BASE64 } from "./wasm-bytes.ts";

type WasmExports = {
  create: (s: bigint) => number;
  destroy: (handle: number) => void;
  nextU64: (handle: number) => bigint;
  nextF64: (handle: number) => number;
  nextU32Range: (handle: number, min: number, max: number) => number;
};

const wasmBytes = decodeBase64(WASM_BASE64);
const instances: WasmExports[] = [];

async function createWasmInstance(): Promise<WasmExports> {
  const { instance } =
    (await WebAssembly.instantiate(wasmBytes)) as unknown as {
      instance: WebAssembly.Instance;
    };
  return instance.exports as WasmExports;
}

// Initialize with one instance
instances.push(await createWasmInstance());

export class Prng {
  #instance: WasmExports;
  #handle: number;

  private constructor(instance: WasmExports, handle: number) {
    this.#instance = instance;
    this.#handle = handle;
  }

  static create(seed: bigint | number): Prng {
    // Try to find an instance with available slots
    for (const inst of instances) {
      const handle = inst.create(BigInt(seed));
      if (handle >= 0) {
        return new Prng(inst, handle);
      }
    }

    throw new Error(
      "No PRNG slots available. Use Prng.createAsync() to auto-expand.",
    );
  }

  static async createAsync(seed: bigint | number): Promise<Prng> {
    // Try existing instances first
    for (const inst of instances) {
      const handle = inst.create(BigInt(seed));
      if (handle >= 0) {
        return new Prng(inst, handle);
      }
    }

    // All full - create a new WASM instance
    const newInst = await createWasmInstance();
    instances.push(newInst);

    const handle = newInst.create(BigInt(seed));
    if (handle < 0) {
      throw new Error("Failed to create PRNG instance in new WASM module");
    }

    return new Prng(newInst, handle);
  }

  nextU64(): bigint {
    return this.#instance.nextU64(this.#handle);
  }

  nextF64(): number {
    return this.#instance.nextF64(this.#handle);
  }

  nextU32Range(min: number, max: number): number {
    return this.#instance.nextU32Range(this.#handle, min, max);
  }

  destroy(): void {
    this.#instance.destroy(this.#handle);
  }

  [Symbol.dispose](): void {
    this.destroy();
  }
}
