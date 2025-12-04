# @nullstyle/urand

A fast, seedable PRNG for Deno/JSR, powered by Zig's Xoshiro256** implementation compiled to WebAssembly.

## Install
```typescript
import { Prng } from "jsr:@nullstyle/urand";
```

## Usage
```typescript
const rng = new Prng(12345n);

rng.nextU64();           // random bigint
rng.nextF64();           // random float in [0, 1)
rng.nextU32Range(1, 100); // random int in [1, 100]

rng.destroy();
```

Or with automatic cleanup:
```typescript
using rng = new Prng(42);
console.log(rng.nextF64());
// destroyed automatically when scope exits
```

## API

### `new Prng(seed: bigint | number)`

Creates a new PRNG instance with the given seed. Same seed produces identical sequences.

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
