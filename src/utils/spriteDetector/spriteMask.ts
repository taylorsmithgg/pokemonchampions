/**
 * Sprite isolation — port of `extract_sprite_mask` from
 * `pokemon_detector/core/matcher.py`.
 *
 * Strategy:
 *   1. Build an HSV mask of the card background (crimson opponent /
 *      blue-or-green player).
 *   2. Invert to isolate the sprite pixels.
 *   3. Morphological open + close to erase 1-2px noise.
 *   4. Drop connected components smaller than 0.5% of card area.
 */

import type { PixelView, Mask, MutableMask } from './image.ts';
import { toHsv, createMask } from './image.ts';
import { connectedComponents, morphClose, morphOpen } from './morphology.ts';

export type PanelType = 'opponent' | 'player';

/** Visual layout being processed. `selection` matches the historic
 *  team-pick grid (uniform blue/green player background). `lock` is
 *  the "Standing By" screen where each player card is type-tinted
 *  individually. The two modes need different background masks because
 *  the lock player background varies card-by-card. */
export type LineupMode = 'selection' | 'lock';

/**
 * Sample the dominant background hue for a single LOCK-screen card.
 *
 * We sample ONLY the right edge of the crop, NOT all four corners —
 * locked cards have a number badge ("1"/"2"/"3") in the top-left, and
 * the bottom-left often has card-edge artifacts. The right edge of the
 * standard lock player crop (x=[2%, 50%] of the card) lands in the
 * gap between the chibi and the type-icon column, which is reliably
 * pure card-tint on both locked and unlocked cards. Sampling a tall
 * vertical band on the right gives us a clean median hue.
 *
 * We also accept LOW-saturation pixels here (S>=20 instead of 50) so
 * dark-blue unlocked cards (S~80, V~60) don't get rejected.
 */
function sampleLockCardBackground(
  src: PixelView,
): { hMin: number; hMax: number; sMin: number; vMin: number; vMax: number } | null {
  const hsv = toHsv(src);
  const { width, height, h, s, v } = hsv;
  if (width < 8 || height < 8) return null;
  // Right-edge band: rightmost 10% of the crop, full height (excl. ~5%
  // top/bottom to skip card-rim artifacts). This region sits in the
  // chibi-to-type-icon gap on the lock screen and is pure card tint.
  const bandW = Math.max(4, Math.floor(width * 0.10));
  const yLo = Math.floor(height * 0.05);
  const yHi = height - Math.floor(height * 0.05);
  const samples: number[] = [];
  let sSum = 0, vSum = 0, sCount = 0;
  for (let y = yLo; y < yHi; y++) {
    for (let x = width - bandW; x < width; x++) {
      const i = y * width + x;
      if (s[i] < 20) continue;       // pure white badge, type-icon backplate
      if (v[i] < 25) continue;       // shadow
      samples.push(h[i]);
      sSum += s[i];
      vSum += v[i];
      sCount++;
    }
  }
  if (samples.length < 8) return null;
  samples.sort((a, b) => a - b);
  const medianH = samples[Math.floor(samples.length / 2)];
  const p10 = samples[Math.floor(samples.length * 0.1)];
  const p90 = samples[Math.floor(samples.length * 0.9)];
  const meanS = sSum / sCount;
  const meanV = vSum / sCount;
  // Adaptive hue tolerance. A flat type-tint (green, purple) gives a
  // very narrow sampled spread (1-2°) — we can safely use a tight
  // tolerance that won't eat chibi pixels with a nearby hue. A
  // gradient tint (e.g. ghost card with a purple-to-blue fade) has a
  // wider sampled spread and needs a matching wider tolerance so
  // neither end of the gradient leaks back into the sprite mask.
  //
  // Fixed ±12 was too wide for the Azumarill-on-grass-tint case on
  // f_00697 slot 0: bg H≈39 and the yellow chibi body H≈24-34 are
  // only 5-15° apart. ±12 absorbed the chibi right edge (Azumarill
  // fuzz at H=27-34) as bg and the mask collapsed to a 21px sliver.
  //
  // Formula: spread + 3° safety margin, clamped to [5, 14]. The 5°
  // floor avoids false negatives on type-tints that genuinely span
  // a thin band; the 14° ceiling protects against wildly-gradient
  // cards without regressing the close-hue case.
  const HUE_TOL = Math.min(14, Math.max(5, (p90 - p10) + 3));
  return {
    hMin: medianH - HUE_TOL,
    hMax: medianH + HUE_TOL,
    sMin: Math.max(40, meanS - 60),
    vMin: Math.max(40, meanV - 60),
    vMax: Math.min(255, meanV + 60),
  };
}

