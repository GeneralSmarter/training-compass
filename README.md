# Training Compass

A static, local-first strength + running coach. **Public code, private data.** Three active JEFIT gym days (Upper, Push, Pull), three runs, an optional Short Pump. Lower is an uncalibrated opt-in template, not part of the active plan. The public repository contains no personal training records or weights. A private JEFIT starter file supplies reference loads only after you import it.

## Use

1. Open the [GeneralSmarter GitHub Pages app](https://generalsmarter.github.io/training-compass/).
2. **Sync & backup → Load private starter**; select `%LOCALAPPDATA%/hermes/training-compass/private-starter.json` from the local computer. Verify each suggested load in warm-ups. The public site cannot read this file unless you choose it.
3. Do a 30-second readiness check-in. Log sets including reps-in-reserve; progression uses completed sets rather than guessing. Pain/illness veto hard work.
4. For runs, with the dedicated Garmin Chrome signed in, run from this project folder: `python tools/private_export.py sync`. In **Sync & backup**, choose `%LOCALAPPDATA%/hermes/training-compass/garmin-sync.json`. After a fresh local export, click **Sync now** to re-read the linked file (when the browser supports persistent file handles), or choose the file again. You can also log a run manually.
5. **Download backup** regularly. Browser storage is local to this browser profile and Pages URL; it does not roam across devices or survive site-data clearing. Restore a backup through the same screen.

## Local development

`npm test` and `python -m unittest discover -s tests -p 'test_private_export.py' -v`. Serve via `npm run serve`, then open `http://127.0.0.1:8765/`. No npm installation or external build step. Static assets use relative URLs so they work at a project Pages path.

Generate the private starter from the saved JEFIT routine: `python tools/private_export.py seed`. Pull keeps its existing deadlift reference. No weights are copied from the inactive JEFIT lower day; choosing the Lower template requires deliberate calibration. This file is saved outside the repository. Neither JEFIT nor Garmin data is changed remotely.

## Honest sync boundary

The public static app cannot directly authenticate to Garmin Connect or continuously fetch watch data. The separate local Garmin bridge (signed-in Chrome, currently working as a read-only fallback) produces a JSON file on your computer. Choosing that file grants this page local read access; the app never uploads the contents. New device data requires watch sync → refresh local export → app **Sync now**. Sleep/readiness absent from Garmin remains absent here. Without recent runs, any prescribed quality run becomes an easy rebuilding run.

## Training rules

- Planned week: Monday Upper, Tuesday easy run, Wednesday Push, Thursday quality run, Friday Pull (deadlifts stay here), Saturday long easy run, Sunday optional Short Pump or rest. Three active gym days plus the optional fourth; a fifth gym day or an active Lower day needs your explicit plan choice. Do not cram missed days.
- Green: normal session, small load increase only after every set hits target with 2+ RIR. Amber: one less set/exercise, roughly 5% lighter, quality run turns easy. Red from pain/illness/very low readiness: no hard training. Unknown readiness: hold loads and calibrate by feel.
- Main lifts stay stable. Accessory suggestions rotate at most fortnightly, not daily randomness.
- This is a training decision aid, not a medical diagnosis. Stop and seek qualified advice for persistent or worsening pain, illness, or alarming symptoms.

## Privacy & rollback

`src/engine.mjs` contains generic exercises and **no personal weights**. `tools/private_export.py` reads local JEFIT/Garmin caches but never writes those accounts. Private JSON lives under `%LOCALAPPDATA%/hermes/training-compass/`. To roll back a browser session, restore a downloaded backup; to revert the deployed code, redeploy an earlier Git commit. Never commit private exports or Garmin tokens.
