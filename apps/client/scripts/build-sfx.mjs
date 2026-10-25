// Builds public/sfx/*.m4a from the original sound libraries (kept outside the repo).
// usage: SFX_SRC=E:/sfx-src node scripts/build-sfx.mjs [name...]   (needs ffmpeg on PATH; names rebuild only those)
//
// Sources: Kenney packs (CC0, kenney.nl; incl. the fighter voiceover and music jingles) and the Sonniss GDC 2026 Game Audio Bundle
// (royalty-free, no attribution; may ship inside the game, not as a sound library).
// Freesound (CC0 only), the HQ preview of each: death cry = "Cartoon Scream 1.wav" by tonsil5,
// https://freesound.org/people/tonsil5/sounds/416840/ (saved as freesound/416840_8247784-hq.mp3); penelope's kiss = "Cartoon Smooch" by
// Breviceps, https://freesound.org/s/444493/ (saved as freesound/444493_9159316-hq.mp3); harry's stag galloping = "Horse Gallop -
// Loopable" by HebronTheatre, https://freesound.org/s/197212/ (saved as freesound/197212_3001728-hq.mp3).
// Goku's voice (Japanese, Masako Nozawa) and Kamehameha effects are from Dragon Ball FighterZ (fan use; (c) Bandai Namco /
// Arc System Works), as ripped on The Sounds Resource: assets 411947 "Goku (Japanese)" and 411912 "Goku", unzipped under dbfz/.
// Naruto's voice (Japanese, Junko Takeuchi) is from Naruto Shippuden: Ultimate Ninja Storm 2 (PS3; (c) Bandai Namco /
// CyberConnect2), The Sounds Resource asset 489753 "Naruto", unzipped under uns2/uns2-naruto/.
// Captain America's and Thor's voices (and the captain's shield clang) are from Marvel vs. Capcom: Infinite (fan use; (c) Capcom /
// Marvel), The Sounds Resource assets 407793 "Captain America" and 407825 "Thor", unzipped under mvci/; Spider-Man's voice and his
// web sounds from the same game, asset 407822 "Spider-Man", under mvci/mvci-spider/.
// Pikachu's voice (Ikue Otani) and his Thunder sound are from Super Smash Bros. Ultimate (fan use; (c) Nintendo / The Pokemon
// Company), The Sounds Resource asset 409668 "Pikachu", unzipped under ssbu/ssbu-pikachu/.
// Static's lines (Phil LaMarr) are cut from Static Shock / Justice League Unlimited scenes on 101soundboards.com, board
// "Static Shock (TV Show)" (fan use; (c) Warner Bros. / DC), under static-shock/ (to-the-rescue = sound 52736484, impresses-batman =
// 52736429); the flash's (Taliesin Jaffe) from Injustice 2, board "Injustice 2 (PC): The Flash Voice" on the same site, under
// flash-inj2/; bugs' (Jeff Bergman) from Looney Tunes Dash! (mobile), board "Bugs Bunny - Looney Tunes Dash! - Character Voices
// (Mobile)" on the same site (sounds 1456772, 1456763, 1456805, 1456812), under bugs-dash/; the green lantern's (John Stewart, Adetokumboh M'Cormack) from Injustice 2, board "Injustice 2 (PC): John
// Stewart Voice" on the same site (beware-my-power = sound 54601987, ring-do-your-thing = 54602432, neighborhood = 54602290,
// problem = 54603189), under lantern-inj2/; donatello's from Teenage Mutant Ninja Turtles: Shredder's Revenge, board "Teenage Mutant
// Ninja Turtles: Shredder's Revenge (PC): Donatello Voice" on the same site (pick = sound 56699710, death = 56701401, win = 56707997,
// special = 56710569), under donnie-sr/; penelope's from Wacky Races (PC), board "Wacky Races (PC): Penelope Pitstop Voice" on the same
// site (pick = sound 54437034, death = 54437100, win = 54437054, special = 54437030), under penny-wr/; the pink panther, who hardly ever speaks: Henry Mancini's theme (fan use; (c) MGM), "The Pink Panther Theme Song
// (Original Version)" = sound 3052251 and its ending = 66635185, and his one line from the cartoon "Pink Ice" (Rich Little) on the
// board "Pink Panther talking" (sound 37195343), under pink/; harry's (Daniel Radcliffe) from the films on the same site,
// "I solemnly swear that I'm up to no good" = sound 4589182, "Expecto Patronum!" = 12713471, "Mischief managed" = 12897333,
// and his cry from Harry Potter and the Deathly Hallows Part 2 (PC), board "Harry Potter Voice" (sound 54091890), under harry/;
// optimus prime's (Peter Cullen) from the films, on the same site: "I am Optimus Prime" = sound 11758 (board "Optimus Prime
// Sounds: Transformers (2007)"), "Autobots, roll out!" = 480880, "Till all are one" = 480883 and his groan = 24039769 (board
// "Optimus Prime Soundboard"), his transforming = the cartoon's sound, 24139864 "Transform OG" (board "Transform Soundboard"),
// his truck's engine = 24039944 "Optimus Prime Rev"; the site's clips start with a short tag, cut off (from), under optimus/;
// pelé, who left no game voice there, is heard through Galvão Bueno's commentary on the same site, board "Galvão
// Soundboard": "O homem é gênio, é uma fera, é uma lenda do esporte!" = sound 24015411, "Olha o gol!" = 24015287, "É tetra!"
// = 24015278, "Ai, ai, ai, ai" = 24015337, under pele/; his kick = "Soccer Ball Kick" by bittermelonheart (CC0),
// https://freesound.org/s/555042/ (saved as freesound/555042_11910076-hq.mp3);
// lula's own lines, clips of his speeches on myinstants.com, under lula/: "Bora, gente, pra rua!"
// (lula-bora-pra-rua-gente), "Você vai voltar a comer picanha" (vai-voltar-a-comer-picanha), "Eu vou comer picanha e vou
// tomar uma cerveja" (lula-picanha-e-cerveja_3zSp50v), "Por favor, me ajude!" (lula-por-favor-me-ajuda_5UqDBWj);
// the bomb mascot as White Bomber from Super Bomberman R (fan use; (c) Konami), asset 412206 "White", under sbr/.
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
const WHITE = (n) => join(SRC, "sbr", "sbr-white", "White", `V_WHI_${n}_E.wav`);
const FLASH = (name) => join(SRC, "flash-inj2", `${name}.mp3`);
const LANTERN = (name) => join(SRC, "lantern-inj2", `${name}.mp3`);
const DONNIE = (name) => join(SRC, "donnie-sr", `${name}.mp3`);
const PENNY = (name) => join(SRC, "penny-wr", `${name}.mp3`);
const PINK = (name) => join(SRC, "pink", `${name}.mp3`);
const HARRY = (name) => join(SRC, "harry", `${name}.mp3`);
const OPTIMUS = (name) => join(SRC, "optimus", `${name}.mp3`);
const PELE = (name) => join(SRC, "pele", `${name}.mp3`);
const LULA = (name) => join(SRC, "lula", `${name}.mp3`);
const BUGS = (name) => join(SRC, "bugs-dash", `${name}.mp3`);
const STATIC = (name) => join(SRC, "static-shock", `${name}.mp3`);
const GOKU_FX = (name) => join(SRC, "dbfz", "dbfz-goku-sfx", "Goku", `ARC_BTL_GKN_${name}.ogg`);

