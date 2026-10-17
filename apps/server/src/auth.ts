export interface AuthConfig {
  /** Supabase project URL; empty disables auth (everyone is a guest). */
  supabaseUrl: string;
  /** Public anon/publishable key, sent as the `apikey` header. */
  anonKey: string;
  /** Reject players without a valid Google login. */
  required: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
}

export function authConfigFromEnv(env = process.env): AuthConfig {
  return {
    supabaseUrl: (env.SUPABASE_URL ?? "").replace(/\/$/, ""),
    anonKey: env.SUPABASE_ANON_KEY ?? "",
    required: env.REQUIRE_AUTH === "true",
  };
}

/**
 * Resolves the player behind a Supabase access token by asking Supabase
 * itself (/auth/v1/user), so no JWT secret has to live on this server.
 * Returns null for guests; throws when the player must not join.
 */
export async function authenticate(
  token: string | undefined,
  config: AuthConfig,
  fetchFn: typeof fetch = fetch,
): Promise<AuthUser | null> {
  if (!config.supabaseUrl) return null;
  if (!token) {
    if (config.required) throw new Error("Login necessário");
    return null;
  }

  const res = await fetchFn(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Sessão inválida, entre novamente");

  const user = (await res.json()) as { id: string; email?: string; user_metadata?: Record<string, unknown> };
  const meta = user.user_metadata ?? {};
  const name = [meta.full_name, meta.name, user.email?.split("@")[0]].find((v) => typeof v === "string" && v);
  return { id: user.id, name: (name as string | undefined) ?? "Jogador" };
}
