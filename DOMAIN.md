# Domain Language

## Game Mechanics

| Term              | Meaning                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Player**        | The player character. Has no algebraic state; only moves and interacts.                                                                                                                           |
| **Target**        | An object that holds a group element as its state. Can follow the player.                                                                                                                         |
| **Operation**     | A fixed tile on the map. When a target passes over it, the target's state is transformed.                                                                                                         |
| **Goal**          | A destination tile with a `requiredState`. A target must be delivered here in the correct state.                                                                                                  |
| **FollowerChain** | The ordered list of targets currently following the player in a snake-like chain.                                                                                                                 |
| **Pickup**        | The action of a target joining the follower chain when the player overlaps it.                                                                                                                    |
| **Release**       | Detaching all followers from the player via a jump. Each target stays at its current position.                                                                                                    |
| **Delivery**      | When a following target reaches a goal tile with the correct state, it is automatically delivered after the move animation completes. The target leaves the follower chain and stays on the goal. |
| **FollowerGap**   | Tracks how many positions behind each follower is after a delivery removes a chain member. On the next move, followers catch up at increased speed (2×, 3×, etc.).                                |
| **Jump**          | An in-place jump that releases all following targets. The player's position does not change.                                                                                                      |
| **PathHistory**   | The recorded trail of player positions. Followers trace this path with a delay based on chain index.                                                                                              |
| **Stage**         | A single puzzle level, consisting of a map, player start position, targets, operations, and goals.                                                                                                |
| **Wall**          | An impassable tile.                                                                                                                                                                               |
| **Floor**         | A passable tile.                                                                                                                                                                                  |

## Algebraic Structure

| Term               | Meaning                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GroupType**      | The algebraic group used in a stage (`"Z3"` or `"S3"`).                                                                                                                     |
| **Z3**             | The cyclic group of order 3. States: 0, 1, 2.                                                                                                                               |
| **S3**             | The symmetric group of degree 3 (order 6, non-abelian). States: 0-5 (e, r, r², s, sr, sr²).                                                                                 |
| **State**          | A group element represented as an integer. Z3: 0-2, S3: 0-5.                                                                                                                |
| **Transform**      | The type index of an operation. Z3: 0 = +1 mod 3, 1 = +2 mod 3. S3: 0 = rotate, 1 = swap. Visually distinguished by shape (diamond vs square) and color (purple vs orange). |
| **applyOperation** | The core function that applies a group operation to a state.                                                                                                                |
| **Rotate (r)**     | The rotation generator in S3. Left-multiplies by r.                                                                                                                         |
| **Swap (s)**       | The reflection generator in S3. Left-multiplies by s. Self-inverse (s² = e).                                                                                                |
| **Flipped**        | In S3, whether a state has reflected orientation. States 0-2 are normal (triangle up), states 3-5 are flipped (triangle down).                                              |

## Known Ambiguities

- **Target** is used both for the in-game object and as a general word (e.g.,
  "target state"). The type `TargetObject` is redundant.
- **Transform** (the property) is an index identifying which operation to apply,
  not the transformation itself. Could be confused with the act of transforming.
- **State** refers to both the algebraic element of a target and the general
  game state (e.g., `won`, `animating`).
- **Operation** refers to the in-game tile/fixture, but can be confused with the
  algebraic operation it represents.
