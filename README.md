# ComfyUI-KleinRefGrid

A single-node ComfyUI custom package that turns up to **4 reference images** into a
**2×2 stitched grid** and injects it as `reference_latents` into the conditioning
stream for the **Flux Klein 9B** model.

The node ships with a built-in **image gallery UI** — no external `LoadImage`
nodes, no noodles. Click *Add Images*, drop up to 4 pictures onto the node, and
they are uploaded, thumbnailed in a 2×2 layout, persisted with the workflow,
and stitched + encoded at run time.

## Features

- **Flux Klein RefGrid** node under category `conditioning/flux_klein`.
- In-node gallery: *Add Images* button, 2×2 thumbnail layout, per-image `×`
  remove button, *Clear* button.
- Gallery state is serialised with the workflow — save, reload, share.
- Every input image is normalised to a fixed **1000×1000** tile so the
  stitched grid is always exactly **2000×2000** pixels (4 MP), regardless of
  the input resolutions.
- `strength` float input that scales the reference latent before injection.
- Outputs the modified `CONDITIONING` plus the composed `IMAGE`.
- Live preview of the stitched grid shown on the node after each run (the same
  mechanism `PreviewImage` / `KSampler` uses).

## Installation

### Via ComfyUI Manager
Search for **ComfyUI-KleinRefGrid** and install.

### Manual
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/xb1n0ry/ComfyUI-KleinRefGrid
```
Restart ComfyUI. No extra Python dependencies beyond what ComfyUI already has.

## Usage

1. Add the **Flux Klein RefGrid** node to your graph
   (`conditioning/flux_klein` category).
2. Click **Add Images** on the node and pick 1–4 reference images.
3. Wire:
   - `conditioning` ← your text / positive conditioning.
   - `vae` ← the Flux Klein VAE.
   - `strength` → 1.0 by default; lower/raise to weaken/strengthen the
     reference signal.
4. Pipe the `conditioning` output into your Flux Klein sampler stack. The
   `grid_image` output is optional and handy for previewing / saving the
   stitched reference.

## How it works

- Each uploaded image is letterbox-fit onto a **1000×1000** tile.
- Missing slots (<4 images) are filled with black.
- Tiles are stitched into a **2000×2000** grid, VAE-encoded, scaled by
  `strength`, and appended to the conditioning's `reference_latents` list.

## Requirements

- ComfyUI with Flux support.
- The Flux Klein 9B checkpoint and its matching VAE.

## License

MIT — see [LICENSE](LICENSE).