/**
 * Sample the dominant background colour for a single SELECTION-screen
 * player card.
 *
 * The historic hard-coded "H in [110, 140]" bgBlue rule works great
 * for the standard purple/indigo card fill, but collapses in two
 * regimes that appear in the live Champions stream we regress against:
 *
 *   1. PURPLE CHIBI on purple bg (Gengar): the chibi body shares the
 *      card hue (H≈115-125) AND shares the saturation (S≈80-140), so
 *      the "any purple pixel is bg" rule masks out ~95% of Gengar,
 *      leaving only the red eyes + white teeth (spriteFrac=5.5% on
 *      trail export 2026-04-20T22:44:57). The 5% silhouette that
 *      remains matches Vivillon / Castform's wing markings instead of
 *      Gengar.
 *
 *   2. GREEN HIGHLIGHTED card (selected slot): the "Standing By" /
 *      selected player slot gets repainted green (H≈40-60), completely
 *      outside the [110, 140] bgBlue range. The old mask flags ~0%
 *      of the crop as bg, so the full green card (including the bg
 *      behind the chibi) is fed to the matcher as "sprite" —
 *      spriteFrac=96.9% for Kommo-o on slot 5, which drags every
 *      scoring signal into noise (Machamp wins at combined=0.208,
 *      below the 0.22 confidence floor).
 *
 * Fix: sample the card's actual bg tint from the top/bottom bands of
 * the crop (where chibis almost never reach), excluding pixels that
 * look like the card's white highlight rim or the very dark outline
 * pixels of the chibi. Compute a dominant hue + saturation + value
 * window and use THAT as the bg signature. Saturation is now bounded
 * on BOTH ends so ultra-saturated chibi pixels sharing the bg hue
 * (Gengar's deep purple) survive the mask.
 */
