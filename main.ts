import {
  bufferDirection,
  type Direction,
  getHeldDirection,
  setupInputHandler,
} from "./user_inputs.ts";

// === Types ===
interface Vec2 {
  x: number;
  y: number;
}

interface StageData {
  name: string;
  map: string[];
}

interface Stage {
  name: string;
  width: number;
  height: number;
  walls: Set<string>;
  targets: ParsedTarget[];
  operations: Operation[];
  goals: Goal[];
  playerStart: Vec2;
}

interface ParsedTarget {
  id: number;
  x: number;
  y: number;
  state: number;
  initialState: number;
}

interface TargetObject {
  id: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  state: number;
  following: boolean;
  delivered: boolean;
  pickupAnim: number; // 0 = no effect, 1..PICKUP_ANIM_FRAMES = animating
  releaseAnim: number; // 0 = no effect, 1..RELEASE_ANIM_FRAMES = animating
  transformAnim: number; // 0 = no effect, 1..TRANSFORM_ANIM_FRAMES = animating
  prevState: number; // state before transform, for color flash
  goalCorrectAnim: number;
  goalWrongAnim: number;
}

interface Operation {
  x: number;
  y: number;
  transform: number;
}

interface Goal {
  id: number;
  x: number;
  y: number;
  requiredState: number;
}

// === Constants ===
const TILE = 40;
const GROUP_ORDER = 3;
const ANIM_FRAMES = 16;
const STATE_COLORS = ["#e74c3c", "#2ecc71", "#3498db"];
const STATE_LABELS = ["R", "G", "B"];
const WALL_COLOR = "#2c2c54";
const FLOOR_COLOR = "#2a2a3e";
const GRID_COLOR = "#333350";
const PLAYER_COLOR = "#f5f5f5";
const OP_COLOR = "#9b59b6";

// === Stage definitions ===
const STAGES: StageData[] = [
  {
    name: "Stage 1: Discovery",
    map: [
      "##############",
      "#P...........#",
      "#............#",
      "#............#",
      "#....O0......#",
      "#............#",
      "#.T0.....G2..#",
      "#............#",
      "##############",
    ],
  },
  {
    name: "Stage 2: Two Targets",
    map: [
      "################",
      "#P.............#",
      "#..............#",
      "#....O0....O1..#",
      "#..............#",
      "#.T0......T1...#",
      "#..............#",
      "#....G2....G0..#",
      "#..............#",
      "################",
    ],
  },
  {
    name: "Stage 3: Shared Path",
    map: [
      "################",
      "#P.............#",
      "#..............#",
      "#...O0...O0....#",
      "#..............#",
      "#..O1..........#",
      "#..............#",
      "#.T0...T2......#",
      "#..............#",
      "#....G1....G0..#",
      "#..............#",
      "################",
    ],
  },
];

// === Parse stage ===
function parseStage(stageData: StageData): Stage {
  const walls = new Set<string>();
  const targets: ParsedTarget[] = [];
  const operations: Operation[] = [];
  const goals: Goal[] = [];
  let playerStart: Vec2 = { x: 0, y: 0 };
  const map = stageData.map;
  const height = map.length;
  const width = Math.max(...map.map((r) => r.length));

  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "#") {
        walls.add(`${x},${y}`);
      } else if (ch === "P") {
        playerStart = { x, y };
      } else if (ch === "T") {
        const state = parseInt(row[x + 1]);
        targets.push({
          id: targets.length,
          x,
          y,
          state,
          initialState: state,
        });
        x++;
      } else if (ch === "O") {
        const transform = parseInt(row[x + 1]);
        operations.push({ x, y, transform });
        x++;
      } else if (ch === "G") {
        const requiredState = parseInt(row[x + 1]);
        goals.push({ id: goals.length, x, y, requiredState });
        x++;
      }
    }
  }

  return {
    width,
    height,
    walls,
    targets,
    operations,
    goals,
    playerStart,
    name: stageData.name,
  };
}

