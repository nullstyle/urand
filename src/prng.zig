const std = @import("std");

const MAX_INSTANCES = 256;

var instances: [MAX_INSTANCES]?std.Random.DefaultPrng = [_]?std.Random.DefaultPrng{null} ** MAX_INSTANCES;

export fn create(s: u64) i32 {
    for (0..MAX_INSTANCES) |i| {
        if (instances[i] == null) {
            instances[i] = std.Random.DefaultPrng.init(s);
            return @intCast(i);
        }
    }
    return -1; // no slots available
}

export fn destroy(handle: i32) void {
    if (handle >= 0 and handle < MAX_INSTANCES) {
        instances[@intCast(handle)] = null;
    }
}

export fn nextU64(handle: i32) u64 {
    if (handle >= 0 and handle < MAX_INSTANCES) {
        if (instances[@intCast(handle)]) |*prng| {
            return prng.random().int(u64);
        }
    }
    return 0;
}

export fn nextF64(handle: i32) f64 {
    if (handle >= 0 and handle < MAX_INSTANCES) {
        if (instances[@intCast(handle)]) |*prng| {
            return prng.random().float(f64);
        }
    }
    return 0;
}

export fn nextU32Range(handle: i32, min: u32, max: u32) u32 {
    if (handle >= 0 and handle < MAX_INSTANCES) {
        if (instances[@intCast(handle)]) |*prng| {
            return prng.random().intRangeAtMost(u32, min, max);
        }
    }
    return min;
}
