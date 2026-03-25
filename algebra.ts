// === Algebra module — pure group operations, no DOM dependency ===

export type GroupType = "Z3" | "S3";

// S3 operation lookup tables (left-multiply by operation on state)
// States: 0=e, 1=r, 2=r², 3=s, 4=sr, 5=sr²

// Left-multiply by r (rotate): e→r, r→r², r²→e, s→sr², sr→s, sr²→sr
export const S3_ROTATE: readonly number[] = [1, 2, 0, 5, 3, 4];

// Left-multiply by s (swap): e→s, r→sr, r²→sr², s→e, sr→r, sr²→r²
export const S3_SWAP: readonly number[] = [3, 4, 5, 0, 1, 2];

/**
 * Apply a group operation to a state.
 *
 * For Z3: transform 0 = +1 (mod 3), transform 1 = +2 (mod 3)
 * For S3: transform 0 = rotate (left-multiply by r), transform 1 = swap (left-multiply by s)
 */
export function applyOperation(
  state: number,
  transform: number,
  group: GroupType,
): number {
  if (group === "Z3") {
    return (state + transform + 1) % 3;
  }
  // S3
  if (transform === 0) return S3_ROTATE[state];
  if (transform === 1) return S3_SWAP[state];
  return state;
}