// === Game State ===
let stage: Stage;
let player: { x: number; y: number; prevX: number; prevY: number };
let targets: TargetObject[];
let followerChain: TargetObject[] = [];
let pathHistory: Vec2[] = [];
let currentStageIndex = 0;
let won = false;

// === Animation State ===
let animFrame = 0;
let animating = false;
let animType: "move" | "jump" = "move";
let stageClearAnim = 0;
const STAGE_CLEAR_ANIM_FRAMES = 60;
const JUMP_HEIGHT = TILE * 0.6;
const PICKUP_ANIM_FRAMES = 20;
const RELEASE_ANIM_FRAMES = 16;
const TRANSFORM_ANIM_FRAMES = 20;
const GOAL_CORRECT_ANIM_FRAMES = 24;
const GOAL_WRONG_ANIM_FRAMES = 20;

// === Canvas setup ===
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const nextStageButton = document.getElementById(
  "next-stage",
) as HTMLButtonElement;
const nextStageHint = document.getElementById("next-stage-hint")!;

function resizeCanvas(): void {
  canvas.width = stage.width * TILE;
  canvas.height = stage.height * TILE;
}

// === Stage loader ===
function loadStage(index: number): void {
  if (index >= STAGES.length) {
    document.getElementById("message")!.textContent = "All stages cleared!";
    return;
  }
  currentStageIndex = index;
  stage = parseStage(STAGES[index]);
  player = {
    x: stage.playerStart.x,
    y: stage.playerStart.y,
    prevX: stage.playerStart.x,
    prevY: stage.playerStart.y,
  };
  targets = stage.targets.map((t) => ({
    id: t.id,
    x: t.x,
    y: t.y,
    prevX: t.x,
    prevY: t.y,
    state: t.initialState,
    following: false,
    delivered: false,
    pickupAnim: 0,
    releaseAnim: 0,
    transformAnim: 0,
    prevState: t.initialState,
    goalCorrectAnim: 0,
    goalWrongAnim: 0,
  }));
  followerChain = [];
  pathHistory = [{ x: player.x, y: player.y }];
  won = false;
  animating = false;
  animFrame = 0;
  stageClearAnim = 0;
  document.getElementById("message")!.textContent = stage.name;
  nextStageButton.style.visibility = "hidden";
  nextStageHint.style.visibility = "hidden";
  resizeCanvas();
  render(1);
}

// === Game Logic ===
function isWall(x: number, y: number): boolean {
  return stage.walls.has(`${x},${y}`) || x < 0 || y < 0 || x >= stage.width ||
    y >= stage.height;
}

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function movePlayer(direction: Direction): void {
  if (won) return;
  if (animating) {
    bufferDirection(direction);
    return;
  }
  const { dx, dy } = DIRECTION_DELTA[direction];
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (isWall(nx, ny)) return;

  // Save previous positions
  player.prevX = player.x;
  player.prevY = player.y;
  player.x = nx;
  player.y = ny;
  pathHistory.push({ x: nx, y: ny });

  // Update followers
  const L = pathHistory.length;
  for (let i = 0; i < followerChain.length; i++) {
    const t = followerChain[i];
    const histIdx = L - 2 - i;
    if (histIdx >= 0) {
      t.prevX = t.x;
      t.prevY = t.y;
      t.x = pathHistory[histIdx].x;
      t.y = pathHistory[histIdx].y;
    }
  }

  // Apply operations to followers
  for (const t of followerChain) {
    for (const op of stage.operations) {
      if (t.x === op.x && t.y === op.y) {
        t.prevState = t.state;
        t.state = (t.state + op.transform + 1) % GROUP_ORDER;
        t.transformAnim = TRANSFORM_ANIM_FRAMES;
      }
    }
  }

  // Check pickup: player overlaps a free, non-delivered target
  for (const t of targets) {
    if (!t.following && !t.delivered && t.x === player.x && t.y === player.y) {
      t.following = true;
      t.pickupAnim = PICKUP_ANIM_FRAMES;
      // Pad pathHistory so this follower (at end of chain) has enough entries
      const needed = followerChain.length + 2;
      while (pathHistory.length < needed) {
        pathHistory.unshift(pathHistory[0]);
      }
      followerChain.push(t);
    }
  }

  // Start animation
  animType = "move";
  startAnimation();
}

