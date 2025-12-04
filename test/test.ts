import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { Prng } from "../src/mod.ts";

Deno.test("independent streams", () => {
  const a = Prng.create(12345);
  const b = Prng.create(67890);

  const a1 = a.nextU64();
  const b1 = b.nextU64();

  assertNotEquals(a1, b1);

  a.destroy();
  b.destroy();
});

Deno.test("same seed reproduces sequence", () => {
  const a = Prng.create(42);
  const seq = [a.nextU64(), a.nextU64(), a.nextU64()];
  a.destroy();

  const b = Prng.create(42);
  assertEquals(b.nextU64(), seq[0]);
  assertEquals(b.nextU64(), seq[1]);
  assertEquals(b.nextU64(), seq[2]);
  b.destroy();
});

Deno.test("using disposable", () => {
  using rng = Prng.create(999);
  const val = rng.nextF64();
  assertEquals(val >= 0 && val < 1, true);
});

Deno.test("multiple parallel streams", () => {
  const rngs = Array.from({ length: 10 }, (_, i) => Prng.create(i));
  const values = rngs.map((r) => r.nextU64());

  // all unique
  assertEquals(new Set(values).size, 10);

  rngs.forEach((r) => r.destroy());
});

Deno.test("nextU32Range - basic range", () => {
  using rng = Prng.create(123);

  for (let i = 0; i < 100; i++) {
    const val = rng.nextU32Range(10, 20);
    assertEquals(
      val >= 10 && val <= 20,
      true,
      `Value ${val} out of range [10, 20]`,
    );
  }
});

Deno.test("nextU32Range - min equals max", () => {
  using rng = Prng.create(456);

  const val = rng.nextU32Range(42, 42);
  assertEquals(val, 42);
});

Deno.test("nextU32Range - zero to max boundary", () => {
  using rng = Prng.create(789);

  for (let i = 0; i < 50; i++) {
    const val = rng.nextU32Range(0, 100);
    assertEquals(
      val >= 0 && val <= 100,
      true,
      `Value ${val} out of range [0, 100]`,
    );
  }
});

Deno.test("nextF64 - always in [0, 1) range", () => {
  using rng = Prng.create(321);

  for (let i = 0; i < 1000; i++) {
    const val = rng.nextF64();
    assertEquals(val >= 0 && val < 1, true, `Value ${val} out of range [0, 1)`);
  }
});

Deno.test("seed with zero", () => {
  const a = Prng.create(0);
  const b = Prng.create(0);

  assertEquals(a.nextU64(), b.nextU64());

  a.destroy();
  b.destroy();
});

Deno.test("seed with large bigint", () => {
  const largeSeed = 18446744073709551615n; // u64 max
  using rng = Prng.create(largeSeed);

  const val = rng.nextU64();
  assertEquals(typeof val, "bigint");
});

Deno.test("seed with regular number converts to bigint", () => {
  const a = Prng.create(42);
  const b = Prng.create(42n);

  assertEquals(a.nextU64(), b.nextU64());

  a.destroy();
  b.destroy();
});

Deno.test("resource exhaustion - Prng.create() throws when full", () => {
  const rngs: Prng[] = [];

  // Create 256 instances (MAX_INSTANCES)
  for (let i = 0; i < 256; i++) {
    rngs.push(Prng.create(i));
  }

  // 257th should throw
  let threw = false;
  try {
    Prng.create(999);
  } catch (e) {
    threw = true;
    assertEquals(
      (e as Error).message,
      "No PRNG slots available. Use Prng.createAsync() to auto-expand.",
    );
  }
  assertEquals(threw, true, "Expected error when exceeding max instances");

  // Clean up
  rngs.forEach((r) => r.destroy());
});

