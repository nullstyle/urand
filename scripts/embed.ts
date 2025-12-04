import { encodeBase64 } from "jsr:@std/encoding/base64";

const wasm = await Deno.readFile("prng.wasm");
const b64 = encodeBase64(wasm);

// Generate wasm-bytes.ts
const wasmBytes = `// Generated - do not edit
export const WASM_BASE64 = "${b64}";
`;

await Deno.writeTextFile("src/wasm-bytes.ts", wasmBytes);
