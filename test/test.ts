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

// ============================================
// Additional coverage tests
// ============================================

Deno.test("nextU32Range - large values near u32 max", () => {
  using rng = Prng.create(999);
  // Note: WASM returns u32 which JS interprets as signed i32 for values > 2^31-1
  // This test uses safe range values
  const max = 0x7FFFFFFF; // i32 max (safe for JS)
  const min = max - 100;

  for (let i = 0; i < 100; i++) {
    const val = rng.nextU32Range(min, max);
    assertEquals(
      val >= min && val <= max,
      true,
      `Value ${val} out of range [${min}, ${max}]`,
    );
  }
});

Deno.test("nextU32Range - full u32 range returns valid values", () => {
  using rng = Prng.create(1234);

  // When using full u32 range, values above 2^31-1 appear as negative
  // in JavaScript due to signed integer interpretation
  // This test verifies the function doesn't crash and returns deterministic values
  const values: number[] = [];
  for (let i = 0; i < 100; i++) {
    values.push(rng.nextU32Range(0, 0xFFFFFFFF));
  }

  // Verify determinism
  const rng2 = Prng.create(1234);
  for (let i = 0; i < 100; i++) {
    assertEquals(rng2.nextU32Range(0, 0xFFFFFFFF), values[i]);
  }
  rng2.destroy();
});

Deno.test("nextU32Range - signed interpretation for large values", () => {
  // Document and test the signed interpretation behavior
  using rng = Prng.create(42424);

  // Generate many values in high u32 range
  let hasNegative = false;
  for (let i = 0; i < 1000; i++) {
    const val = rng.nextU32Range(0x80000000, 0xFFFFFFFF);
    // Values in this range will appear negative in JS
    if (val < 0) {
      hasNegative = true;
      // Convert to unsigned for verification
      const unsigned = val >>> 0;
      assertEquals(
        unsigned >= 0x80000000 && unsigned <= 0xFFFFFFFF,
        true,
        `Unsigned value ${unsigned} out of expected range`,
      );
    }
  }

  // We expect to see negative values due to signed interpretation
  assertEquals(hasNegative, true, "Expected negative values for high u32 range");
});

Deno.test("nextU32Range - distribution uniformity", () => {
  using rng = Prng.create(5555);

  const buckets = [0, 0, 0, 0]; // 4 buckets for range 0-99
  const iterations = 4000;

  for (let i = 0; i < iterations; i++) {
    const val = rng.nextU32Range(0, 99);
    const bucket = Math.floor(val / 25);
    buckets[bucket]++;
  }

  // Each bucket should have roughly 1000 values (25% each)
  // Allow 20% deviation for randomness
  const expected = iterations / 4;
  for (let i = 0; i < 4; i++) {
    const deviation = Math.abs(buckets[i] - expected) / expected;
    assertEquals(
      deviation < 0.2,
      true,
      `Bucket ${i} has ${buckets[i]} values, expected ~${expected} (deviation: ${(deviation * 100).toFixed(1)}%)`,
    );
  }
});

Deno.test("nextU64 - distribution uniformity across bit ranges", () => {
  using rng = Prng.create(7777);

  let lowBitsVaried = false;
  let highBitsVaried = false;
  const values: bigint[] = [];

  for (let i = 0; i < 100; i++) {
    values.push(rng.nextU64());
  }

  // Check low 32 bits vary
  const lowBits = values.map((v) => v & 0xFFFFFFFFn);
  if (new Set(lowBits).size > 90) lowBitsVaried = true;

  // Check high 32 bits vary
  const highBits = values.map((v) => v >> 32n);
  if (new Set(highBits).size > 90) highBitsVaried = true;

  assertEquals(lowBitsVaried, true, "Low 32 bits should vary");
  assertEquals(highBitsVaried, true, "High 32 bits should vary");
});

Deno.test("negative number seed is handled", () => {
  // Negative numbers get converted to BigInt which may behave unexpectedly
  // This test verifies it doesn't crash and produces deterministic output
  const a = Prng.create(-1);
  const b = Prng.create(-1);

  assertEquals(a.nextU64(), b.nextU64());

  a.destroy();
  b.destroy();
});

Deno.test("long sequence - no early repetition", () => {
  using rng = Prng.create(11111);

  const values = new Set<bigint>();
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    values.add(rng.nextU64());
  }

  // With a 64-bit PRNG, 10000 values should all be unique
  assertEquals(
    values.size,
    iterations,
    `Expected ${iterations} unique values, got ${values.size}`,
  );
});

