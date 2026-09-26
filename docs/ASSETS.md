# Asset provenance

The curated furniture registry is preserved from the local Crew OS experiment and expanded with fourteen selected CC0 Poly Pizza Office Pack models. The selected models and their creators were checked against the experiment's per-model attribution manifest before copying; their source and author appear in the in-app Credits view. Kenney Furniture Kit and Space Kit are also CC0:

- https://kenney.nl/assets/furniture-kit
- https://kenney.nl/assets/space-kit
- https://poly.pizza/bundle/Office-Pack-UGIy7YcQP9

Supplied Jeff otter portrait and Relay portrait are copied unchanged from the experiment. Jeff and Relay have reproducible authored full-body GLBs based on their supplied references. Jeff has an otter muzzle, ears, swept tail, cream markings, navy jacket and teal tie. Relay has an auburn bob, transparent visor, tailored suit, skirt, blue circuitry and wrist console. `scripts/generate-characters.mjs` builds both assets; Three.js is a build-time dependency. Jefferson and Jev retain their existing experimental GLBs until those agents supply reviewed identities. They have neutral initials where no supplied portrait is available.

Only selected models ship in `public/assets`; the much larger unreviewed/staged packs are excluded. New avatars require reviewed application assets. Office proposals select stable catalog IDs and bounded slots; they cannot introduce arbitrary URLs, model files, shaders, or scripts.

The city uses authored white rectilinear facades, blue glazing, raised slabs, steps, planted grounds, walkways, signage and state beacons. Offices use matching structural framing, catalog-backed furniture, fixed anchors, live screens and camera-aware walls. A failed model reports its asset ID in diagnostics; all operational controls remain available.

The building model picker also uses four selected Kenney Space Kit structures staged in `public/assets/space`. Two Quaternius spaceship GLBs copied from the local `../crew-os` experiment ship as decorative campus traffic in `public/assets/vehicles`; no external asset request is needed at runtime. City asset placement uses a fixed server-validated catalog of the existing Kenney furniture and space models.

Three self-contained CC0 glTFs from the original experiment's Quaternius Cyberpunk Game Kit are curated in `source-assets/cyberpunk` and packed into `public/assets/cyberpunk/*.glb` by `scripts/curate-cyberpunk.mjs`: street lights, rooftop AC equipment and the HQ ops computer. Source: https://quaternius.com/packs/cyberpunkgamekit.html. The six HQ stations also use code-authored equipment and effects. Connected agents appear in HQ; delivered artifacts, pending approvals and acknowledged handoffs drive their respective visual cues. Motion is disabled by reduced-motion settings.
