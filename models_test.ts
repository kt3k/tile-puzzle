/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { createGroup, S3Group, Z3Group } from "./models.ts";

// === Z3 Group ===

Deno.test("Z3: transform 0 adds 1 mod 3", () => {
  const g = createGroup("Z3");
  assertEquals(g.apply(0, 0), 1);
  assertEquals(g.apply(1, 0), 2);
  assertEquals(g.apply(2, 0), 0);
});

Deno.test("Z3: transform 1 adds 2 mod 3", () => {
  const g = createGroup("Z3");
  assertEquals(g.apply(0, 1), 2);
  assertEquals(g.apply(1, 1), 0);
  assertEquals(g.apply(2, 1), 1);
});

// === S3 rotate transitions ===

Deno.test("S3 rotate: up-states cycle R→G→B (forward)", () => {
  const g = createGroup("S3");
  assertEquals(g.apply(0, 0), 1);
  assertEquals(g.apply(1, 0), 2);
  assertEquals(g.apply(2, 0), 0);
});

Deno.test("S3 rotate: down-states cycle R→B→G (reverse)", () => {
  const g = createGroup("S3");
  assertEquals(g.apply(3, 0), 5);
  assertEquals(g.apply(4, 0), 3);
  assertEquals(g.apply(5, 0), 4);
});

// === S3 swap transitions ===

Deno.test("S3 swap: flips orientation, preserves color", () => {
  const g = createGroup("S3");
  assertEquals(g.apply(0, 1), 3);
  assertEquals(g.apply(1, 1), 4);
  assertEquals(g.apply(2, 1), 5);
  assertEquals(g.apply(3, 1), 0);
  assertEquals(g.apply(4, 1), 1);
  assertEquals(g.apply(5, 1), 2);
});

// === Non-commutativity ===

Deno.test("S3: rotate then swap ≠ swap then rotate", () => {
  const g = createGroup("S3");
  const rotThenSwap = g.apply(g.apply(0, 0), 1);
  const swapThenRot = g.apply(g.apply(0, 1), 0);
  assertEquals(rotThenSwap, 4);
  assertEquals(swapThenRot, 5);
  assertEquals(rotThenSwap !== swapThenRot, true);
});

// === Group axioms ===

Deno.test("S3: swap is self-inverse (s² = e)", () => {
  const g = createGroup("S3");
  for (let state = 0; state < 6; state++) {
    const result = g.apply(g.apply(state, 1), 1);
    assertEquals(result, state, `swap(swap(${state})) should equal ${state}`);
  }
});

Deno.test("S3: rotate cubed is identity (r³ = e)", () => {
  const g = createGroup("S3");
  for (let state = 0; state < 6; state++) {
    let s = state;
    s = g.apply(s, 0);
    s = g.apply(s, 0);
    s = g.apply(s, 0);
    assertEquals(s, state, `rotate³(${state}) should equal ${state}`);
  }
});

Deno.test("S3: all outputs are valid states (0-5)", () => {
  const g = createGroup("S3");
  for (let state = 0; state < 6; state++) {
    const r = g.apply(state, 0);
    const s = g.apply(state, 1);
    assertEquals(r >= 0 && r < 6, true, `rotate(${state}) out of range: ${r}`);
    assertEquals(s >= 0 && s < 6, true, `swap(${state}) out of range: ${s}`);
  }
});

Deno.test("S3: rotate and swap are bijections (permutations)", () => {
  const g = createGroup("S3");
  const rotOutputs = new Set<number>();
  const swapOutputs = new Set<number>();
  for (let state = 0; state < 6; state++) {
    rotOutputs.add(g.apply(state, 0));
    swapOutputs.add(g.apply(state, 1));
  }
  assertEquals(rotOutputs.size, 6, "rotate should be a bijection");
  assertEquals(swapOutputs.size, 6, "swap should be a bijection");
});

// === Group class properties ===

Deno.test("createGroup returns correct types", () => {
  assertEquals(createGroup("Z3") instanceof Z3Group, true);
  assertEquals(createGroup("S3") instanceof S3Group, true);
});

Deno.test("Z3Group.isFlipped always returns false", () => {
  const g = createGroup("Z3");
  for (let state = 0; state < 3; state++) {
    assertEquals(g.isFlipped(state), false);
  }
});

Deno.test("S3Group.isFlipped matches orientation", () => {
  const g = createGroup("S3");
  assertEquals(g.isFlipped(0), false);
  assertEquals(g.isFlipped(1), false);
  assertEquals(g.isFlipped(2), false);
  assertEquals(g.isFlipped(3), true);
  assertEquals(g.isFlipped(4), true);
  assertEquals(g.isFlipped(5), true);
});

Deno.test("Group stateColors/stateLabels have correct length", () => {
  const z3 = createGroup("Z3");
  const s3 = createGroup("S3");
  assertEquals(z3.stateColors.length, z3.stateCount);
  assertEquals(z3.stateLabels.length, z3.stateCount);
  assertEquals(s3.stateColors.length, s3.stateCount);
  assertEquals(s3.stateLabels.length, s3.stateCount);
});

Deno.test("Group shape property", () => {
  assertEquals(createGroup("Z3").shape, "circle");
  assertEquals(createGroup("S3").shape, "triangle");
});
