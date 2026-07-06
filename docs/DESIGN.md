# Framepick — Design Direction

The single source of truth for how Framepick looks and feels. Every build/QA run follows this;
change it only deliberately, in its own commit, with a reason.

## 1. Aesthetic direction

**Framepick is a cutting-room contact sheet: warm darkroom paper, ink-black type, and one
confident vermilion clapper-marker accent.** It reads like a page torn from a film-editing
manual — precise, editorial, analog-warm — not another dark dashboard. This is a deliberate
departure from the portfolio's recent dark-teal/amber terminal themes: Framepick is a **light,
paper-first** design where the *frames themselves* are the color, laid on a neutral warm stage
so the imagery pops. The one saturated accent is the grease-pencil mark an editor makes on the
strip.

## 2. Tokens (actual values)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#efe9dd` | warm paper stage (page background) |
| `--surface-1` | `#f7f3ea` | cards, dropzone, panels |
| `--surface-2` | `#e4dccb` | insets, filmstrip rails, track grooves |
| `--ink` | `#211d17` | primary text, wordmark, near-black |
| `--muted` | `#6f6656` | secondary text, timecodes, captions |
| `--line` | `#d3c9b4` | hairline borders, grid rules |
| `--accent` | `#e2452b` | vermilion — clapper mark, primary CTA, active cut, focus ring |
| `--accent-ink` | `#a8321d` | pressed/hover-darkened accent |
| `--support` | `#2f4a53` | deep slate-teal — links, secondary controls, sprocket holes |
| `--success` | `#3f7d55` | valid file / export complete |
| `--danger` | `#b23a2a` | unsupported browser / decode error |

- **Type pairing:** display **Fraunces** (high-contrast editorial serif, `opsz` optical size)
  for the wordmark and headings; UI **Inter** for body, controls, and timecodes. Timecodes and
  numeric readouts use Inter with `font-variant-numeric: tabular-nums`. System fallbacks:
  `Fraunces, "Times New Roman", serif` and `Inter, system-ui, sans-serif`.
- **Type scale:** ~1.25 ratio — 12 / 13 / 15 (base) / 19 / 24 / 31 / 44 px. Wordmark 44px+.
- **Spacing:** 4px base scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64).
- **Radius:** 4px on controls, 8px on cards, 2px on filmstrip cells (frames are nearly square-cut).
- **Shadow:** soft, warm, layered — `0 1px 0 #fff8 inset, 0 2px 8px rgba(33,29,23,.10),
  0 12px 32px rgba(33,29,23,.08)`. No neon glows; depth comes from paper-realistic shadow.
- **Motion:** UI transitions 140–220ms ease-out (`cubic-bezier(.2,.7,.2,1)`); the scan/progress
  animation loops at a calm ~1.2s. Respect `prefers-reduced-motion`.

## 3. Layout intent

- **Hero = the contact sheet.** On desktop (1440×900) the layout is a two-part composition: a
  slim left/top **control rail** (dropzone → sensitivity slider → stats) and a large **results
  stage** that holds the filmstrip contact sheet and fills ≥60% of the viewport. Before a video
  is loaded, the dropzone itself is the hero — large, centered in the stage, with the animated
  wordmark above it — so there is never a tiny widget adrift in empty paper.
- **Filmstrip motif:** results render as a responsive grid of keyframe cells framed like a
  35mm strip — a `--surface-2` rail top and bottom punched with sprocket holes. Each cell shows
  the frame, its timecode chip, and a hover download affordance.
- **Phone (390×844):** single column — wordmark, dropzone, slider, then the contact sheet as a
  1–2 wide strip. Controls are ≥44px. No horizontal scroll; the paper texture runs edge to edge.

## 4. Signature detail

**The animated wordmark + the sprocket-punched filmstrip.** The wordmark "Framepick" is set in
Fraunces with the **"i" dot replaced by a small vermilion sprocket square**, and on load a thin
grease-pencil accent line sweeps once beneath it (like marking a strip for a cut). During
analysis, a soft vermilion **scan line** travels down the dropzone/preview. The contact-sheet
rails carry real punched sprocket holes (`--support`), which is the detail that sells "film"
over "image grid."

## 5. Not a game

Framepick is a utility, so there is no game-juice/SFX plan. Feedback is restrained and physical:
the scan line during decode, a keyframe cell that lifts on hover, a timecode chip that reads
tabular, and a brief success pulse on the stats when analysis completes. No sound.

## Favicon & brand

Inline SVG data-URI favicon: a vermilion sprocket-punched film cell (a rounded square with two
`--support` holes) on the paper `--bg`. Monogram alternative: a bold serif "F" with a clapper
slash. Never the default globe.

## Anti-generic checklist (self-enforced)

No system-font-only type · no unstyled native slider/buttons (the sensitivity range and file
button are fully themed) · no pure `#fff`/`#000` surfaces (paper + ink instead) · no three-gray-
cards-with-emoji feature row · the background always carries the warm paper treatment, never a
flat empty fill · the landing/marketing copy and the app share these exact tokens — one brand.
