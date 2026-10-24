import { describe, expect, it } from "vitest";
import { codeFromUrl, inviteText, inviteUrl, tvCodeFromUrl, tvUrl, withoutInvite } from "../src/net/invite";

describe("invite links", () => {
  it("builds a link to the room from the current page", () => {
    expect(inviteUrl("https://x.app/?foo=1#top", "-d5SNorkT")).toBe("https://x.app/sala/-d5SNorkT");
  });

  it("reads the room code back from the link", () => {
    expect(codeFromUrl(inviteUrl("https://x.app/", "-d5SNorkT"))).toBe("-d5SNorkT");
  });

  it("still reads old links with the code in the query", () => {
    expect(codeFromUrl("https://x.app/?sala=-d5SNorkT")).toBe("-d5SNorkT");
  });

  it("ignores pages without a room code", () => {
    expect(codeFromUrl("https://x.app/sala/")).toBeNull();
    expect(codeFromUrl("https://x.app/")).toBeNull();
    expect(codeFromUrl("https://x.app/?sala=")).toBeNull();
  });

  it("rejects codes that are not room ids", () => {
    expect(codeFromUrl("https://x.app/?sala=%3Cscript%3E")).toBeNull();
    expect(codeFromUrl(`https://x.app/?sala=${"a".repeat(40)}`)).toBeNull();
    expect(codeFromUrl("https://x.app/sala/a%3Cb")).toBeNull();
    expect(codeFromUrl("https://x.app/sala/abc/extra")).toBeNull();
  });

  it("drops the room code when leaving the room", () => {
    expect(withoutInvite("https://x.app/?sala=abc&x=1")).toBe("https://x.app/?x=1");
    expect(withoutInvite("https://x.app/?sala=abc")).toBe("https://x.app/");
    expect(withoutInvite("https://x.app/sala/abc?x=1")).toBe("https://x.app/?x=1");
  });

  it("a TV watching a room has its own address, which is not a seat", () => {
    expect(tvUrl("https://x.app/?a=1", "abc")).toBe("https://x.app/tv/abc");
    expect(tvCodeFromUrl("https://x.app/tv/abc")).toBe("abc");
    expect(codeFromUrl("https://x.app/tv/abc")).toBeNull();
    expect(tvCodeFromUrl("https://x.app/sala/abc")).toBeNull();
    expect(tvCodeFromUrl("https://x.app/tv/a%3Cb")).toBeNull();
    expect(withoutInvite("https://x.app/tv/abc")).toBe("https://x.app/");
  });

  it("writes a message with the link", () => {
    expect(inviteText("https://x.app/sala/abc")).toContain("https://x.app/sala/abc");
  });
});

describe("wifi room links", () => {
  it("a friend's offline room has a link of its own, read back case-blind", async () => {
    const { wifiUrl, wifiCodeFromUrl } = await import("../src/net/invite");
    expect(wifiUrl("https://x.app/sala/abc?a=1", "K7QM")).toBe("https://x.app/wifi/K7QM");
    expect(wifiCodeFromUrl("https://x.app/wifi/K7QM")).toBe("K7QM");
    expect(wifiCodeFromUrl("https://x.app/wifi/k7qm/")).toBe("K7QM");
    expect(wifiCodeFromUrl("https://x.app/wifi/")).toBeNull();
    expect(wifiCodeFromUrl("https://x.app/wifi/a%3Cb")).toBeNull();
    expect(codeFromUrl("https://x.app/wifi/K7QM")).toBeNull();
  });
});
