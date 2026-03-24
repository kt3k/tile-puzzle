export type Direction = "up" | "down" | "left" | "right";

const keysDown = new Set<string>();
let lastDirection: Direction | null = null;

export function bufferDirection(dir: Direction): void {
  lastDirection = dir;
}

export function getHeldDirection(): Direction | null {
  if (lastDirection) {
    const dir = lastDirection;
    lastDirection = null;
    return dir;
  }
  if (keysDown.has("ArrowUp") || keysDown.has("w") || keysDown.has("W")) {
    return "up";
  }
  if (keysDown.has("ArrowDown") || keysDown.has("s") || keysDown.has("S")) {
    return "down";
  }
  if (keysDown.has("ArrowLeft") || keysDown.has("a") || keysDown.has("A")) {
    return "left";
  }
  if (keysDown.has("ArrowRight") || keysDown.has("d") || keysDown.has("D")) {
    return "right";
  }
  return null;
}

export type InputAction =
  | { type: "move"; direction: Direction }
  | { type: "jump" }
  | { type: "next_stage" };

export function setupInputHandler(
  onAction: (action: InputAction) => void,
): void {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    keysDown.add(e.key);

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        onAction({ type: "move", direction: "up" });
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        onAction({ type: "move", direction: "down" });
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        onAction({ type: "move", direction: "left" });
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        onAction({ type: "move", direction: "right" });
        break;
      case " ":
        e.preventDefault();
        onAction({ type: "jump" });
        break;
      case "Enter":
        onAction({ type: "next_stage" });
        break;
    }
  });

  document.addEventListener("keyup", (e: KeyboardEvent) => {
    keysDown.delete(e.key);
  });
}
