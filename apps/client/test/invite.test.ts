import { describe, expect, it } from "vitest";
import { codeFromUrl, inviteText, inviteUrl, withoutInvite } from "../src/net/invite";

describe("invite links", () => {
  it("builds a link to the room from the current page", () => {
    expect(inviteUrl("https://x.app/?foo=1#top", "-d5SNorkT")).toBe("https://x.app/?sala=-d5SNorkT");
  });

  it("reads the room code back from the link", () => {
    expect(codeFromUrl(inviteUrl("https://x.app/", "-d5SNorkT"))).toBe("-d5SNorkT");
  });

  it("ignores pages without a room code", () => {
    expect(codeFromUrl("https://x.app/")).toBeNull();
    expect(codeFromUrl("https://x.app/?sala=")).toBeNull();
  });

  it("rejects codes that are not room ids", () => {
    expect(codeFromUrl("https://x.app/?sala=%3Cscript%3E")).toBeNull();
    expect(codeFromUrl(`https://x.app/?sala=${"a".repeat(40)}`)).toBeNull();
  });

  it("drops the room code so a reload does not rejoin", () => {
    expect(withoutInvite("https://x.app/?sala=abc&x=1")).toBe("https://x.app/?x=1");
    expect(withoutInvite("https://x.app/?sala=abc")).toBe("https://x.app/");
  });

  it("writes a message with the link", () => {
    expect(inviteText("https://x.app/?sala=abc")).toContain("https://x.app/?sala=abc");
  });
});