function sampleSelectionPlayerBackground(
  src: PixelView,
): {
  hMin: number;
  hMax: number;
  sMin: number;
  sMax: number;
  vMin: number;
  vMax: number;
} | null {
  const hsv = toHsv(src);
  const { width, height, h, s, v } = hsv;
  if (width < 24 || height < 24) return null;

  // Skip the outermost border — ~3% or 3px, whichever is larger. That
  // absorbs the card's rounded frame + highlight rim.
  const marginX = Math.max(3, Math.floor(width * 0.03));
  const marginY = Math.max(3, Math.floor(height * 0.03));

  // Sample from the FOUR CORNERS only. A horizontal "top band" would
  // pick up tall chibi pixels (Kommo-o's horns, Tyranitar's spikes,
  // Gengar's ears all reach into the top 10% of the crop on this
  // stream's UI). Corner patches are small enough that even the
  // widest chibis don't reach them — the card bg shows through
  // reliably.
  const cornerW = Math.max(6, Math.floor(width * 0.14));
  const cornerH = Math.max(6, Math.floor(height * 0.12));
  const corners: Array<{ xLo: number; xHi: number; yLo: number; yHi: number }> = [
    { xLo: marginX, xHi: marginX + cornerW, yLo: marginY, yHi: marginY + cornerH },
    { xLo: width - marginX - cornerW, xHi: width - marginX, yLo: marginY, yHi: marginY + cornerH },
    { xLo: marginX, xHi: marginX + cornerW, yLo: height - marginY - cornerH, yHi: height - marginY },
    { xLo: width - marginX - cornerW, xHi: width - marginX, yLo: height - marginY - cornerH, yHi: height - marginY },
  ];

  type Sample = { H: number; S: number; V: number };
  const samples: Sample[] = [];
  for (const c of corners) {
    for (let y = c.yLo; y < c.yHi; y++) {
      for (let x = c.xLo; x < c.xHi; x++) {
        const i = y * width + x;
        const S = s[i];
        const V = v[i];
        // Reject card-frame whites (desaturated bright pixels), the
        // chibi's dark outline, and the card's inner shadow gutter.
        if (S < 30) continue;
        if (V < 35 || V > 235) continue;
        samples.push({ H: h[i], S, V });
      }
    }
  }
  if (samples.length < 32) return null;

  // Find dominant hue via a 180-bin histogram with ±3° smoothing.
  const raw = new Int32Array(180);
  for (const p of samples) raw[p.H]++;
  const smoothed = new Int32Array(180);
  for (let i = 0; i < 180; i++) {
    let acc = 0;
    for (let d = -3; d <= 3; d++) acc += raw[(i + d + 180) % 180];
    smoothed[i] = acc;
  }
  let dominantH = 0;
  let dominantCount = 0;
  for (let i = 0; i < 180; i++) {
    if (smoothed[i] > dominantCount) {
      dominantCount = smoothed[i];
      dominantH = i;
    }
  }

  // Keep only samples whose hue is within ±12° (wrap-aware) of the
  // dominant peak. Anything outside is presumed to be a chibi pixel
  // leaking into the band (tall tails / ears) or a highlight artifact.
  const filtered = samples.filter(p => {
    const dh = Math.min(
      Math.abs(p.H - dominantH),
      180 - Math.abs(p.H - dominantH),
    );
    return dh <= 12;
  });
  if (filtered.length < 16) return null;

  // Use median + interquartile range now that we're sampling from
  // chibi-free corner patches. The old p10-p90 window was compensating
  // for chibi contamination in the top/bottom bands; with clean
  // corner samples we can afford a tighter window so saturated chibi
  // pixels that share the bg hue (Gengar's S=160 body on an S=120 bg)
  // fall outside and survive as sprite.
  const ss = filtered.map(p => p.S).sort((a, b) => a - b);
  const vs = filtered.map(p => p.V).sort((a, b) => a - b);
  const sMed = ss[Math.floor(ss.length * 0.5)];
  const sP75 = ss[Math.floor(ss.length * 0.75)];
  const vMed = vs[Math.floor(vs.length * 0.5)];
  const vP75 = vs[Math.floor(vs.length * 0.75)];
  // IQR-based slack: widen tolerance by the observed spread so
  // gradient-tinted backgrounds (the selected-card green highlight,
  // which runs from neon-lime to darker green across the card) don't
  // lose half their pixels to the mask.
  const sSlack = Math.max(20, (sP75 - ss[Math.floor(ss.length * 0.25)]) * 1.5);
  const vSlack = Math.max(25, (vP75 - vs[Math.floor(vs.length * 0.25)]) * 1.5);

  return {
    // Narrow hue window — tight enough to spare chibi pixels whose
    // hue differs from the card tint (Gengar's red eyes at H≈0-5
    // fall well outside a ±10° window even though the card bg and
    // Gengar's body are both at H≈123).
    hMin: dominantH - 10,
    hMax: dominantH + 10,
    sMin: Math.max(20, sMed - sSlack),
    sMax: Math.min(255, sMed + sSlack),
    vMin: Math.max(20, vMed - vSlack),
    vMax: Math.min(255, vMed + vSlack),
  };
}

/**
 * Sample the crimson-bg V range for a single opponent card.
 *
 * We look at thin strips along the left and right edges of the card
 * (avoiding the chibi's central column). The rendered chibi almost
 * never reaches the leftmost or rightmost 8% of the crop, so those
 * bands are a reliable sample of pure bg. Pixels are accepted into
 * the sample only if they match the crimson hue + saturation
 * signature (so badge numbers or type icons sitting on the edge
 * don't pollute the range).
 *
 * Returns the observed [vMin, vMax] of bg pixels, or a safe default
 * if too few samples were collected (fallback preserves the previous
 * "V < 155" behaviour for cards where the sampler fails).
 */
