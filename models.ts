// === Domain Models ===

// === Shared Types ===
export interface Vec2 {
  x: number;
  y: number;
}

export interface Operation {
  x: number;
  y: number;
  transform: number;
}

export interface Goal {
  id: number;
  x: number;
  y: number;
  requiredState: number;
}

export interface StageData {
  name: string;
  map: string[];
  player: Vec2;
  targets: { pos: Vec2; state: number }[];
  operations: { pos: Vec2; transform: number }[];
  goals: { pos: Vec2; requiredState: number }[];
  group?: GroupType;
}

interface ParsedTarget {
  id: number;
  x: number;
  y: number;
  state: number;
  initialState: number;
}

// === Group ===

export type GroupType = "Z3" | "S3";

export interface Group {
  readonly type: GroupType;
  readonly stateCount: number;
  readonly stateColors: readonly string[];
  readonly stateLabels: readonly string[];
  readonly shape: "circle" | "triangle";
  apply(state: number, transform: number): number;
  isFlipped(state: number): boolean;
  operationColor(transform: number): string;
  operationBorderColor(transform: number): string;
  operationLabel(transform: number): string;
  operationShape(transform: number): "diamond" | "square";
}

const Z3_COLORS = ["#e74c3c", "#2ecc71", "#3498db"] as const;
const Z3_LABELS = ["R", "G", "B"] as const;

/** Domain Model: The cyclic group of order 3 (Z/3Z). States are 0, 1, 2 with modular addition. */
export class Z3Group implements Group {
  readonly type = "Z3" as const;
  readonly stateCount = 3;
  readonly stateColors = Z3_COLORS;
  readonly stateLabels = Z3_LABELS;
  readonly shape = "circle" as const;

  apply(state: number, transform: number): number {
    return (state + transform + 1) % 3;
  }

  isFlipped(_state: number): boolean {
    return false;
  }

  operationColor(transform: number): string {
    return transform === 1 ? "#e67e22" : "#9b59b6";
  }

  operationBorderColor(transform: number): string {
    return transform === 1 ? "#b8651b" : "#7d3c98";
  }

  operationLabel(transform: number): string {
    return transform === 1 ? "??" : "?";
  }

  operationShape(transform: number): "diamond" | "square" {
    return transform === 1 ? "square" : "diamond";
  }
}

// S3 operation lookup tables (left-multiply by operation on state)
// States: 0=e, 1=r, 2=r², 3=s, 4=sr, 5=sr²
const S3_ROTATE: readonly number[] = [1, 2, 0, 5, 3, 4];
const S3_SWAP: readonly number[] = [3, 4, 5, 0, 1, 2];

const S3_COLORS = [
  "#e74c3c",
  "#2ecc71",
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#3498db",
] as const;
const S3_LABELS = ["R", "G", "B", "R", "G", "B"] as const;

/** Domain Model: The symmetric group of degree 3. 6 states (e, r, r², s, sr, sr²) with non-commutative composition. */
export class S3Group implements Group {
  readonly type = "S3" as const;
  readonly stateCount = 6;
  readonly stateColors = S3_COLORS;
  readonly stateLabels = S3_LABELS;
  readonly shape = "triangle" as const;

  apply(state: number, transform: number): number {
    if (transform === 0) return S3_ROTATE[state];
    if (transform === 1) return S3_SWAP[state];
    return state;
  }

  isFlipped(state: number): boolean {
    return state >= 3;
  }

  operationColor(transform: number): string {
    return transform === 1 ? "#e67e22" : "#9b59b6";
  }

  operationBorderColor(transform: number): string {
    return transform === 1 ? "#b8651b" : "#7d3c98";
  }

  operationLabel(transform: number): string {
    return transform === 1 ? "S" : "R";
  }

  operationShape(transform: number): "diamond" | "square" {
    return transform === 1 ? "square" : "diamond";
  }
}

const Z3 = new Z3Group();
const S3 = new S3Group();

export function createGroup(type: GroupType): Group {
  return type === "S3" ? S3 : Z3;
}

// === Animation Constants ===
export const PICKUP_ANIM_FRAMES = 20;
export const RELEASE_ANIM_FRAMES = 16;
export const TRANSFORM_ANIM_FRAMES = 20;
export const GOAL_CORRECT_ANIM_FRAMES = 24;
export const GOAL_WRONG_ANIM_FRAMES = 20;

// === TargetObject ===

