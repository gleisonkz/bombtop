import { createClient, type Session } from "@supabase/supabase-js";

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when Supabase is not configured: the game then runs guest-only. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export interface Account {
  name: string;
  token: string;
}

function toAccount(session: Session | null): Account | null {
  if (!session) return null;
  const meta = session.user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name ?? session.user.email?.split("@")[0] ?? "Jogador";
  return { name: String(name), token: session.access_token };
}

/** Calls back now and whenever the login state changes (including token refresh). */
export function watchAccount(cb: (account: Account | null) => void): void {
  if (!supabase) return cb(null);
  void supabase.auth.getSession().then(({ data }) => cb(toAccount(data.session)));
  supabase.auth.onAuthStateChange((_event, session) => cb(toAccount(session)));
}

export async function signInWithGoogle(): Promise<void> {
  await supabase?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