Deno.test("nextF64 - values close to boundaries", () => {
  // Run many iterations to check we get values close to 0 and close to 1
  using rng = Prng.create(22222);

  let hasVeryLow = false; // < 0.01
  let hasVeryHigh = false; // > 0.99

  for (let i = 0; i < 1000; i++) {
    const val = rng.nextF64();
    if (val < 0.01) hasVeryLow = true;
    if (val > 0.99) hasVeryHigh = true;

    // Verify never equals 1.0
    assertEquals(val < 1.0, true, "nextF64 should never return 1.0");

    if (hasVeryLow && hasVeryHigh) break;
  }

  assertEquals(hasVeryLow, true, "Should produce values < 0.01");
  assertEquals(hasVeryHigh, true, "Should produce values > 0.99");
});

Deno.test("concurrent createAsync calls", async () => {
  // Create many PRNGs concurrently
  const promises = Array.from({ length: 50 }, (_, i) =>
    Prng.createAsync(i + 10000)
  );

  const rngs = await Promise.all(promises);

  // All should be valid and produce values
  const values = rngs.map((r) => r.nextU64());
  assertEquals(values.length, 50);

  // All values should be unique (different seeds)
  assertEquals(new Set(values).size, 50);

  // Clean up
  rngs.forEach((r) => r.destroy());
});

Deno.test("createAsync during resource exhaustion - concurrent", async () => {
  // First exhaust the sync pool
  const syncRngs: Prng[] = [];
  for (let i = 0; i < 256; i++) {
    syncRngs.push(Prng.create(i));
  }

  // Now create multiple async PRNGs concurrently
  const asyncPromises = Array.from({ length: 20 }, (_, i) =>
    Prng.createAsync(i + 1000)
  );

  const asyncRngs = await Promise.all(asyncPromises);

  // All should work
  for (const rng of asyncRngs) {
    const val = rng.nextU64();
    assertEquals(typeof val, "bigint");
  }

  // Clean up
  syncRngs.forEach((r) => r.destroy());
  asyncRngs.forEach((r) => r.destroy());
});

Deno.test("deterministic sequence - multiple method calls", () => {
  // Verify that calling different methods in sequence is deterministic
  const seq1: (bigint | number)[] = [];
  const seq2: (bigint | number)[] = [];

  const a = Prng.create(33333);
  seq1.push(a.nextU64());
  seq1.push(a.nextF64());
  seq1.push(a.nextU32Range(0, 1000));
  seq1.push(a.nextU64());
  seq1.push(a.nextF64());
  a.destroy();

  const b = Prng.create(33333);
  seq2.push(b.nextU64());
  seq2.push(b.nextF64());
  seq2.push(b.nextU32Range(0, 1000));
  seq2.push(b.nextU64());
  seq2.push(b.nextF64());
  b.destroy();

  assertEquals(seq1, seq2);
});

Deno.test("different seeds produce different first values", () => {
  const firstValues = new Map<bigint, number>();

  for (let seed = 0; seed < 100; seed++) {
    using rng = Prng.create(seed);
    const val = rng.nextU64();

    // Check this value hasn't been seen from a different seed
    if (firstValues.has(val)) {
      throw new Error(
        `Seeds ${firstValues.get(val)} and ${seed} produced same first value`,
      );
    }
    firstValues.set(val, seed);
  }

  assertEquals(firstValues.size, 100);
});

Deno.test("Symbol.dispose works with using declaration", () => {
  let destroyed = false;

  {
    using rng = Prng.create(44444);
    const _val = rng.nextU64();
    // rng should be disposed when block exits
  }

  // Can't directly test if destroyed, but we can verify no crash
  // and that creating new ones works
  using rng2 = Prng.create(44444);
  assertEquals(typeof rng2.nextU64(), "bigint");
});

Deno.test("rapid create/destroy cycles", () => {
  // Stress test rapid allocation/deallocation
  for (let i = 0; i < 1000; i++) {
    const rng = Prng.create(i);
    const _val = rng.nextU64();
    rng.destroy();
  }

  // Verify system is still working
  using rng = Prng.create(99999);
  assertEquals(typeof rng.nextU64(), "bigint");
});