function sampleOpponentBgVRange(hsv: {
  h: Uint8Array;
  s: Uint8Array;
  v: Uint8Array;
  width: number;
  height: number;
}): { vMin: number; vMax: number } {
  const { width, height, h, s, v } = hsv;
  const bandW = Math.max(2, Math.floor(width * 0.08));
  const samples: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < bandW; x++) {
      const i = y * width + x;
      if ((h[i] > 140 || h[i] < 12) && s[i] > 200) samples.push(v[i]);
    }
    for (let x = width - bandW; x < width; x++) {
      const i = y * width + x;
      if ((h[i] > 140 || h[i] < 12) && s[i] > 200) samples.push(v[i]);
    }
  }
  if (samples.length < 16) return { vMin: 0, vMax: 155 };
  samples.sort((a, b) => a - b);
  // Use 2nd and 98th percentiles to trim the odd leaked sprite pixel.
  const lo = samples[Math.floor(samples.length * 0.02)];
  const hi = samples[Math.floor(samples.length * 0.98)];
  return { vMin: lo, vMax: hi };
}

function cardBackgroundMask(
  src: PixelView,
  panel: PanelType,
  mode: LineupMode = 'selection',
): MutableMask {
  const { width, height } = src;
  const hsv = toHsv(src);
  const { h, s, v } = hsv;
  const out = createMask(width, height);
  const dst = out.data;
  const n = width * height;

  if (panel === 'opponent') {
    // Crimson opponent background sits at H≈165-170 with S=255 (fully
    // saturated). The V channel has a vertical gradient across each
    // card (brighter top, darker bottom) and pixel sampling shows
    // real bg V typically spans ~75-150.
    //
    // BUT — red-bodied chibis (Armarouge's red legs, Scizor-Mega's
    // plates, Hydrapple's apple) have pixels at the SAME H (≈170)
    // and SAME S (255) with V in the ~60-95 range. A fixed
    // `V < 155` bgCard rule treats those red sprite pixels as bg,
    // which gets Armarouge misread as Scovillain-shiny (the stripped
    // torso happens to template-match a yellow cactus).
    //
    // Fix: SAMPLE the card's corner + edge strips to learn THIS
    // card's actual bg V range, then mask only pixels in that range.
    // Sprite pixels with the same hue but a V below the observed bg
    // floor survive as sprite.
    //
    // S>200 is kept: it protects warm-toned chibis (Hydreigon's deep-
    // red body has S 103-172) — without it, ~80% of Hydreigon's pixels
    // were erased as bg, leaving only a head fragment that mis-matched
    // to Aurorus / Ceruledge.
    //
    // Warm-palette interior holes (Hydrapple's apple center that IS
    // entirely inside the observed bg V range) are handled AFTER the
    // mask is built via `fillBgHoles` below, which keeps only "bg"
    // labels connected to the card edges.
    //
    // The dark-bg threshold is mode-dependent:
    //   * V<20 on the SELECTION screen — keeps dark-bodied chibis
    //     (Umbreon, Tyranitar, Hydreigon interior) intact.
    //   * V<50 on the LOCK screen — absorbs the 2-3px dark-navy RING
    //     that circles every opponent card between the crimson fill
    //     and the panel bg. Without it, the ring walls off the
    //     crimson pool from the crop edges, causing fillBgHoles to
    //     misclassify huge swaths of crimson as "enclosed sprite
    //     interior" (Hydrapple mask was inflating to the full crop).
    const vDark = mode === 'lock' ? 50 : 20;
    const bgV = sampleOpponentBgVRange(hsv);
    // Adaptive FLOOR: Armarouge's red legs sit at V≈60-95; real bg
    // for this card never goes below ~100 (p2 after filter). Using
    // the observed bg floor minus an 8-unit gradient safety margin
    // lets dark-red sprite pixels survive.
    //
    // Fixed CEILING at 155: Hydrapple's bright-red apple highlights
    // reach V≈165-175 (sometimes higher than a bg gradient's p98),
    // so an adaptive ceiling risks masking them as bg. The historic
    // fixed cap keeps those highlights as sprite, and stray bright
    // bg pixels above the cap are mopped up by the subsequent
    // morphological close + keepDominantOpponentComponent step.
    const vFloor = Math.max(vDark + 1, bgV.vMin - 8);
    const vCeil = 155;
    for (let i = 0; i < n; i++) {
      const H = h[i], S = s[i], V = v[i];
      const bgCard = (H > 140 || H < 12) && S > 200 && V >= vFloor && V < vCeil;
      const bgDark = V < vDark;
      if (bgCard || bgDark) dst[i] = 255;
    }
  } else if (mode === 'lock') {
    // LOCK-screen player card: each card is tinted by its Pokémon's
    // primary type, so we can't hard-code the bg hue like the selection
    // grid. Sample the card's corners for the dominant background and
    // mask out anything close to it.
    const range = sampleLockCardBackground(src);
    if (!range) {
      // Couldn't determine bg — fall back to "very dark" only and let
      // morph + filterSmallComponents do their best.
      for (let i = 0; i < n; i++) {
        if (v[i] < 30) dst[i] = 255;
      }
    } else {
      const { hMin, hMax, sMin, vMin, vMax } = range;
      // Hue wraparound handling: if the range crosses 0 / 180 (red
      // tints like fire types), accept either side.
      const wraps = hMin < 0 || hMax > 180;
      const hMinW = ((hMin % 180) + 180) % 180;
      const hMaxW = ((hMax % 180) + 180) % 180;
      for (let i = 0; i < n; i++) {
        const H = h[i], S = s[i], V = v[i];
        let hueOk: boolean;
        if (!wraps) {
          hueOk = H >= hMin && H <= hMax;
        } else {
          // Range wraps — treat as union of two intervals.
          hueOk = (H >= hMinW && H <= 180) || (H >= 0 && H <= hMaxW);
        }
        const bgTint = hueOk && S >= sMin && V >= vMin && V <= vMax;
        const bgDark = V < 25;
        if (bgTint || bgDark) dst[i] = 255;
      }
    }
  } else {
    // SELECTION-screen player card — sample the card's actual bg tint
    // per-card instead of hard-coding H=110-140. See
    // `sampleSelectionPlayerBackground` for the rationale and the two
    // failure modes this replaces (purple chibi on purple bg → 95%
    // mask eat; green highlighted card → 0% mask).
    //
    // We still preserve the two hard rules that the old mask relied
    // on:
    //   - bgDark (V < 20): very dark pixels are never sprite. The
    //     chibi's OUTLINE also sits in this range, but the matcher
    //     tolerates the outline being absent; keeping it was a bigger
    //     liability because the shadow gutter under the chibi shared
    //     the same darkness and shape.
    //   - bgGreenEdge: the currently-selected card has a thick neon
    //     green highlight RING around all four borders. Even with
    //     adaptive sampling the ring can survive — the sampler's
    //     dominant-hue filter will ignore it as an outlier when the
    //     rest of the card is still its base tint. Keep the explicit
    //     2-3px edge rule so the ring is always rejected.
    const range = sampleSelectionPlayerBackground(src);
    const edge = Math.max(2, Math.min(3, Math.floor(Math.min(width, height) * 0.025)));

    if (!range) {
      // Sampler failed (tiny crop / saturated frame noise / etc.).
      // Fall back to the historic hard-coded rule so we degrade to
      // the old behaviour rather than masking nothing.
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const H = h[i], S = s[i], V = v[i];
          const bgBlue = H >= 110 && H <= 140 && S >= 40 && V >= 40;
          const bgDark = V < 20;
          const inEdgeBand = y < edge || y >= height - edge || x < edge || x >= width - edge;
          const bgGreenEdge = inEdgeBand && H >= 25 && H <= 55 && S >= 100 && V >= 120;
          if (bgBlue || bgDark || bgGreenEdge) dst[i] = 255;
        }
      }
    } else {
      const { hMin, hMax, sMin, sMax, vMin, vMax } = range;
      const wraps = hMin < 0 || hMax > 180;
      const hMinW = ((hMin % 180) + 180) % 180;
      const hMaxW = ((hMax % 180) + 180) % 180;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const H = h[i], S = s[i], V = v[i];
          let hueOk: boolean;
          if (!wraps) {
            hueOk = H >= hMin && H <= hMax;
          } else {
            hueOk = (H >= hMinW && H <= 180) || (H >= 0 && H <= hMaxW);
          }
          // Adaptive card-bg test. Saturation is bounded on BOTH ends
          // so chibi pixels whose hue matches the bg but whose S is
          // well above the bg's saturation (the high-S interior of
          // Gengar, Kommo-o, Meganium) survive. Similarly bounded V
          // spares chibi highlights brighter than the bg.
          const bgCard = hueOk && S >= sMin && S <= sMax && V >= vMin && V <= vMax;
          // NOTE: we intentionally DO NOT flag V<20 as bg on the
          // adaptive-sampler path. The chibi's dark outline sits in
          // that range on almost every sprite, and we NEED the outline
          // to survive as "sprite" so `fillBgHoles` (enabled below
          // for player-selection via `extractSpriteMask`) can
          // reclassify enclosed bg-hue pixels (Gengar's body, Kommo-o's
          // body when selected-green) as sprite interior. Without a
          // surviving outline the "enclosed" region escapes to the
          // image edge and stays flagged as bg — which was exactly
          // the 5.5%-mask-survival regression on the Gengar slot.
          //
          // Tradeoff: the dark shadow gutter directly under the chibi
          // joins the sprite cluster. That's fine — morphological
          // close merges it with the body and the tiny shadow sliver
          // doesn't noticeably shift the sprite bbox.
          const inEdgeBand = y < edge || y >= height - edge || x < edge || x >= width - edge;
          const bgGreenEdge =
            inEdgeBand && H >= 25 && H <= 55 && S >= 100 && V >= 120;
          if (bgCard || bgGreenEdge) dst[i] = 255;
        }
      }
    }
  }
  return out;
}

