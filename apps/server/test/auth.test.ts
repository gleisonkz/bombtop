import { describe, expect, it, vi } from "vitest";
import { authenticate, type AuthConfig } from "../src/auth";

const config = (over: Partial<AuthConfig> = {}): AuthConfig => ({
  supabaseUrl: "https://proj.supabase.co",
  anonKey: "anon-key",
  required: false,
  ...over,
});

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("authenticate", () => {
  it("lets guests in when Supabase is not configured", async () => {
    const fetch = fakeFetch(200, {});
    expect(await authenticate(undefined, { supabaseUrl: "", anonKey: "", required: false }, fetch)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets guests in without a token when auth is optional", async () => {
    expect(await authenticate(undefined, config(), fakeFetch(200, {}))).toBeNull();
  });

  it("rejects guests when auth is required", async () => {
    await expect(authenticate(undefined, config({ required: true }), fakeFetch(200, {}))).rejects.toThrow();
  });

  it("verifies a token against Supabase and returns the user", async () => {
    const fetch = fakeFetch(200, { id: "u1", email: "ana@x.com", user_metadata: { full_name: "Ana Souza" } });
    const user = await authenticate("tok", config(), fetch);
    expect(user).toEqual({ id: "u1", name: "Ana Souza" });
    expect(fetch).toHaveBeenCalledWith("https://proj.supabase.co/auth/v1/user", {
      headers: { apikey: "anon-key", Authorization: "Bearer tok" },
    });
  });

  it("falls back to the e-mail prefix for the display name", async () => {
    const user = await authenticate("tok", config(), fakeFetch(200, { id: "u2", email: "bia@x.com", user_metadata: {} }));
    expect(user!.name).toBe("bia");
  });

  it("rejects an invalid token even when auth is optional", async () => {
    await expect(authenticate("bad", config(), fakeFetch(401, { msg: "invalid" }))).rejects.toThrow();
  });
});