/** Domain Model: A target object that holds a group element as its state. Lifecycle: free → following → delivered. */
export class TargetObject {
  prevX: number;
  prevY: number;
  following = false;
  delivered = false;
  pickupAnim = 0;
  releaseAnim = 0;
  transformAnim = 0;
  prevState: number;
  goalCorrectAnim = 0;
  goalWrongAnim = 0;

  constructor(
    public readonly id: number,
    public x: number,
    public y: number,
    public state: number,
  ) {
    this.prevX = x;
    this.prevY = y;
    this.prevState = state;
  }

  pickup(): void {
    this.following = true;
    this.pickupAnim = PICKUP_ANIM_FRAMES;
  }

  release(): void {
    this.following = false;
    this.prevX = this.x;
    this.prevY = this.y;
    this.releaseAnim = RELEASE_ANIM_FRAMES;
  }

  applyTransform(transform: number, group: Group): void {
    this.prevState = this.state;
    this.state = group.apply(this.state, transform);
    this.transformAnim = TRANSFORM_ANIM_FRAMES;
  }

  deliver(): void {
    this.delivered = true;
    this.goalCorrectAnim = GOAL_CORRECT_ANIM_FRAMES;
  }

  markWrongGoal(): void {
    if (this.goalWrongAnim === 0) {
      this.goalWrongAnim = GOAL_WRONG_ANIM_FRAMES;
    }
  }

  moveTo(newX: number, newY: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = newX;
    this.y = newY;
  }

  tickEffects(): void {
    if (this.pickupAnim > 0) this.pickupAnim--;
    if (this.releaseAnim > 0) this.releaseAnim--;
    if (this.transformAnim > 0) this.transformAnim--;
    if (this.goalCorrectAnim > 0) this.goalCorrectAnim--;
    if (this.goalWrongAnim > 0) this.goalWrongAnim--;
  }

  hasActiveEffects(): boolean {
    return this.pickupAnim > 0 || this.releaseAnim > 0 ||
      this.transformAnim > 0 || this.goalCorrectAnim > 0 ||
      this.goalWrongAnim > 0;
  }
}

// === Stage ===

export interface GoalCheckResult {
  allMet: boolean;
}

/** Domain Model: A single puzzle level. Aggregate root that holds the map, operations, goals, and group. */
export class Stage {
  private constructor(
    public readonly name: string,
    public readonly width: number,
    public readonly height: number,
    public readonly walls: Set<string>,
    public readonly parsedTargets: ParsedTarget[],
    public readonly operations: Operation[],
    public readonly goals: Goal[],
    public readonly playerStart: Vec2,
    public readonly group: Group,
  ) {}

  static fromData(data: StageData): Stage {
    const walls = new Set<string>();
    const map = data.map;
    const height = map.length;
    const width = Math.max(...map.map((r) => r.length));

    for (let y = 0; y < map.length; y++) {
      const row = map[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "#") {
          walls.add(`${x},${y}`);
        }
      }
    }

    const parsedTargets: ParsedTarget[] = data.targets.map((t, i) => ({
      id: i,
      x: t.pos.x,
      y: t.pos.y,
      state: t.state,
      initialState: t.state,
    }));

    const operations: Operation[] = data.operations.map((o) => ({
      x: o.pos.x,
      y: o.pos.y,
      transform: o.transform,
    }));

    const goals: Goal[] = data.goals.map((g, i) => ({
      id: i,
      x: g.pos.x,
      y: g.pos.y,
      requiredState: g.requiredState,
    }));

    const group = createGroup(data.group ?? "Z3");

    return new Stage(
      data.name,
      width,
      height,
      walls,
      parsedTargets,
      operations,
      goals,
      data.player,
      group,
    );
  }

  isWall(x: number, y: number): boolean {
    return this.walls.has(`${x},${y}`) || x < 0 || y < 0 ||
      x >= this.width || y >= this.height;
  }

  createTargets(): TargetObject[] {
    return this.parsedTargets.map((t) =>
      new TargetObject(t.id, t.x, t.y, t.initialState)
    );
  }

  checkGoals(targets: TargetObject[]): GoalCheckResult {
    let allMet = true;
    for (const goal of this.goals) {
      let met = false;
      for (const t of targets) {
        if (!t.following && t.x === goal.x && t.y === goal.y) {
          if (t.state === goal.requiredState) {
            if (!t.delivered) {
              t.deliver();
            }
            met = true;
            break;
          } else {
            t.markWrongGoal();
          }
        }
      }
      if (!met) allMet = false;
    }
    return { allMet };
  }
}