/** Invert a binary mask. */
function invertMask(mask: Mask): MutableMask {
  const out = createMask(mask.width, mask.height);
  const src = mask.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i++) dst[i] = src[i] ? 0 : 255;
  return out;
}

/**
 * Reclassify small enclosed bg pixels as sprite via edge-connected
 * flood-fill + hole-size limit.
 *
 * Problem: warm-palette chibis (Hydrapple's red apple, Armarouge's
 * scarlet plate) have pixels that fall inside the crimson-bg HSV box
 * (same H, same S, V within tolerance). The plain HSV mask erases
 * those pixels as "background", leaving only the dark outline. The
 * matcher then sees a tiny fragment and misidentifies (Armarouge →
 * Scovillain, Hydrapple → Basculegion).
 *
 * Fix idea: true card bg is always CONNECTED to the card edges. Any
 * bg-labeled pixel NOT reachable from the border is a hole inside
 * the chibi outline and should be reclassified as sprite.
 *
 * Caveat (discovered on Hydrapple): the card's OUTER navy panel ring
 * (V~30, H~115) is not crimson and therefore NOT in the bg mask. That
 * 2-3 pixel ring breaks flood-fill reachability — the crimson pool
 * behind the sprite gets walled off and the naive flood-fill marks
 * THE ENTIRE CRIMSON CARD as an "enclosed hole", inflating the sprite
 * bbox to the full card.
 *
 * Refinement: only fill holes whose area is below `maxHoleFrac` of
 * the total crop. Real chibi interior pools are <= ~25% of the crop;
 * anything larger is almost certainly a flood-fill failure from a
 * disconnected edge ring.
 *
 * Operates on the BACKGROUND mask (before inversion).
 */