Deno.test("resource exhaustion - slots are reusable", () => {
  const rngs: Prng[] = [];

  // Create 256 instances
  for (let i = 0; i < 256; i++) {
    rngs.push(Prng.create(i));
  }

  // Destroy first 10
  for (let i = 0; i < 10; i++) {
    rngs[i].destroy();
  }

  // Should be able to create 10 more
  const newRngs: Prng[] = [];
  for (let i = 0; i < 10; i++) {
    newRngs.push(Prng.create(1000 + i));
  }

  // Clean up
  for (let i = 10; i < 256; i++) {
    rngs[i].destroy();
  }
  newRngs.forEach((r) => r.destroy());
});

Deno.test("createAsync - auto-expands when full", async () => {
  const rngs: Prng[] = [];

  // Create 256 instances (MAX_INSTANCES per WASM module)
  for (let i = 0; i < 256; i++) {
    rngs.push(Prng.create(i));
  }

  // 257th via createAsync should succeed by creating new WASM instance
  const extra = await Prng.createAsync(999);
  const val = extra.nextU64();
  assertEquals(typeof val, "bigint");

  // Clean up
  extra.destroy();
  rngs.forEach((r) => r.destroy());
});

Deno.test("createAsync - creates multiple WASM instances as needed", async () => {
  const rngs: Prng[] = [];

  // Create 512 instances (requires 2 WASM modules)
  for (let i = 0; i < 512; i++) {
    rngs.push(await Prng.createAsync(i));
  }

  // Verify they all work
  const values = rngs.map((r) => r.nextU64());
  assertEquals(values.length, 512);

  // Clean up
  rngs.forEach((r) => r.destroy());
});

Deno.test("methods called after destroy return safe defaults", () => {
  const rng = Prng.create(555);
  rng.destroy();

  // These should return default values based on Zig implementation
  const u64 = rng.nextU64();
  assertEquals(u64, 0n);

  const f64 = rng.nextF64();
  assertEquals(f64, 0);

  const u32 = rng.nextU32Range(10, 20);
  assertEquals(u32, 10); // returns min when invalid
});

Deno.test("distribution - nextU64 produces varied values", () => {
  using rng = Prng.create(777);

  const values = new Set<bigint>();
  for (let i = 0; i < 100; i++) {
    values.add(rng.nextU64());
  }

  // Should have high uniqueness (allowing for some collisions)
  assertEquals(
    values.size > 95,
    true,
    `Only ${values.size} unique values out of 100`,
  );
});

Deno.test("distribution - nextF64 covers range", () => {
  using rng = Prng.create(888);

  let hasLow = false; // < 0.33
  let hasMid = false; // 0.33 - 0.66
  let hasHigh = false; // > 0.66

  for (let i = 0; i < 300; i++) {
    const val = rng.nextF64();
    if (val < 0.33) hasLow = true;
    else if (val < 0.66) hasMid = true;
    else hasHigh = true;

    if (hasLow && hasMid && hasHigh) break;
  }

  assertEquals(
    hasLow && hasMid && hasHigh,
    true,
    "nextF64 should cover all ranges",
  );
});

Deno.test("multiple instances maintain independent state", () => {
  const a = Prng.create(100);
  const b = Prng.create(200);

  // Generate some values from a
  const a1 = a.nextU64();
  const a2 = a.nextU64();

  // Generate from b
  const _b1 = b.nextU64();

  // Generate more from a
  const a3 = a.nextU64();

  // a's sequence should be unaffected by b
  const aControl = Prng.create(100);
  assertEquals(aControl.nextU64(), a1);
  assertEquals(aControl.nextU64(), a2);
  assertEquals(aControl.nextU64(), a3);

  a.destroy();
  b.destroy();
  aControl.destroy();
});

Deno.test("double dispose is safe", () => {
  const rng = Prng.create(111);
  rng.destroy();
  rng.destroy(); // should not throw

  // Using Symbol.dispose
  const rng2 = Prng.create(222);
  rng2[Symbol.dispose]();
  rng2[Symbol.dispose](); // should not throw
});

Deno.test("createAsync works for normal case too", async () => {
  const rng = await Prng.createAsync(12345);
  const val = rng.nextU64();
  assertEquals(typeof val, "bigint");
  rng.destroy();
});