/**
 * name -> { src, from? (s into the source), len (s), tempo?, layer? | layers?: [{ src, from?, len, gain (dB), lowpass? (Hz), at? (s, delay), tempo? }] }
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
  // Static: "I feel like a great big AA battery!", "I feel like a grilled patty" over the falling bass, "It's the least I could
  // do for a girl from my hood" when he wins
  "static-pick": { src: STATIC("to-the-rescue"), from: 128.55, len: 1.95 },
  "static-death": { src: BASS_DOWN, len: 2.4, layer: { src: STATIC("to-the-rescue"), from: 191.6, len: 2.3, gain: -3 } },
  "static-win": { src: STATIC("impresses-batman"), from: 2.65, len: 2.15 },
  // The flash: "Sorry I'm late." when picked, "Ran right into that one, didn't I?" over the falling bass, "There's only one
  // fastest man alive." when he wins, "Eat my dust!" as he dashes
  "flash-pick": { src: FLASH("sorry-im-late"), len: 1.3 },
  "flash-death": { src: BASS_DOWN, len: 2.0, layer: { src: FLASH("ran-right-into-that"), len: 1.9, gain: -3 } },
  "flash-win": { src: FLASH("only-one-fastest"), len: 2.2 },
  "flash-special": { src: FLASH("eat-my-dust"), len: 1.1 },
  // Bugs: "Yeah, what's up, Doc?" when picked, "Could somebody call an ambulance?" over the falling bass, "Ain't I a
  // stinker?" when he wins, "I knew I should have taken a left at Albuquerque" as he pops out of his tunnel
  "bugs-pick": { src: BUGS("yeah-whats-up-doc"), from: 1.0, len: 1.5 },
  "bugs-death": { src: BASS_DOWN, len: 2.2, layer: { src: BUGS("could-somebody-call-an-ambulance"), len: 2.0, gain: -3 } },
  "bugs-win": { src: BUGS("and-i-you-stinker"), from: 1.05, len: 1.4 },
  "bugs-special": { src: BUGS("i-knew-i-should-have-taken-a-left-at-albuquerque"), from: 0.9, len: 2.6 },
  // The green lantern: "Beware my power!" when picked, "Well, that's gonna be a problem." over the falling bass, "That's how we
  // do it in my neighborhood." when he wins, "Ring, do your thing!" as his bubble rises
  "lantern-pick": { src: LANTERN("file0003-broken-beware-my-power"), len: 1.3 },
  "lantern-death": { src: BASS_DOWN, len: 2.0, layer: { src: LANTERN("file0105-well-thats-gonna-be-a-problem"), len: 1.3, gain: -3 } },
  "lantern-win": { src: LANTERN("file0031-thats-how-we-do-it-in-my-neighborhood"), len: 1.8 },
  "lantern-special": { src: LANTERN("file0043-broken-ring-do-your-thing"), len: 1.45 },
  // Donatello: "Nothing brains and a bo staff can't handle!" when picked, "Ugh! Shell shock!" over the falling bass,
  // "Cowabunga!" when he wins, "Bo spin!" as he spins his staff
  "donatello-pick": { src: DONNIE("pick"), len: 2.6 },
  "donatello-death": { src: BASS_DOWN, len: 2.2, layer: { src: DONNIE("death"), len: 1.9, gain: -3 } },
  "donatello-win": { src: DONNIE("win"), len: 1.6 },
  "donatello-special": { src: DONNIE("special"), len: 1.5 },
  // Penelope: "Ladies first!" when picked, "Oh my, my makeup!" over the falling bass, "Better luck next time!" when she wins,
  // "See ya!" as she blows her kiss
  "penelope-pick": { src: PENNY("pick"), len: 1.6 },
  "penelope-death": { src: BASS_DOWN, len: 2.7, layer: { src: PENNY("death"), len: 2.7, gain: -3 } },
  "penelope-win": { src: PENNY("win"), len: 1.8 },
  "penelope-special": { src: PENNY("special"), len: 1.2 },
  // The pink panther hardly ever speaks: his theme's saxophone when picked, "This isn't quite cricket." over the falling
  // bass, the theme's last flourish when he wins, and its creeping bass ("dum-dum... dum-dum") as he tiptoes out of sight
  "panther-pick": { src: PINK("theme-orig"), from: 12.1, len: 3.6 },
  "panther-death": { src: BASS_DOWN, len: 2.2, layer: { src: PINK("talking"), from: 12.65, len: 1.7, gain: -3 } },
  "panther-win": { src: PINK("theme-end"), len: 4.6 },
  "panther-special": { src: PINK("theme-orig"), from: 4.05, len: 2.5 },
  // Harry: "I solemnly swear that I'm up to no good" when picked, his cry over the falling bass, "Mischief managed" when
  // he wins, "Expecto Patronum!" as his stag charges out
  "harry-pick": { src: HARRY("swear1"), len: 2.6 },
  "harry-death": { src: BASS_DOWN, len: 2.0, layer: { src: HARRY("ah-54091890"), len: 1.1, gain: -3 } },
  "harry-win": { src: HARRY("mischief2"), len: 1.9 },
  "harry-special": { src: HARRY("patronum2"), len: 3.0 },
  // harry's stag: hooves galloping off (Freesound 197212 "Horse Gallop - Loopable" by HebronTheatre, CC0) under a bright
  // shimmer of light, fading as it runs to the far wall
  "optimus-pick": { src: OPTIMUS("11758-i-am-optimus-prime"), len: 3.8 },
  "optimus-death": { src: BASS_DOWN, len: 2.2, layer: { src: OPTIMUS("24039769-optimus-prime-uhuhua"), from: 4.45, len: 1.7, gain: -3 } },
  "optimus-win": { src: OPTIMUS("480883-until-that-day-till-all-are-one"), from: 3.7, len: 2.9 },
  "optimus-special": { src: OPTIMUS("480880-autobots-roll-out"), from: 1.1, len: 2.5 },
  "pele-pick": { src: PELE("24015411-galvao-lenda"), from: 0.26, len: 4.0 },
  "pele-death": { src: PELE("24015337-galvao-ai-ai-ai-ai"), from: 0.92, len: 1.15 },
  "pele-win": { src: PELE("24015278-e-tetra-e-tetra"), from: 1.66, len: 2.6 },
  "pele-special": { src: PELE("24015287-galvao-olha-o-gol"), from: 0.87, len: 1.9 },
  "lula-pick": { src: LULA("lula-bora-pra-rua-gente"), len: 1.35 },
  "lula-death": { src: LULA("lula-por-favor-me-ajuda_5UqDBWj"), len: 3.65 },
  "lula-win": { src: LULA("lula-picanha-e-cerveja_3zSp50v"), len: 4.85 },
  "lula-special": { src: LULA("vai-voltar-a-comer-picanha"), len: 1.98 },
  // pelé's kick: a ball struck hard
  kickball: { src: FS("555042_11910076-hq.mp3"), len: 0.6 },
  // optimus turning into his truck (or back): the cartoon's transforming sound; the truck's engine roaring off
  transform: { src: OPTIMUS("24139864-transform-og"), from: 0.8, len: 1.25 },
  truck: { src: OPTIMUS("24039944-optimus-prime-rev"), from: 0.7, len: 1.3 },
  gallop: {
    src: FS("197212_3001728-hq.mp3"),
    from: 0.6,
    len: 1.8,
    layer: { src: S("Epic Stock Media - Anime Game", "DSGNStngr_Power Up Bright Positive Successful Light Saturation Crash Shimmer 05_ESM_AG.wav"), len: 1.8, gain: -9 },
  },
  // her blown kiss: a cartoon smooch and a twinkle as the heart flies off
  kiss: {
    src: FS("444493_9159316-hq.mp3"),
    len: 0.65,
    layer: { src: CSD("User Interface", "Button Arp Twinkle.wav"), len: 0.6, gain: -8, at: 0.12 },
  },
  // his staff spin: two quick whooshes round him and the wooden crack of it batting something away
  spin: {
    src: CSD("Colossal Impacts", "Woosh Debris.wav"),
    len: 0.65,
    tempo: 1.6,
    layers: [
      { src: CSD("Colossal Impacts", "Woosh Debris.wav"), len: 0.4, gain: -3, tempo: 1.8, at: 0.2 },
      { src: K("impact-sounds", "impactWood_medium_002.ogg"), len: 0.3, gain: -4, at: 0.12 },
    ],
  },
  // his bubble rising: a force field humming up with a rising tone
  bubble: {
    src: K("sci-fi-sounds", "forceField_000.ogg"),
    len: 0.9,
    layers: [
      { src: K("digital-audio", "phaserUp6.ogg"), len: 0.5, gain: -6 },
      { src: K("digital-audio", "powerUp7.ogg"), len: 0.6, gain: -9, at: 0.15 },
    ],
  },
  // and giving way: a glassy crack and a falling zap
  pop: {
    src: K("impact-sounds", "impactGlass_light_002.ogg"),
    len: 0.6,
    layers: [{ src: K("digital-audio", "phaserDown3.ogg"), len: 0.45, gain: -5, at: 0.03 }],
  },
  // bugs' tunnel: quick scrapes of digging, a rumble running under the floor, a pop as he comes out
  dig: {
    src: K("impact-sounds", "footstep_snow_000.ogg"),
    len: 0.8,
    layers: [
      { src: K("impact-sounds", "footstep_snow_002.ogg"), len: 0.15, gain: -2, at: 0.09 },
      { src: K("impact-sounds", "footstep_grass_001.ogg"), len: 0.15, gain: -3, at: 0.18 },
      { src: CSD("Colossal Impacts", "Woosh Debris.wav"), len: 0.5, gain: -8, lowpass: 500, at: 0.12 },
      { src: K("interface-sounds", "pluck_002.ogg"), len: 0.25, gain: -2, at: 0.5 },
    ],
  },
  // the flash's dash: a whoosh tearing past, a crackle of the Speed Force
  zoom: {
    src: CSD("Colossal Impacts", "Woosh Debris.wav"),
    len: 0.7,
    layers: [
      { src: K("digital-audio", "phaserUp4.ogg"), len: 0.35, gain: -6 },
      { src: K("digital-audio", "zap1.ogg"), len: 0.4, gain: -8, at: 0.05 },
    ],
  },
  // Static's magnet pull: a crackling zap reaching out, the whir of it dragging back, a metal clank as it lands
  magnet: {
    src: K("digital-audio", "zapTwoTone2.ogg"),
    len: 0.5,
    layers: [
      { src: K("digital-audio", "phaserDown2.ogg"), len: 0.6, gain: -4, at: 0.12 },
      { src: K("sci-fi-sounds", "impactMetal_002.ogg"), len: 0.5, gain: -6, at: 0.45 },
    ],
  },
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
  const input = (s) => [...(s.from ? ["-ss", String(s.from)] : []), "-i", s.src];
  const inputs = [...input(r), ...layersOf(r).flatMap(input)];
  const graph = filterFor(r);
  const max = peakDb(inputs, graph);
  const gain = -1 - max;
  ffmpeg([...inputs, "-filter_complex", `${graph};[mix]volume=${gain}dB,aresample=48000[out]`, "-map", "[out]", "-c:a", "aac", "-b:a", "96k", join(OUT, `${name}.m4a`)]);
  console.log(`${name.padEnd(10)} peak ${max.toFixed(1)} dB -> ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB`);
}
