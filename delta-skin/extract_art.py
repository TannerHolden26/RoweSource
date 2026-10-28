"""Cut the sticker artwork out of photos of a Pikachu edition Game Boy Color.

Produces transparent PNGs in delta-skin/art/ that build.js places on the skin:
  pikachu-wave.png  - waving Pikachu between the D-pad and buttons
  pikachu-run.png   - Pikachu on the bottom-left of the screen bezel
  starters.png      - Cyndaquil, Totodile and Chikorita on the right of the bezel

Usage:
  python3 delta-skin/extract_art.py WAVE_PHOTO RUN_PHOTO STARTERS_PHOTO

Each photo is cropped to the sticker, then the background (orange shell or grey
bezel) is flood-filled away from the crop's edges, leaving only the sticker.
"""

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).parent / "art"

# Crop boxes (left, top, right, bottom) in each photo's pixels.
WAVE_BOX = (120, 980, 1040, 1980)
RUN_BOX = (200, 1240, 1160, 2078)  # bottom stops at the bezel edge
STARTERS_BOX = (60, 20, 250, 610)


def flood_from_edges(bg):
    """Background pixels connected to the image border."""
    h, w = bg.shape
    seen = np.zeros_like(bg)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def components(mask):
    """Label 4-connected components; returns (labels, sizes)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        n = len(sizes)
        labels[sy, sx] = n
        q = deque([(sy, sx)])
        count = 0
        while q:
            y, x = q.popleft()
            count += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = n
                    q.append((ny, nx))
        sizes.append(count)
    return labels, np.array(sizes)


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:, :] |= out[:-1, :]
        m[:-1, :] |= out[1:, :]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def cut_out(img, is_bg, is_pocket=None, outside=None, outline_px=0, pocket_min=0.002, scale=1.0, out_width=None):
    rgb = np.asarray(img.convert("RGB")).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    bg = is_bg(r, g, b)
    if outside is not None:
        bg |= outside

    fg = ~flood_from_edges(bg)

    # Keep the sticker itself, dropping stray specks and shadows.
    labels, sizes = components(fg)
    sizes[0] = 0
    keep = sizes >= sizes.max() * 0.03
    fg = keep[labels]

    # Clear larger pockets of background enclosed by the artwork (e.g. between an arm and the body).
    if is_pocket is not None:
        pockets = is_pocket(r, g, b) & fg
        labels, sizes = components(pockets)
        sizes[0] = 0
        big = sizes >= pocket_min * fg.size
        fg &= ~big[labels]
    if outside is not None:
        fg &= ~outside

    if outline_px:
        fg = dilate(fg, outline_px)

    # Trim to the artwork and build a smooth alpha edge.
    ys, xs = np.nonzero(fg)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    art = img.convert("RGB").crop(box)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).crop(box)

    target_w = out_width or round(art.width * scale)
    target_h = round(art.height * target_w / art.width)
    art = art.resize((target_w, target_h), Image.LANCZOS)
    if target_w > box[2] - box[0]:
        art = art.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2))
    alpha = alpha.resize((target_w, target_h), Image.BILINEAR)
    alpha = alpha.point(lambda v: 255 if v >= 128 else 0)
    alpha = alpha.filter(ImageFilter.GaussianBlur(max(0.6, target_w / 600)))

    art.putalpha(alpha)
    return art


def main(wave_path, run_path, starters_path):
    OUT.mkdir(exist_ok=True)

    # Waving Pikachu on the orange shell: background is anything orange that isn't dark outline or yellow.
    wave = Image.open(wave_path).crop(WAVE_BOX)
    lum = lambda r, g, b: 0.299 * r + 0.587 * g + 0.114 * b
    cut_out(
        wave,
        lambda r, g, b: (lum(r, g, b) >= 80) & (g < 165),
        out_width=600,
    ).save(OUT / "pikachu-wave.png")

    # Running Pikachu on the grey bezel, cut off by the orange shell on the left and bottom.
    run = Image.open(run_path).crop(RUN_BOX)
    spread = lambda r, g, b: np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    cut_out(
        run,
        lambda r, g, b: (spread(r, g, b) < 22)
        | ((r > 170) & (b < 90) & (g > 95) & (g < 200) & (r - g > 40)),
        out_width=600,
    ).save(OUT / "pikachu-run.png")

    # Starters: a small photo with faint outlines, so grow the cut-out by a pixel to keep them.
    # The photo is taken at a slight angle, so shear it to make the shell edge vertical,
    # then treat everything past the shell edge (right) and bezel edge (bottom) as background.
    starters = Image.open(starters_path).crop(STARTERS_BOX)
    starters = starters.transform(starters.size, Image.AFFINE, (1, 0.0274, 0, 0, 1, 0), Image.BICUBIC)
    h, w = starters.height, starters.width
    yy, xx = np.mgrid[0:h, 0:w]
    outside = (xx >= 124) | (yy >= 547)
    bezel_grey = lambda r, g, b: (spread(r, g, b) < 16) & (lum(r, g, b) > 40) & (lum(r, g, b) < 120)
    cut_out(
        starters,
        bezel_grey,
        is_pocket=bezel_grey,
        outside=outside,
        outline_px=1,
        scale=4,
    ).save(OUT / "starters.png")
    print(f"Wrote art to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
