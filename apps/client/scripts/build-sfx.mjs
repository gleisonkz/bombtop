// Builds public/sfx/*.m4a from the original sound libraries (kept outside the repo).
// usage: SFX_SRC=E:/sfx-src node scripts/build-sfx.mjs [name...]   (needs ffmpeg on PATH; names rebuild only those)
//
// Sources: Kenney packs (CC0, kenney.nl; incl. the fighter voiceover and music jingles) and the Sonniss GDC 2026 Game Audio Bundle
// (royalty-free, no attribution; may ship inside the game, not as a sound library).
// Freesound (CC0 only), the HQ preview of each: death cry = "Cartoon Scream 1.wav" by tonsil5,
// https://freesound.org/people/tonsil5/sounds/416840/ (saved as freesound/416840_8247784-hq.mp3).
// Goku's voice (Japanese, Masako Nozawa) and Kamehameha effects are from Dragon Ball FighterZ (fan use; (c) Bandai Namco /
// Arc System Works), as ripped on The Sounds Resource: assets 411947 "Goku (Japanese)" and 411912 "Goku", unzipped under dbfz/.
// Naruto's voice (Japanese, Junko Takeuchi) is from Naruto Shippuden: Ultimate Ninja Storm 2 (PS3; (c) Bandai Namco /
// CyberConnect2), The Sounds Resource asset 489753 "Naruto", unzipped under uns2/uns2-naruto/.
// Captain America's and Thor's voices (and the captain's shield clang) are from Marvel vs. Capcom: Infinite (fan use; (c) Capcom /
// Marvel), The Sounds Resource assets 407793 "Captain America" and 407825 "Thor", unzipped under mvci/; Spider-Man's voice and his
// web sounds from the same game, asset 407822 "Spider-Man", under mvci/mvci-spider/.
// Pikachu's voice (Ikue Otani) and his Thunder sound are from Super Smash Bros. Ultimate (fan use; (c) Nintendo / The Pokemon
// Company), The Sounds Resource asset 409668 "Pikachu", unzipped under ssbu/ssbu-pikachu/.
// The ninja speaks as Sub-Zero from Mortal Kombat (2011) (fan use; (c) Warner Bros. / NetherRealm), asset 413724 "Sub-Zero",
// under mk9/; the bomb mascot as White Bomber from Super Bomberman R (fan use; (c) Konami), asset 412206 "White", under sbr/.
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
const BASS_DOWN = CSD("Cartoon & Animation Vol 2", "Cartoon Transition Bass Down.wav");
const GOKU = (n) => join(SRC, "dbfz", "dbfz-goku-jp", "Goku", "Default", `vgkn${n}.ogg`);
const NARUTO = (name) => join(SRC, "uns2", "uns2-naruto", "Naruto23", "AB", `${name}.wav`);
const CAP = (n, tag) => join(SRC, "mvci", "mvci-captain", "Captain America", "Voice", `00B_CV#${n} (${tag}).wav`);
const CAP_FX = (n, tag) => join(SRC, "mvci", "mvci-captain", "Captain America", "Sounds", `00B_SE#${n} (${tag}).wav`);
const SPIDER = (n, tag) => join(SRC, "mvci", "mvci-spider", "Spider-Man", "Voice", `00D_CV${n} (${tag}).wav`);
const SPIDER_FX = (n, tag) => join(SRC, "mvci", "mvci-spider", "Spider-Man", "Sounds", `00D_SE#${n} (${tag}).wav`);
const PIKA = (name) => join(SRC, "ssbu", "ssbu-pikachu", "Super Smash Bros Ultimate", "Fighters", name.startsWith("se_") ? "se_pikachu" : "vc_pikachu", `${name}.wav`);
const THOR = (n, tag) => join(SRC, "mvci", "mvci-thor", "Thor", "Voice", `011_CV${n} (${tag}).wav`);
const SUBZERO = (who, file) => join(SRC, "mk9", "mk9-subzero", "Sub-Zero", `vo_human_${who}`, file);
const WHITE = (n) => join(SRC, "sbr", "sbr-white", "White", `V_WHI_${n}_E.wav`);
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
    layers: [
      { src: ESM_AG("FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav"), len: 0.5, gain: -2, at: 0.2 },
      // his shout of "Rasengan!", sped up a little to fit the dash
      { src: NARUTO("PL_2nrt [55]"), len: 0.7, gain: 0, tempo: 1.15 },
    ],
  },
  // Naruto's own lines: "Iku tte bayo!" when picked, a cry over the falling bass, "Heh! Ore no kachi da!" when he wins
  "naruto-pick": { src: NARUTO("PL_2nrt [18]"), len: 0.9 },
  "naruto-death": {
    src: CSD("Cartoon & Animation Vol 2", "Cartoon Transition Bass Down.wav"),
    len: 1.8,
    layer: { src: NARUTO("PL_2nrt [17]"), len: 1.4, gain: -3 },
  },
  "naruto-win": { src: NARUTO("v_win [2]"), len: 2.7 },
  // The bomb mascot (White Bomber): "Leave it to me!", a cry over the falling bass, "I did it!", a "Ha!" as he plants his mega bomb
  "bomb-pick": { src: WHITE("002"), len: 0.9 },
  "bomb-death": { src: BASS_DOWN, len: 1.8, layer: { src: WHITE("015"), len: 1.4, gain: -3 } },
  "bomb-win": { src: WHITE("024"), len: 1.7 },
  "bomb-special": { src: WHITE("009"), len: 0.6 },
  // The ninja (Sub-Zero): "This fight will be your last!", a cry, "Feel death's cold embrace." (Bi-Han), a "Hya!" as he throws his ice
  "ninja-pick": { src: SUBZERO("kuai_liang", "intro.wav"), len: 2.0 },
  "ninja-death": { src: BASS_DOWN, len: 1.8, layer: { src: SUBZERO("kuai_liang", "death_sh02.mp3"), len: 1.4, gain: -3 } },
  "ninja-win": { src: SUBZERO("bi_han", "intro.wav"), len: 2.6 },
  "ninja-special": { src: SUBZERO("kuai_liang", "spatk_sh01.mp3"), len: 0.85 },
  // Captain America: "Avengers assemble!", a cry, "I could do this all day.", and his shield clanging up as he shouts
  "captain-pick": { src: CAP(112, "VO_APR_SP11"), len: 1.7 },
  "captain-death": { src: BASS_DOWN, len: 1.8, layer: { src: CAP(34, "VO_LOSE_DOWN; VO_LOSE_KO"), len: 1.4, gain: -3 } },
  "captain-win": { src: CAP(142, "VO_TEASE"), len: 1.8 },
  "captain-special": {
    src: CAP_FX(7, "SKILL_SHIELD_CATCH"),
    len: 0.9,
    layer: { src: CAP(130, "VO_SKILL_SP6_1"), len: 0.8, gain: -1 },
  },
  // Thor: "Brave warrior, I bid thee welcome.", a cry, "Thou art not worthy to face me.", "Thunder!" over his bolt
  "thor-pick": { src: THOR("_COLLECT#77", "VO_CHARASELE_011_3"), len: 2.7 },
  "thor-death": { src: BASS_DOWN, len: 1.8, layer: { src: THOR("#35", "VO_LOSE_KO"), len: 1.4, gain: -3 } },
  "thor-win": { src: THOR("#132", "VO_TEASE"), len: 2.3 },
  "thor-special": { src: THOR("#108", "VO_SKILL_SP2_1"), len: 0.85 },
  // Spider-Man: "It's Spidey time!", a cry, "Can you do whatever a spider can?", "Web throw!" as he shoots
  "spider-pick": { src: SPIDER("_COLLECT#112", "VO_CHARASELE_00D_3"), len: 1.6 },
  "spider-death": { src: BASS_DOWN, len: 1.8, layer: { src: SPIDER("#69", "VO_LOSE_KO"), len: 1.4, gain: -3 } },
  "spider-win": { src: SPIDER("#186", "VO_TEASE"), len: 2.2 },
  "spider-special": { src: SPIDER("#167", "VO_SKILL_SP7_1"), len: 0.9 },
  // Pikachu (Super Smash Bros. Ultimate): "Pika-pika!", knocked out, "Pikaa!", "Pika-chuu!" as he shocks
  "pikachu-pick": { src: PIKA("vc_pikachu_appeal02"), len: 1.1 },
  "pikachu-death": { src: BASS_DOWN, len: 1.8, layer: { src: PIKA("vc_pikachu_knockout"), len: 1.6, gain: -3 } },
  "pikachu-win": { src: PIKA("vc_pikachu_appeal03"), len: 1.3 },
  "pikachu-special": { src: PIKA("vc_pikachu_002"), len: 1.2 },
  // Pikachu's thunder shock: his own Thunder crackling down
  shock: { src: PIKA("se_pikachu_special_L01"), len: 1.2 },
  // the bomb mascot's mega bomb: a heavy thud as it lands, over a low boom
  mega: {
    src: K("impact-sounds", "impactPlate_heavy_001.ogg"),
    len: 0.6,
    tempo: 0.8,
    layer: { src: SOLER("Booms", "EffectiveTrailer_Booms_Vol2_011.wav"), len: 0.9, gain: -5, lowpass: 220 },
  },
  // the spider's web: his web ball leaving his hand, and splatting round whoever it wraps up
  web: { src: SPIDER_FX(37, "SKILL_BALL_SHOT"), len: 0.6 },
  webbed: { src: SPIDER_FX(35, "SKILL_BALL_HIT"), len: 0.7 },
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
