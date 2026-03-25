/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyOperation, S3_ROTATE, S3_SWAP } from "./algebra.ts";

// === Z3 backward compatibility ===

Deno.test("Z3: transform 0 adds 1 mod 3", () => {
  assertEquals(applyOperation(0, 0, "Z3"), 1);
  assertEquals(applyOperation(1, 0, "Z3"), 2);
  assertEquals(applyOperation(2, 0, "Z3"), 0);
});

Deno.test("Z3: transform 1 adds 2 mod 3", () => {
  assertEquals(applyOperation(0, 1, "Z3"), 2);
  assertEquals(applyOperation(1, 1, "Z3"), 0);
  assertEquals(applyOperation(2, 1, "Z3"), 1);
});

// === S3 rotate transitions ===

Deno.test("S3 rotate: up-states cycle R→G→B (forward)", () => {
  // e→r, r→r², r²→e
  assertEquals(applyOperation(0, 0, "S3"), 1);
  assertEquals(applyOperation(1, 0, "S3"), 2);
  assertEquals(applyOperation(2, 0, "S3"), 0);
});

Deno.test("S3 rotate: down-states cycle R→B→G (reverse)", () => {
  // s→sr², sr→s, sr²→sr
  assertEquals(applyOperation(3, 0, "S3"), 5);
  assertEquals(applyOperation(4, 0, "S3"), 3);
  assertEquals(applyOperation(5, 0, "S3"), 4);
});

// === S3 swap transitions ===

Deno.test("S3 swap: flips orientation, preserves color", () => {
  // e↔s, r↔sr, r²↔sr²
  assertEquals(applyOperation(0, 1, "S3"), 3);
  assertEquals(applyOperation(1, 1, "S3"), 4);
  assertEquals(applyOperation(2, 1, "S3"), 5);
  assertEquals(applyOperation(3, 1, "S3"), 0);
  assertEquals(applyOperation(4, 1, "S3"), 1);
  assertEquals(applyOperation(5, 1, "S3"), 2);
});

// === Non-commutativity ===

Deno.test("S3: rotate then swap ≠ swap then rotate", () => {
  // Apply rotate then swap to state 0 (e)
  const rotThenSwap = applyOperation(applyOperation(0, 0, "S3"), 1, "S3");
  // Apply swap then rotate to state 0 (e)
  const swapThenRot = applyOperation(applyOperation(0, 1, "S3"), 0, "S3");

  // r*e = r(1), then s*r = sr(4)
  assertEquals(rotThenSwap, 4);
  // s*e = s(3), then r*s = sr²(5)
  assertEquals(swapThenRot, 5);

  // They differ — this IS the non-commutativity
  assertEquals(rotThenSwap !== swapThenRot, true);
});

// === Group axioms ===

Deno.test("S3: swap is self-inverse (s² = e)", () => {
  for (let state = 0; state < 6; state++) {
    const result = applyOperation(applyOperation(state, 1, "S3"), 1, "S3");
    assertEquals(result, state, `swap(swap(${state})) should equal ${state}`);
  }
});

Deno.test("S3: rotate cubed is identity (r³ = e)", () => {
  for (let state = 0; state < 6; state++) {
    let s = state;
    s = applyOperation(s, 0, "S3");
    s = applyOperation(s, 0, "S3");
    s = applyOperation(s, 0, "S3");
    assertEquals(s, state, `rotate³(${state}) should equal ${state}`);
  }
});

Deno.test("S3: identity element is state 0 (e)", () => {
  // Applying no operations should leave state unchanged
  // Verify e is identity by checking r*e=r, s*e=s, etc. via tables
  assertEquals(S3_ROTATE[0], 1); // r*e = r
  assertEquals(S3_SWAP[0], 3); // s*e = s
});

Deno.test("S3: lookup tables have correct length", () => {
  assertEquals(S3_ROTATE.length, 6);
  assertEquals(S3_SWAP.length, 6);
});

Deno.test("S3: all outputs are valid states (0-5)", () => {
  for (let state = 0; state < 6; state++) {
    const r = applyOperation(state, 0, "S3");
    const s = applyOperation(state, 1, "S3");
    assertEquals(r >= 0 && r < 6, true, `rotate(${state}) out of range: ${r}`);
    assertEquals(s >= 0 && s < 6, true, `swap(${state}) out of range: ${s}`);
  }
});

Deno.test("S3: rotate and swap are bijections (permutations)", () => {
  const rotOutputs = new Set<number>();
  const swapOutputs = new Set<number>();
  for (let state = 0; state < 6; state++) {
    rotOutputs.add(applyOperation(state, 0, "S3"));
    swapOutputs.add(applyOperation(state, 1, "S3"));
  }
  assertEquals(rotOutputs.size, 6, "rotate should be a bijection");
  assertEquals(swapOutputs.size, 6, "swap should be a bijection");
});