function fillBgHoles(bgMask: MutableMask, maxHoleFrac = 0.25): void {
  const { width, height, data } = bgMask;
  const n = width * height;
  const reachable = new Uint8Array(n);
  const stack: number[] = [];

  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (!data[idx] || reachable[idx]) return;
    reachable[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < width) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < height) push(x, y + 1);
  }

  // Group unreachable-bg pixels into components by BFS. Only
  // reclassify components smaller than maxHoleFrac of the crop.
  const maxHolePx = Math.floor(n * maxHoleFrac);
  const visited = new Uint8Array(n);
  for (let seed = 0; seed < n; seed++) {
    if (!data[seed] || reachable[seed] || visited[seed]) continue;
    // BFS to collect this hole.
    const hole: number[] = [];
    const queue = [seed];
    visited[seed] = 1;
    while (queue.length > 0) {
      const idx = queue.pop()!;
      hole.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x + 1 < width ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y + 1 < height ? idx + width : -1,
      ];
      for (const nIdx of neighbors) {
        if (nIdx < 0) continue;
        if (!data[nIdx] || reachable[nIdx] || visited[nIdx]) continue;
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
    if (hole.length <= maxHolePx) {
      for (const idx of hole) data[idx] = 0;
    }
  }
}

/** Drop connected components below `minAreaFrac` of the image area. */
function filterSmallComponents(mask: MutableMask, minAreaFrac: number): void {
  const { width, height, data } = mask;
  const minArea = width * height * minAreaFrac;
  const { labels, components } = connectedComponents(mask);
  for (const comp of components) {
    if (comp.label === 0) continue;
    if (comp.area < minArea) {
      // Zero out this component
      for (let y = comp.minY; y <= comp.maxY; y++) {
        for (let x = comp.minX; x <= comp.maxX; x++) {
          const idx = y * width + x;
          if (labels[idx] === comp.label) data[idx] = 0;
        }
      }
    }
  }
}

