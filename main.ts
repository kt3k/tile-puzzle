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
  state: number;
  following: boolean;
  delivered: boolean;
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
let player: Vec2;
let targets: TargetObject[];
let followerChain: TargetObject[] = [];
let pathHistory: Vec2[] = [];
let currentStageIndex = 0;
let won = false;

// === Canvas setup ===
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

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
  player = { x: stage.playerStart.x, y: stage.playerStart.y };
  targets = stage.targets.map((t) => ({
    id: t.id,
    x: t.x,
    y: t.y,
    state: t.initialState,
    following: false,
    delivered: false,
  }));
  followerChain = [];
  pathHistory = [{ x: player.x, y: player.y }];
  won = false;
  document.getElementById("message")!.textContent = stage.name;
  resizeCanvas();
  render();
}

// === Game Logic ===
function isWall(x: number, y: number): boolean {
  return stage.walls.has(`${x},${y}`) || x < 0 || y < 0 || x >= stage.width ||
    y >= stage.height;
}

function movePlayer(dx: number, dy: number): void {
  if (won) return;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (isWall(nx, ny)) return;

  player.x = nx;
  player.y = ny;
  pathHistory.push({ x: nx, y: ny });

  // Update followers
  const L = pathHistory.length;
  for (let i = 0; i < followerChain.length; i++) {
    const t = followerChain[i];
    const histIdx = L - 2 - i;
    if (histIdx >= 0) {
      t.x = pathHistory[histIdx].x;
      t.y = pathHistory[histIdx].y;
    }
  }

  // Apply operations to followers
  for (const t of followerChain) {
    for (const op of stage.operations) {
      if (t.x === op.x && t.y === op.y) {
        t.state = (t.state + op.transform + 1) % GROUP_ORDER;
      }
    }
  }

  // Check pickup: player overlaps a free, non-delivered target
  for (const t of targets) {
    if (!t.following && !t.delivered && t.x === player.x && t.y === player.y) {
      t.following = true;
      followerChain.push(t);
    }
  }

  checkGoals();
  render();
}

function handleJump(): void {
  if (won) return;
  for (const t of followerChain) {
    t.following = false;
  }
  followerChain = [];
  pathHistory = [{ x: player.x, y: player.y }];

  checkGoals();
  render();
}

function checkGoals(): void {
  let allGoalsMet = true;
  for (const goal of stage.goals) {
    let met = false;
    for (const t of targets) {
      if (
        !t.following && t.x === goal.x && t.y === goal.y &&
        t.state === goal.requiredState
      ) {
        t.delivered = true;
        met = true;
        break;
      }
    }
    if (!met) allGoalsMet = false;
  }

  if (allGoalsMet && stage.goals.length > 0) {
    won = true;
    document.getElementById("message")!.textContent =
      "Stage Clear! Press Enter for next stage.";
  }
}

// === Rendering ===
function render(): void {
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
  for (const t of targets) {
    if (t.following || t.delivered) continue;
    drawTarget(t, false, false);
  }

  // Following targets
  for (let i = followerChain.length - 1; i >= 0; i--) {
    drawTarget(followerChain[i], true, false);
  }

  // Delivered targets
  for (const t of targets) {
    if (!t.delivered) continue;
    drawTarget(t, false, true);
  }

  // Player
  const px = player.x * TILE + TILE / 2;
  const py = player.y * TILE + TILE / 2;
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
}

function drawTarget(
  t: TargetObject,
  isFollowing: boolean,
  isDelivered: boolean,
): void {
  const cx = t.x * TILE + TILE / 2;
  const cy = t.y * TILE + TILE / 2;
  const r = TILE * 0.3;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = STATE_COLORS[t.state];
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
  ctx.fillText(STATE_LABELS[t.state], cx, cy);
}

// === Input ===
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (won && e.key === "Enter") {
    loadStage(currentStageIndex + 1);
    return;
  }

  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      e.preventDefault();
      movePlayer(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      e.preventDefault();
      movePlayer(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      e.preventDefault();
      movePlayer(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      e.preventDefault();
      movePlayer(1, 0);
      break;
    case " ":
      e.preventDefault();
      handleJump();
      break;
  }
});

// === Start ===
loadStage(0);
