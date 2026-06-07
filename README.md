# Investment Conscience

An interactive presentation: **The AI Era Needs an Investment Conscience.**

Live narrated deck - 11 slides, each narrated in voice, with:
- **Play narrated** autoplay (advances slide-to-slide as each narration finishes)
- A **play button on every slide** for on-demand narration
- A **lip-sync video toggle** - a talking-head narrator on each slide
- A 3D scene carrying the spine: the Chief Problem Officer node and a Continuous
  Recursive Improvement (WSP) loop ring, toward Business Longevity

## Run locally
The deck loads its `audio/` and `lipsync/` media over HTTP, so serve the folder
(a raw `file://` open will not load the media):

```
python -m http.server 8799
```
then open http://127.0.0.1:8799/index.html

## Structure
- `index.html` - the deck (self-contained markup + styles + scripts)
- `audio/slide-1.mp3 .. slide-11.mp3` - per-slide narration (+ `narration.json`)
- `lipsync/slide-1.mp4 .. slide-11.mp4` - per-slide lip-synced talking-head videos

## Domain
Publishing to **investmentconscience.com**.
