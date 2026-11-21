#!/usr/bin/env python3
"""Download and import safe environment models for Etheria regions."""
from __future__ import annotations

import json
import posixpath
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "web" / "public" / "assets" / "3d" / "regions"
MANIFEST = ROOT / "apps" / "web" / "public" / "assets" / "3d" / "region-models.json"
SOURCE = "https://raw.githubusercontent.com/sillfrog999/3d-models-for-Etheria/main/"

PACKS = [
    ("aurelia", "medieval-village.zip", "medieval-village"),
    ("silverwood", "enchanted-wilds-free-forest-models-v1.0.0.zip", "enchanted-wilds"),
    ("ashen_mountains", "LowPolyMiningPack_v1.0.zip", "lowpoly-mining"),
    ("ashen_mountains", "FREE_VERSION_30_MODELS.zip", "mining-free-30"),
    ("frostmere", "winter-wonderland.zip", "winter-wonderland"),
    ("the_void", "crystal-sky-islands.zip", "crystal-sky-islands"),
]

MODEL_SUFFIXES = {".glb", ".gltf"}
DEPENDENCY_SUFFIXES = {".bin", ".png", ".jpg", ".jpeg", ".webp", ".ktx2"}
BLOCKED = re.compile(
    r"(weapon|sword|bow|arrow|crossbow|gun|rifle|pistol|dagger|knife|spear|"
    r"shield|catapult|archery|dynamite|tnt|pickaxe|shovel|sledgehammer|"
    r"explosive|ammo|bullet|grenade)",
    re.IGNORECASE,
)
BUILDING = re.compile(
    r"(house|tavern|windmill|gate|wall|chapel|townhouse|stable|mill|stall|"
    r"cottage|tower|castle|bridge|fountain|workshop|village|hut)",
    re.IGNORECASE,
)
VEGETATION = re.compile(
    r"(tree|bush|fern|plant|flower|mushroom|shrub|grass|canopy|log)",
    re.IGNORECASE,
)
ROCK = re.compile(
    r"(rock|boulder|ore|crystal|stone|stalag|stalactite|gem|coal)",
    re.IGNORECASE,
)


def safe_member(name: str) -> str | None:
    name = name.replace("\\", "/")
    normalized = posixpath.normpath(name).lstrip("/")
    if normalized in {"", "."} or normalized.startswith("../") or "/../" in normalized:
        return None
    return normalized


def category_for(name: str, region: str) -> str:
    if region == "emberlands":
        return "landscape"
    if BUILDING.search(name):
        return "building"
    if VEGETATION.search(name):
        return "vegetation"
    if ROCK.search(name):
        return "rock"
    return "prop"


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Etheria-Asset-Importer"})
    with urllib.request.urlopen(request, timeout=90) as response:
        destination.write_bytes(response.read())


def extract_pack(region: str, archive_name: str, pack_id: str, temp_dir: Path) -> list[dict]:
    archive_path = temp_dir / archive_name
    download(SOURCE + archive_name, archive_path)
    entries: list[dict] = []

    with zipfile.ZipFile(archive_path) as archive:
        members = {}
        for info in archive.infolist():
            normalized = safe_member(info.filename)
            if normalized and not info.is_dir():
                members[normalized] = info

        model_paths = sorted(
            name for name in members
            if PurePosixPath(name).suffix.lower() in MODEL_SUFFIXES
            and not BLOCKED.search(name)
        )

        for model_path in model_paths:
            required = {model_path}
            if PurePosixPath(model_path).suffix.lower() == ".gltf":
                try:
                    gltf = json.loads(archive.read(members[model_path]))
                except Exception:
                    print(f"Skipping unreadable glTF: {archive_name}:{model_path}")
                    continue

                missing_dependency = False
                for section in ("buffers", "images"):
                    for item in gltf.get(section, []):
                        uri = item.get("uri", "")
                        if not uri or uri.startswith("data:") or "://" in uri:
                            continue
                        dependency = safe_member(posixpath.join(posixpath.dirname(model_path), uri))
                        if not dependency or dependency not in members:
                            missing_dependency = True
                            break
                        required.add(dependency)
                    if missing_dependency:
                        break
                if missing_dependency:
                    print(f"Skipping glTF with missing dependencies: {archive_name}:{model_path}")
                    continue

            for member in sorted(required):
                suffix = PurePosixPath(member).suffix.lower()
                if member != model_path and suffix not in DEPENDENCY_SUFFIXES:
                    continue
                target = OUT / region / pack_id / Path(*PurePosixPath(member).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(members[member]))

            relative = (Path(region) / pack_id / Path(*PurePosixPath(model_path).parts)).as_posix()
            entries.append({
                "region": region,
                "name": PurePosixPath(model_path).stem,
                "category": category_for(model_path, region),
                "url": f"/assets/3d/regions/{relative}",
                "sourcePack": archive_name,
            })

    print(f"{archive_name}: imported {len(entries)} models into {region}")
    return entries


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    import tempfile
    all_assets: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="etheria-models-") as temporary:
        temp_dir = Path(temporary)
        for region, archive_name, pack_id in PACKS:
            all_assets.extend(extract_pack(region, archive_name, pack_id, temp_dir))

        emberlands_path = temp_dir / "Emberlands.glb"
        download(SOURCE + "Emberlands.glb", emberlands_path)
        target = OUT / "emberlands" / "emberlands" / "Emberlands.glb"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(emberlands_path, target)
        all_assets.append({
            "region": "emberlands",
            "name": "Emberlands",
            "category": "landscape",
            "url": "/assets/3d/regions/emberlands/emberlands/Emberlands.glb",
            "sourcePack": "Emberlands.glb",
        })

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(all_assets, indent=2), encoding="utf-8")
    print(f"Generated {MANIFEST} with {len(all_assets)} model entries")


if __name__ == "__main__":
    main()