function handleJump(): void {
  if (won || animating) return;
  for (const t of followerChain) {
    t.following = false;
    t.prevX = t.x;
    t.prevY = t.y;
    t.releaseAnim = RELEASE_ANIM_FRAMES;
  }
  followerChain = [];
  pathHistory = [{ x: player.x, y: player.y }];

  player.prevX = player.x;
  player.prevY = player.y;

  animType = "jump";
  startAnimation();
}

function startAnimation(): void {
  animating = true;
  animFrame = 0;
  requestAnimationFrame(animationLoop);
}

function tickEffects(): void {
  for (const t of targets) {
    if (t.pickupAnim > 0) t.pickupAnim--;
    if (t.releaseAnim > 0) t.releaseAnim--;
    if (t.transformAnim > 0) t.transformAnim--;
    if (t.goalCorrectAnim > 0) t.goalCorrectAnim--;
    if (t.goalWrongAnim > 0) t.goalWrongAnim--;
  }
  if (stageClearAnim > 0) stageClearAnim--;
}

function hasActiveEffects(): boolean {
  return stageClearAnim > 0 ||
    targets.some((t) =>
      t.pickupAnim > 0 || t.releaseAnim > 0 || t.transformAnim > 0 ||
      t.goalCorrectAnim > 0 || t.goalWrongAnim > 0
    );
}

function animationLoop(): void {
  animFrame++;
  const t = animFrame / ANIM_FRAMES;
  tickEffects();
  render(t);

  if (animFrame < ANIM_FRAMES) {
    requestAnimationFrame(animationLoop);
  } else {
    animating = false;
    checkGoals();
    if (hasActiveEffects()) {
      requestAnimationFrame(effectLoop);
    }
    // Continue moving if key is still held
    const dir = getHeldDirection();
    if (dir && !won) {
      movePlayer(dir);
    }
  }
}

function effectLoop(): void {
  tickEffects();
  render(1);
  if (hasActiveEffects()) {
    requestAnimationFrame(effectLoop);
  }
}

function checkGoals(): void {
  let allGoalsMet = true;
  for (const goal of stage.goals) {
    let met = false;
    for (const t of targets) {
      if (!t.following && t.x === goal.x && t.y === goal.y) {
        if (t.state === goal.requiredState) {
          if (!t.delivered) {
            t.delivered = true;
            t.goalCorrectAnim = GOAL_CORRECT_ANIM_FRAMES;
          }
          met = true;
          break;
        } else {
          // Wrong state on goal
          if (t.goalWrongAnim === 0) {
            t.goalWrongAnim = GOAL_WRONG_ANIM_FRAMES;
          }
        }
      }
    }
    if (!met) allGoalsMet = false;
  }

  if (allGoalsMet && stage.goals.length > 0 && !won) {
    won = true;
    stageClearAnim = STAGE_CLEAR_ANIM_FRAMES;
    document.getElementById("message")!.textContent = "Stage Clear!";
    nextStageButton.style.visibility = "visible";
    nextStageHint.style.visibility = "visible";
  }
}

// === Interpolation ===
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function entityScreenX(
  prevX: number,
  x: number,
  t: number,
): number {
  return lerp(prevX * TILE + TILE / 2, x * TILE + TILE / 2, t);
}

function entityScreenY(
  prevY: number,
  y: number,
  t: number,
): number {
  return lerp(prevY * TILE + TILE / 2, y * TILE + TILE / 2, t);
}

