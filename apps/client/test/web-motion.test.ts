import { describe, expect, it } from "vitest";
import { webShotPose } from "../src/render/web-motion";

describe("web shot timing", () => {
  it("respects hand windup and expiration", () => {
    expect(webShotPose(19)).toBeNull();
    expect(webShotPose(36)).toBeNull();
  });
  it("travels then opens an impact at the endpoint", () => {
    expect(webShotPose(20)).toEqual({ impact: false, frame: 0, progress: 0 });
    expect(webShotPose(27)).toEqual({ impact: false, frame: 3, progress: 0.875 });
    expect(webShotPose(28)).toEqual({ impact: true, frame: 0, progress: 1 });
    expect(webShotPose(35)).toEqual({ impact: true, frame: 3, progress: 1 });
  });
});
