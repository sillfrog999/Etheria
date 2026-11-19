# Etheria 3D assets

The runtime loads optional glTF 2.0 / GLB assets from this directory. The renderer has procedural fallbacks, so the game remains bootable before the packs are imported.

## Greenfall starter set

| Runtime path | Intended asset | Source |
| --- | --- | --- |
| `characters/player.glb` | Humanoid player base; retarget class outfits/animations later | [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) |
| `environment/tree.glb` | Stylized broadleaf / pine tree variant | [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) |
| `monsters/greenfall/creature.glb` | Greenfall forest creature; replace with a matching rigged creature from a Quaternius monster pack | [Quaternius Animated Monster Pack](https://quaternius.com/packs/animatedmonster.html) |

## License handling

The cited pack pages identify the listed packs as CC0. Quaternius also publishes a separate asset-license page, so retain the license text and the original pack page with each imported asset and follow the license attached to the exact download. Do not commit ZIP archives or redistribute source packs as standalone downloads. Only commit extracted game-ready files when the applicable license for that exact asset permits it.

## Import conventions

- Export as GLB (glTF 2.0), apply transforms, use meters, and keep the character facing +Z.
- Keep humanoid skeletons consistent; use the Universal Animation Library for compatible clips.
- Prefer 1K or smaller texture atlases for common props, and compress large textures before shipping.
- Add each imported file and its source/license record to this document.
- Keep model paths stable; the web renderer gracefully falls back to procedural meshes when a file is absent.
