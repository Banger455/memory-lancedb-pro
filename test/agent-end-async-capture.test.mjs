import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "..", "index.ts"), "utf8");

// ---------------------------------------------------------------------------
// 1.  AgentEndAutoCaptureHook type allows Promise<void>
// ---------------------------------------------------------------------------
describe("agent_end hook – async type signature", () => {
  it("AgentEndAutoCaptureHook return type includes Promise<void>", () => {
    const typeRe =
      /type\s+AgentEndAutoCaptureHook\s*=\s*\([^)]*\)\s*=>\s*Promise<void>\s*\|\s*void/;
    assert.match(src, typeRe, "Return type should be Promise<void> | void");
  });

  it("hook is declared async", () => {
    assert.ok(
      src.includes("= async (event, ctx) => {"),
      "agentEndAutoCaptureHook should be an async arrow function",
    );
  });
});

// ---------------------------------------------------------------------------
// 2.  backgroundRun is awaited with a safety timeout, not fire-and-forget
// ---------------------------------------------------------------------------
describe("agent_end hook – await with safety timeout", () => {
  it("uses Promise.race with a timeout", () => {
    assert.ok(
      src.includes("await Promise.race(["),
      "backgroundRun should be awaited via Promise.race",
    );
    assert.ok(
      src.includes("setTimeout(resolve, 15_000)"),
      "safety timeout should be 15 000 ms",
    );
  });

  it("does NOT use fire-and-forget void", () => {
    const lines = src.split("\n");
    const fireAndForget = lines.some(
      (l) => l.trim() === "void backgroundRun;" || l.trim() === "void backgroundRun",
    );
    assert.ok(!fireAndForget, "fire-and-forget 'void backgroundRun' must be removed");
  });

  it("swallows errors so the host agent is never broken", () => {
    const idx = src.indexOf("await Promise.race([");
    assert.ok(idx > -1, "Promise.race must exist");
    const after = src.slice(idx, idx + 600);
    assert.ok(
      after.includes("catch"),
      "there must be a catch block around the await",
    );
  });

  it("cleans up the safety timer", () => {
    assert.ok(
      src.includes("clearTimeout(safetyTimer)"),
      "safetyTimer must be cleared in a finally block",
    );
  });
});

// ---------------------------------------------------------------------------
// 3.  Early-return guard for empty output
// ---------------------------------------------------------------------------
describe("agent_end hook – early-return guard", () => {
  it("returns early when event output is empty", () => {
    const hookStart = src.indexOf("= async (event, ctx) => {");
    assert.ok(hookStart > -1, "async hook must exist");
    const slice = src.slice(hookStart, hookStart + 1500);
    const hasGuard =
      slice.includes("!output") ||
      slice.includes("output.length === 0") ||
      slice.includes("output?.length");
    assert.ok(hasGuard, "hook should guard against empty output");
  });
});
