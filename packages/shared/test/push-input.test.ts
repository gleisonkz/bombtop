import { describe, expect, it } from "vitest";
import { InputQueue } from "../src";

describe("networked Push defense", () => {
  it("persists brace state across jitter-buffer ticks and releases it on the next input", () => {
    const queue = new InputQueue();
    queue.push({ dir: "left", bomb: false, brace: true }, 1, undefined, 0);
    expect(queue.take(0)).toMatchObject({ dir: "left", brace: true });
    expect(queue.take(1)).toMatchObject({ dir: "left", brace: true });
    queue.push({ dir: "left", bomb: false, brace: false }, 2, undefined, 2);
    expect(queue.take(2).brace).toBeFalsy();
  });

  it("never drops the brace release when movement packets are coalesced", () => {
    const queue = new InputQueue();
    queue.push({ dir: "right", bomb: false, brace: true }, 1, 0, 4);
    queue.push({ dir: "right", bomb: false, brace: false }, 2, 1, 5);
    const states = Array.from({ length: 11 }, (_, i) => queue.take(i).brace ?? false);
    expect(states).toContain(true);
    expect(states.at(-1)).toBe(false);
  });
});
