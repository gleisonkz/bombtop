// Builds public/sfx/*.m4a from the original sound libraries (kept outside the repo).
// usage: SFX_SRC=E:/sfx-src node scripts/build-sfx.mjs [name...]   (needs ffmpeg on PATH; names rebuild only those)
//
// Sources: Kenney packs (CC0, kenney.nl; incl. the fighter voiceover and music jingles) and the Sonniss GDC 2026 Game Audio Bundle
// (royalty-free, no attribution; may ship inside the game, not as a sound library).
// Freesound (CC0 only), the HQ preview of each: death cry = "Cartoon Scream 1.wav" by tonsil5,
// https://freesound.org/people/tonsil5/sounds/416840/ (saved as freesound/416840_8247784-hq.mp3).
// Goku's voice (Japanese, Masako Nozawa) and Kamehameha effects are from Dragon Ball FighterZ (fan use; (c) Bandai Namco /
// Arc System Works), as ripped on The Sounds Resource: assets 411947 "Goku (Japanese)" and 411912 "Goku", unzipped under dbfz/.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = process.env.SFX_SRC ?? "E:/sfx-src";
const OUT = new URL("../public/sfx/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");

const K = (pack, file) => join(SRC, "kenney", `kenney_${pack}`, "Audio", file);
const VOICE = (file) => K("voiceover-pack-fighter", file);
const JINGLE = (file) => K("music-jingles", join("8-Bit jingles", file));
const S = (lib, file) => join(SRC, "sonniss", "raw", lib, file);
const CSD = (lib, file) => S(`Cinematic Sound Design - ${lib}`, file);
const ESM_AG = (file) => S("Epic Stock Media - Anime Game", file);
const SOLER = (lib, file) => S(`Federico Soler - Effective Trailer ${lib} Vol. 2`, file);
const FS = (file) => join(SRC, "freesound", file);
const GOKU = (n) => join(SRC, "dbfz", "dbfz-goku-jp", "Goku", "Default", `vgkn${n}.ogg`);
const GOKU_FX = (name) => join(SRC, "dbfz", "dbfz-goku-sfx", "Goku", `ARC_BTL_GKN_${name}.ogg`);

/**
 * name -> { src, len (s), tempo?, layer? | layers?: [{ src, len, gain (dB), lowpass? (Hz), at? (s, delay), tempo? }] }
 * Every clip is trimmed of leading silence, cut to `len`, faded out, mixed to mono
 * and peak-normalized; per-sound loudness is set in code (SOUNDS in sound.ts).
 */
