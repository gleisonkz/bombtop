import { describe, expect, it } from "vitest";
import { serverUrl } from "../src/net/server-url";

describe("serverUrl", () => {
  it("defaults to the game port on the page host", () => {
    expect(serverUrl(undefined, "http://192.168.0.5:5199/")).toBe("http://192.168.0.5:2567");
    expect(serverUrl("", "https://x.app/")).toBe("https://x.app:2567");
  });

  it("uses an absolute url as is", () => {
    expect(serverUrl("https://game.example.com", "https://x.app/")).toBe("https://game.example.com");
  });

  it("resolves a path against the page origin, so the same build works on any tunnel domain", () => {
    expect(serverUrl("/colyseus", "https://abc.ngrok-free.app/?sala=1")).toBe("https://abc.ngrok-free.app/colyseus");
  });
});
