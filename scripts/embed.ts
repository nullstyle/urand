import { encodeBase64 } from "@std/encoding/base64";

const wasm = await Deno.readFile("prng.wasm");
const b64 = encodeBase64(wasm);

const wasmBytes = `// Generated - do not edit
export const WASM_BASE64 = "${b64}";
`;

await Deno.writeTextFile("src/wasm-bytes.ts", wasmBytes);
console.log(`Generated src/wasm-bytes.ts (${wasm.byteLength} bytes WASM)`);
