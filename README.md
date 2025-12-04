# @nullstyle/urand

A fast, seedable PRNG for Deno/JSR, powered by Zig's Xoshiro256** implementation compiled to WebAssembly.

## Install

```typescript
import { Prng } from "jsr:@nullstyle/urand";
```

## Usage

```typescript
const rng = Prng.create(12345n);

rng.nextU64();            // random bigint
rng.nextF64();            // random float in [0, 1)
rng.nextU32Range(1, 100); // random int in [1, 100]

rng.destroy();
```

Or with automatic cleanup:

```typescript
using rng = Prng.create(42);
console.log(rng.nextF64());
// destroyed automatically when scope exits
```

### Auto-expanding streams

Each WASM module supports up to 256 concurrent PRNG streams. Use `createAsync()` to automatically instantiate additional WASM modules when needed:

```typescript
const rngs = await Promise.all(
  Array.from({ length: 1000 }, (_, i) => Prng.createAsync(i))
);
// Creates ~4 WASM modules to support 1000 streams
```

## API

### `Prng.create(seed: bigint | number): Prng`

Creates a new PRNG instance synchronously. Throws if all slots are exhausted (256 per WASM module). Use `createAsync()` if you need auto-expansion.

### `Prng.createAsync(seed: bigint | number): Promise<Prng>`

Creates a new PRNG instance, automatically instantiating additional WASM modules if all existing slots are full.

### `nextU64(): bigint`

Returns a random 64-bit unsigned integer.

### `nextF64(): number`

Returns a random float in the range [0, 1).

### `nextU32Range(min: number, max: number): number`

Returns a random 32-bit unsigned integer in the inclusive range [min, max].

### `destroy(): void`

Releases the PRNG instance. Also available via `Symbol.dispose` for use with `using`.

## Building from source

Requires [mise](https://mise.jdx.dev/):

```bash
mise install
deno task build
deno task test
```

## License

MIT