const RECIPE = {
  place: { src: K("impact-sounds", "impactSoft_heavy_000.ogg"), len: 0.35 },
  explode: {
    src: ESM_AG("EXPLDsgn_Explosion Small Blast Enemy Death Crunchy Boom Cartoon Noisy Crash Impact Delay 03_ESM_AG.wav"),
    len: 1.4,
    layer: { src: SOLER("Booms", "EffectiveTrailer_Booms_Vol2_011.wav"), len: 1.4, gain: -6, lowpass: 180 },
  },
  break: { src: K("impact-sounds", "impactPlank_medium_001.ogg"), len: 0.5 },
  wall: { src: K("impact-sounds", "impactPlate_heavy_000.ogg"), len: 0.45 },
  kick: { src: K("impact-sounds", "impactPunch_medium_000.ogg"), len: 0.4 },
  throw: { src: ESM_AG("FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav"), len: 0.7 },
  pickup: { src: ESM_AG("DSGNStngr_Power Up Bright Positive Successful Light Saturation Crash Shimmer 05_ESM_AG.wav"), len: 1.2 },
  curse: { src: CSD("System & UI Feedback Elements", "Interface Deny Low Fat Dark.wav"), len: 0.75 },
  stun: { src: CSD("Cartoon Bloopers", "Cartoon Confused Dizzy.wav"), len: 1.2 },
  // a cartoon "nooo!" over the falling bass
  death: {
    src: CSD("Cartoon & Animation Vol 2", "Cartoon Transition Bass Down.wav"),
    len: 1.8,
    layer: { src: FS("416840_8247784-hq.mp3"), len: 1.2, gain: -6 },
  },
  mount: { src: CSD("UI Interaction Elements", "Accept Boing Crunch.wav"), len: 0.9 },
  dismount: { src: CSD("Cartoon Impacts", "Cartoon Pops Random Sequence Reverb.wav"), len: 1.2 },
  jump: { src: K("digital-audio", "phaseJump1.ogg"), len: 0.45 },
  dash: { src: CSD("Colossal Impacts", "Woosh Debris.wav"), len: 0.9 },
  warp: { src: K("digital-audio", "phaserUp1.ogg"), len: 0.5 },
  // the ninja's special: a shimmer building up, a crystal ting as the beam leaves the hands
  ice: {
    src: K("sci-fi-sounds", "forceField_000.ogg"),
    len: 0.8,
    layer: { src: K("impact-sounds", "impactGlass_light_000.ogg"), len: 0.6, gain: -2, at: 0.3 },
  },
  // Thor's special: an electric zap cracking over a low thunder rumble
  thunder: {
    src: K("digital-audio", "zap1.ogg"),
    len: 0.6,
    layer: { src: SOLER("Booms", "EffectiveTrailer_Booms_Vol2_011.wav"), len: 1.2, gain: -4, lowpass: 400, at: 0.05 },
  },
  // Goku's special: the charge humming between his hands, then the beam leaving them (KAME_CHARGE = 0.33 s)
  // Goku's special: ki gathering in his hands, the beam roaring out at KAME_CHARGE (0.33 s), and his shout, sped up
  // a little so its "HA!" lands while the beam is out
  kamehameha: {
    src: GOKU_FX("Kamehame_Chrg"),
    len: 0.45,
    layers: [
      { src: GOKU_FX("Kamehame_Fire"), len: 1.3, gain: -7, at: 0.33 },
      { src: GOKU("206"), len: 1.6, gain: 0, tempo: 1.25 },
    ],
  },
  // Goku's own lines: "Ossu! Ora Goku!" when picked, a cry over the falling bass, "Yossha! Ora katta zo!" when he wins
  "goku-pick": { src: GOKU("600"), len: 1.7 },
  "goku-death": {
    src: CSD("Cartoon & Animation Vol 2", "Cartoon Transition Bass Down.wav"),
    len: 1.8,
    layer: { src: GOKU("014"), len: 1.4, gain: -3 },
  },
  "goku-win": { src: GOKU("404"), len: 3.3 },
  // Naruto's special: the ball of chakra whirring in his hand as he dashes, then the strike (RASENGAN_TICKS = 0.2 s)
  rasengan: {
    src: K("sci-fi-sounds", "engineCircular_001.ogg"),
    len: 0.45,
    layer: { src: ESM_AG("FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav"), len: 0.5, gain: -2, at: 0.2 },
  },
  // the bomb mascot's mega bomb: a heavy thud as it lands, over a low boom
  mega: {
    src: K("impact-sounds", "impactPlate_heavy_001.ogg"),
    len: 0.6,
    tempo: 0.8,
    layer: { src: SOLER("Booms", "EffectiveTrailer_Booms_Vol2_011.wav"), len: 0.9, gain: -5, lowpass: 220 },
  },
  freeze: { src: S("Epic Stock Media - Tower Defense Game", "ICEBrk_Skill Freeze Whoosh Break Impact Layered Movement Shatter 03_ESM_TDG.wav"), len: 1.2 },
  hurry: {
    src: SOLER("Alarms", "EffectiveTrailer_Alarms_Vol2_QuarterNotes_013.wav"),
    len: 2.5,
    layer: { src: VOICE("sudden_death.ogg"), len: 1.5, gain: 2, at: 0.3 },
  },
  start: {
    src: VOICE("fight.ogg"),
    len: 1.0,
    layer: { src: CSD("Hybrid Game & UI Elements", "Game Entry Happy Short.wav"), len: 0.9, gain: -8 },
  },
  // the announcer, then a jingle: rising for a win, falling for a loss, level for a tie
  win: { src: VOICE("you_win.ogg"), len: 1.3, layer: { src: JINGLE("jingles_NES12.ogg"), len: 0.9, gain: -3, at: 1.15 } },
  lose: { src: VOICE("you_lose.ogg"), len: 1.4, layer: { src: JINGLE("jingles_NES11.ogg"), len: 0.9, gain: -3, at: 1.3 } },
  draw: { src: VOICE("it's_a_tie.ogg"), len: 1.4, layer: { src: JINGLE("jingles_NES13.ogg"), len: 1.0, gain: -3, at: 1.3 } },
  end: { src: CSD("User Interface", "Interface Plucks Happy.wav"), len: 0.85 },
  click: { src: CSD("Interface & Infographics", "Interface Pop High Short.wav"), len: 0.4 },
};

const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB";
const shape = (len) => `${TRIM},atrim=0:${len},afade=t=out:st=${Math.max(0, len - Math.min(0.3, len / 3))}:d=${Math.min(0.3, len / 3)}`;

function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const layersOf = (r) => r.layers ?? (r.layer ? [r.layer] : []);
const tempoOf = (t) => (t ? `,atempo=${t}` : "");

function filterFor(r) {
  const layers = layersOf(r);
  const main = `[0:a]aformat=channel_layouts=mono${tempoOf(r.tempo)},${shape(r.len)}[m]`;
  if (!layers.length) return `${main};[m]anull[mix]`;
  const subs = layers.map((l, i) => {
    const lowpass = l.lowpass ? `,lowpass=f=${l.lowpass}` : "";
    const delay = l.at ? `,adelay=${Math.round(l.at * 1000)}` : "";
    return `[${i + 1}:a]aformat=channel_layouts=mono${tempoOf(l.tempo)},${shape(l.len)}${lowpass},volume=${l.gain}dB${delay}[l${i}]`;
  });
  const pads = ["[m]", ...layers.map((_, i) => `[l${i}]`)].join("");
  return `${[main, ...subs].join(";")};${pads}amix=inputs=${layers.length + 1}:duration=longest:normalize=0[mix]`;
}

/** Loudest sample of the mixed clip, in dBFS. */
function peakDb(inputs, graph) {
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", ...inputs, "-filter_complex", `${graph};[mix]volumedetect`, "-f", "null", "-"], {
    encoding: "utf8",
  });
  return Number(/max_volume: (-?[\d.]+) dB/.exec(stderr)?.[1] ?? 0);
}

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const [name, r] of Object.entries(RECIPE)) {
  if (only.length && !only.includes(name)) continue;
  const inputs = ["-i", r.src, ...layersOf(r).flatMap((l) => ["-i", l.src])];
  const graph = filterFor(r);
  const max = peakDb(inputs, graph);
  const gain = -1 - max;
  ffmpeg([...inputs, "-filter_complex", `${graph};[mix]volume=${gain}dB,aresample=48000[out]`, "-map", "[out]", "-c:a", "aac", "-b:a", "96k", join(OUT, `${name}.m4a`)]);
  console.log(`${name.padEnd(10)} peak ${max.toFixed(1)} dB -> ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB`);
}