/**
 * Keep only the dominant chibi cluster — used for OPPONENT panel only.
 *
 * The crimson opponent panel routinely has bright magenta UI animation
 * streaks across cards (see f257s slot 6 Victreebel) that survive the
 * bg mask. Without filtering, `findSpriteBounds` spans the chibi PLUS
 * the streak and stretches the sprite's aspect ratio in the template,
 * killing the NCC and matching the wrong species (e.g. Rotom-Mow over
 * Victreebel).
 *
 * Opponent chibis are highly saturated and rarely fragment under the
 * crimson bg mask, so we can safely keep only the largest component
 * plus any other component whose bbox vertically aligns with the
 * dominant (multi-part sprites like Hydreigon's three heads).
 *
 * IMPORTANT: This filter is destructive for PLAYER cards because the
 * V<20 bgDark rule fragments dark-bodied chibis (Umbreon, Houndoom,
 * Tyranitar) into dozens of small surviving blobs — keepDominant
 * would drop them and shrink the bbox to a single yellow ring or
 * highlight, dragging the match to the wrong species.
 */
function keepDominantOpponentComponent(mask: MutableMask): void {
  const { width, height, data } = mask;
  const { labels, components } = connectedComponents(mask);
  const real = components.filter(c => c.label !== 0 && c.area > 0);
  if (real.length <= 1) return;
  real.sort((a, b) => b.area - a.area);
  const dominant = real[0];
  const minArea = dominant.area * 0.15;
  const keep = new Set<number>([dominant.label]);
  for (let i = 1; i < real.length; i++) {
    const c = real[i];
    if (c.area < minArea) continue;
    const xOverlap = Math.min(c.maxX, dominant.maxX) - Math.max(c.minX, dominant.minX);
    if (xOverlap <= 0) continue;
    keep.add(c.label);
  }
  for (let i = 0; i < width * height; i++) {
    if (!keep.has(labels[i])) data[i] = 0;
  }
}

export interface SpriteMaskOptions {
  /** Min connected-component area as a fraction of the card area. */
  minAreaFrac?: number;
  /** Kernel size for the final open + close cleanup step. */
  morphKernel?: number;
  /** Which UI screen the card was extracted from. Lock-screen cards
   *  use adaptive per-card background sampling because each card has a
   *  different type-tinted background. Defaults to `selection`. */
  mode?: LineupMode;
}

