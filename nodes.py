import json
import os

import numpy as np
import torch
from PIL import Image, ImageOps

import folder_paths
import node_helpers


GRID_SIDE = 2000
TILE_SIDE = GRID_SIDE // 2


def _resolve_base_dir(type_: str) -> str:
    if type_ == "temp":
        return folder_paths.get_temp_directory()
    if type_ == "output":
        return folder_paths.get_output_directory()
    return folder_paths.get_input_directory()


def _load_pil(entry) -> Image.Image:
    if isinstance(entry, str):
        name, subfolder, type_ = entry, "", "input"
    else:
        name = entry["name"]
        subfolder = entry.get("subfolder", "") or ""
        type_ = entry.get("type", "input") or "input"

    base = _resolve_base_dir(type_)
    path = os.path.join(base, subfolder, name) if subfolder else os.path.join(base, name)
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def _fit_to_square(img: Image.Image, side: int) -> Image.Image:
    """Resize preserving aspect ratio, letterbox onto a `side`x`side` canvas."""
    w, h = img.size
    if w <= 0 or h <= 0:
        raise ValueError("Image has invalid dimensions")

    scale = min(side / w, side / h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (side, side), (0, 0, 0))
    canvas.paste(resized, ((side - new_w) // 2, (side - new_h) // 2))
    return canvas


def _make_grid(tiles: list[Image.Image]) -> Image.Image:
    if not tiles:
        raise ValueError("No images supplied")

    padded = list(tiles)
    while len(padded) < 4:
        padded.append(Image.new("RGB", (TILE_SIDE, TILE_SIDE), (0, 0, 0)))

    grid = Image.new("RGB", (GRID_SIDE, GRID_SIDE), (0, 0, 0))
    grid.paste(padded[0], (0, 0))
    grid.paste(padded[1], (TILE_SIDE, 0))
    grid.paste(padded[2], (0, TILE_SIDE))
    grid.paste(padded[3], (TILE_SIDE, TILE_SIDE))
    return grid


def _pil_to_tensor(img: Image.Image) -> torch.Tensor:
    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr).unsqueeze(0)


class FluxKleinRefGrid:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "conditioning": ("CONDITIONING",),
                "vae": ("VAE",),
                "strength": (
                    "FLOAT",
                    {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01},
                ),
                "image_list": (
                    "STRING",
                    {"default": "[]", "multiline": False},
                ),
            },
        }

    RETURN_TYPES = ("CONDITIONING", "IMAGE")
    RETURN_NAMES = ("conditioning", "grid_image")
    FUNCTION = "apply"
    CATEGORY = "conditioning/flux_klein"
    OUTPUT_NODE = True

    def apply(self, conditioning, vae, strength, image_list):
        try:
            entries = json.loads(image_list) if image_list else []
        except json.JSONDecodeError:
            entries = []

        if not isinstance(entries, list) or len(entries) == 0:
            raise ValueError(
                "Flux Klein RefGrid: add at least one image via the node's gallery before running."
            )

        entries = entries[:4]
        tiles = [_fit_to_square(_load_pil(e), TILE_SIDE) for e in entries]
        grid = _make_grid(tiles)

        grid_tensor = _pil_to_tensor(grid)
        latent = vae.encode(grid_tensor[:, :, :, :3])
        scaled = latent * float(strength)

        cond = node_helpers.conditioning_set_values(
            conditioning,
            {"reference_latents": [scaled]},
            append=True,
        )

        preview_dir = folder_paths.get_temp_directory()
        (
            full_output_folder,
            filename,
            counter,
            subfolder,
            _,
        ) = folder_paths.get_save_image_path(
            "klein_refgrid", preview_dir, grid.width, grid.height
        )
        preview_name = f"{filename}_{counter:05}_.png"
        grid.save(os.path.join(full_output_folder, preview_name), compress_level=4)

        return {
            "ui": {
                "images": [
                    {
                        "filename": preview_name,
                        "subfolder": subfolder,
                        "type": "temp",
                    }
                ]
            },
            "result": (cond, grid_tensor),
        }


NODE_CLASS_MAPPINGS = {
    "FluxKleinRefGrid": FluxKleinRefGrid,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FluxKleinRefGrid": "Flux Klein RefGrid",
}