// === Rendering ===
function render(t: number): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Floor and grid
  for (let y = 0; y < stage.height; y++) {
    for (let x = 0; x < stage.width; x++) {
      if (stage.walls.has(`${x},${y}`)) {
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      } else {
        ctx.fillStyle = FLOOR_COLOR;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  // Goals
  for (const goal of stage.goals) {
    const cx = goal.x * TILE + TILE / 2;
    const cy = goal.y * TILE + TILE / 2;
    const r = TILE * 0.35;

    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(goal.x * TILE + 1, goal.y * TILE + 1, TILE - 2, TILE - 2);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = STATE_COLORS[goal.requiredState];
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = STATE_COLORS[goal.requiredState];
    ctx.font = `bold ${TILE * 0.35}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(STATE_LABELS[goal.requiredState], cx, cy);
  }

  // Operations
  for (const op of stage.operations) {
    const cx = op.x * TILE + TILE / 2;
    const cy = op.y * TILE + TILE / 2;
    const s = TILE * 0.35;

    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fillStyle = OP_COLOR;
    ctx.fill();
    ctx.strokeStyle = "#7d3c98";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${TILE * 0.4}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", cx, cy);
  }

  // Free targets
  for (const target of targets) {
    if (target.following || target.delivered) continue;
    drawTarget(target, false, false, t);
  }

  // Following targets
  for (let i = followerChain.length - 1; i >= 0; i--) {
    drawTarget(followerChain[i], true, false, t);
  }

  // Delivered targets
  for (const target of targets) {
    if (!target.delivered) continue;
    drawTarget(target, false, true, t);
  }

  // Player
  const px = entityScreenX(player.prevX, player.x, t);
  let py = entityScreenY(player.prevY, player.y, t);

  // Jump arc: sin curve for vertical offset
  if (animType === "jump" && animating) {
    py -= Math.sin(t * Math.PI) * JUMP_HEIGHT;
  }

  // Shadow during jump
  if (animType === "jump" && animating) {
    const shadowScale = 1 - Math.sin(t * Math.PI) * 0.4;
    const groundY = entityScreenY(player.prevY, player.y, 1);
    ctx.beginPath();
    ctx.ellipse(
      px,
      groundY + TILE * 0.2,
      TILE * 0.25 * shadowScale,
      TILE * 0.08 * shadowScale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(px, py, TILE * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player face
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(px - 4, py - 3, 2, 0, Math.PI * 2);
  ctx.arc(px + 4, py - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py + 2, 3, 0, Math.PI);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Stage clear overlay
  if (stageClearAnim > 0) {
    const progress = 1 - stageClearAnim / STAGE_CLEAR_ANIM_FRAMES;
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    // Background dim
    let dimBase: number;
    if (progress < 0.3) {
      dimBase = progress / 0.3;
    } else if (progress < 0.7) {
      dimBase = 1;
    } else {
      dimBase = 1 - (progress - 0.7) / 0.3;
    }
    const dimAlpha = dimBase * 0.35;
    ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // "Clear!" text floats up, holds, then fades out
    let textAlpha: number;
    let textY: number;
    if (progress < 0.4) {
      // Fade in + float up
      const p = progress / 0.4;
      const eased = 1 - (1 - p) * (1 - p);
      textAlpha = eased;
      textY = centerY + 20 * (1 - eased);
    } else if (progress < 0.7) {
      // Hold
      textAlpha = 1;
      textY = centerY;
    } else {
      // Fade out + float up
      const p = (progress - 0.7) / 0.3;
      const eased = p * p;
      textAlpha = 1 - eased;
      textY = centerY - 15 * eased;
    }
    const fontSize = Math.min(w, h) * 0.18;

    ctx.globalAlpha = textAlpha;
    ctx.font = `bold ${fontSize}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Gold shadow
    ctx.fillStyle = "rgba(255, 170, 0, 0.6)";
    ctx.fillText("Clear!", centerX + 2, textY + 2);

    // Main text
    ctx.fillStyle = "#ffd700";
    ctx.fillText("Clear!", centerX, textY);

    ctx.globalAlpha = 1.0;
  }
}

function drawTarget(
  target: TargetObject,
  isFollowing: boolean,
  isDelivered: boolean,
  t: number,
): void {
  const cx = entityScreenX(target.prevX, target.x, t);
  const cy = entityScreenY(target.prevY, target.y, t);
  const r = TILE * 0.3;

  // Transform flash: blend from old color to new color
  let fillColor = STATE_COLORS[target.state];
  if (target.transformAnim > 0) {
    const progress = 1 - target.transformAnim / TRANSFORM_ANIM_FRAMES;
    if (progress < 0.3) {
      // Flash white briefly
      const flash = 1 - progress / 0.3;
      fillColor = `rgba(255, 255, 255, ${0.5 * flash + 0.5})`;
    }
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  if (isDelivered) ctx.globalAlpha = 0.4;
  ctx.fill();
  ctx.globalAlpha = 1.0;

  if (isFollowing) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${TILE * 0.3}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(STATE_LABELS[target.state], cx, cy);

  // Pickup pulse effect: white ring expanding outward
  if (target.pickupAnim > 0) {
    const progress = 1 - target.pickupAnim / PICKUP_ANIM_FRAMES;
    const pulseR = r + TILE * 0.4 * progress;
    const alpha = 0.8 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 2.5 * (1 - progress) + 0.5;
    ctx.stroke();
  }

  // Transform effect: colored ring burst
  if (target.transformAnim > 0) {
    const progress = 1 - target.transformAnim / TRANSFORM_ANIM_FRAMES;
    const burstR = r + TILE * 0.5 * progress;
    const alpha = 0.7 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, burstR, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = STATE_COLORS[target.state];
    ctx.lineWidth = 3 * (1 - progress) + 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // Release effect: ring shrinking inward with color fade
  if (target.releaseAnim > 0) {
    const progress = 1 - target.releaseAnim / RELEASE_ANIM_FRAMES;
    const pulseR = r + TILE * 0.3 * (1 - progress);
    const alpha = 0.6 * (1 - progress);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 150, 150, ${alpha})`;
    ctx.lineWidth = 2 * (1 - progress) + 0.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Goal correct effect: golden expanding rings
  if (target.goalCorrectAnim > 0) {
    const progress = 1 - target.goalCorrectAnim / GOAL_CORRECT_ANIM_FRAMES;
    // Double ring
    for (let i = 0; i < 2; i++) {
      const delay = i * 0.2;
      const p = Math.max(0, progress - delay) / (1 - delay);
      if (p <= 0) continue;
      const ringR = r + TILE * 0.6 * p;
      const alpha = 0.8 * (1 - p);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.stroke();
    }
  }

  // Goal wrong effect: red X shake
  if (target.goalWrongAnim > 0) {
    const progress = 1 - target.goalWrongAnim / GOAL_WRONG_ANIM_FRAMES;
    const alpha = 0.9 * (1 - progress);
    const shake = Math.sin(progress * Math.PI * 6) * 3 * (1 - progress);
    const xSize = TILE * 0.25;
    ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - xSize + shake, cy - xSize);
    ctx.lineTo(cx + xSize + shake, cy + xSize);
    ctx.moveTo(cx + xSize + shake, cy - xSize);
    ctx.lineTo(cx - xSize + shake, cy + xSize);
    ctx.stroke();
  }
}

// === Input ===
setupInputHandler((action) => {
  switch (action.type) {
    case "move":
      movePlayer(action.direction);
      break;
    case "jump":
      handleJump();
      break;
    case "next_stage":
      if (won) loadStage(currentStageIndex + 1);
      break;
  }
});

nextStageButton.addEventListener("click", () => {
  if (won) loadStage(currentStageIndex + 1);
});

// === Start ===
loadStage(0);