/**
 * Build a foreground (sprite) mask from a cropped card image.
 *
 * The returned mask uses 0 for background and 255 for sprite pixels,
 * matching the convention used by the rest of the detector modules.
 */
export function extractSpriteMask(
  cardImg: PixelView,
  panel: PanelType,
  options: SpriteMaskOptions = {},
): MutableMask {
  const minAreaFrac = options.minAreaFrac ?? 0.005;
  const morphKernel = options.morphKernel ?? 3;
  const mode = options.mode ?? 'selection';

  const background = cardBackgroundMask(cardImg, panel, mode);
  if (panel === 'opponent') {
    // Reclassify enclosed bg pixels (warm-red holes inside Hydrapple/
    // Armarouge chibis) as sprite.
    fillBgHoles(background);
  } else if (mode === 'selection') {
    // Player SELECTION chibis frequently share their body hue with
    // the card bg (Gengar purple on purple panel, Kommo-o green on
    // selected-green highlight). The adaptive bg sampler catches
    // those pixels as "bg", but they're enclosed inside the chibi's
    // dark outline. Flood-fill from the card edges — anything NOT
    // reachable from the border is a chibi interior hole, not true
    // bg, and should be reclassified as sprite.
    //
    // maxHoleFrac=0.45 is generous compared to the opponent branch's
    // 0.25 default because selection player crops are tight — the
    // chibi occupies 40-60% of the crop, so its enclosed interior
    // pool can legitimately exceed 25%. Any larger floods (e.g.
    // outline broken open at the base) are guarded against by the
    // subsequent filterSmallComponents / morph steps.
    fillBgHoles(background, 0.45);
  }
  let sprite = invertMask(background);
  sprite = morphOpen(sprite, morphKernel);
  sprite = morphClose(sprite, morphKernel);
  filterSmallComponents(sprite, minAreaFrac);
  if (panel === 'opponent') {
    keepDominantOpponentComponent(sprite);
  } else if (mode === 'lock') {
    // Lock-screen player cards: the adaptive bg mask sometimes leaves
    // the type-icon column (right edge) and the number badge (top-left
    // corner) as detached blobs. Keep the chibi cluster only.
    keepDominantPlayerLockComponent(sprite);
  }
  return sprite;
}

/**
 * Lock-screen player cards have icon + number-badge artifacts that the
 * adaptive bg mask can't fully erase (they're white/dark-text against
 * the type tint). Keep only the largest component plus any siblings
 * vertically aligned with it (multi-piece chibis like Hydreigon's heads).
 *
 * Same algorithm as `keepDominantOpponentComponent` but exposed
 * separately because the selection-screen player branch must NOT use
 * it (dark-bodied chibis fragment heavily and would lose pixels).
 */
function keepDominantPlayerLockComponent(mask: MutableMask): void {
  const { width, height, data } = mask;
  const { labels, components } = connectedComponents(mask);
  const real = components.filter(c => c.label !== 0 && c.area > 0);
  if (real.length <= 1) return;
  real.sort((a, b) => b.area - a.area);
  const dominant = real[0];
  const minArea = dominant.area * 0.20;
  const keep = new Set<number>([dominant.label]);
  for (let i = 1; i < real.length; i++) {
    const c = real[i];
    if (c.area < minArea) continue;
    const xOverlap = Math.min(c.maxX, dominant.maxX) - Math.max(c.minX, dominant.minX);
    if (xOverlap <= 0) continue;
    keep.add(c.label);
  }
  for (let i = 0; i < width * height; i++) {
    if (!keep.has(labels[i])) data[i] = 0;
  }
}

/**
 * Tight crop around the sprite mask (foreground pixels). Returns the
 * region and a cropped mask/image pair useful for feature extraction.
 *
 * If no foreground pixels remain, returns `null`.
 */
export interface SpriteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function findSpriteBounds(mask: Mask): SpriteBounds | null {
  const { data, width, height } = mask;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}
