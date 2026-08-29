#!/usr/bin/env python3
"""Generate the responsive animated PARA11AX README hero GIFs.

The README deliberately uses GIF rather than animated SVG because GitHub's image
pipeline does not reliably preserve SVG animation. Keep the composition raster-
readable: one PPI radar, a large PARA11AX wordmark, and the Kiriakou quote only.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
BRAND.mkdir(parents=True, exist_ok=True)

BG = (2, 4, 3)
GREEN = (57, 255, 20)
WHITE = (247, 255, 246)
RED = (255, 36, 56)
DARK_GREEN = (4, 32, 7)
WEDGE = (8, 70, 12)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def draw_wordmark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, *, center: bool) -> None:
    face = font(FONT_BOLD, size)
    parts = (("PARA", WHITE), ("11", GREEN), ("AX", WHITE))
    total = sum(draw.textlength(text, font=face) for text, _ in parts)
    cursor = x - total / 2 if center else x
    for text, color in parts:
        draw.text((cursor, y), text, font=face, fill=color, anchor="lm")
        cursor += draw.textlength(text, font=face)


def draw_radar(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, angle: float) -> None:
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=BG, outline=GREEN, width=2)
    for fraction in (0.25, 0.5, 0.75):
        ring = int(radius * fraction)
        draw.ellipse((cx-ring, cy-ring, cx+ring, cy+ring), outline=GREEN, width=1)
    draw.line((cx-radius, cy, cx+radius, cy), fill=GREEN, width=1)
    draw.line((cx, cy-radius, cx, cy+radius), fill=GREEN, width=1)

    for degrees in range(0, 360, 30):
        tick_angle = math.radians(degrees - 90)
        tick = 7
        draw.line((
            cx + math.cos(tick_angle) * (radius - tick),
            cy + math.sin(tick_angle) * (radius - tick),
            cx + math.cos(tick_angle) * radius,
            cy + math.sin(tick_angle) * radius,
        ), fill=GREEN, width=1)

    wedge = [(cx, cy)]
    for trail in range(-35, 1, 5):
        sweep_angle = math.radians(angle + trail)
        wedge.append((
            cx + int(math.cos(sweep_angle) * radius * 0.94),
            cy + int(math.sin(sweep_angle) * radius * 0.94),
        ))
    draw.polygon(wedge, fill=WEDGE)

    sweep_angle = math.radians(angle)
    draw.line((
        cx,
        cy,
        cx + int(math.cos(sweep_angle) * radius * 0.96),
        cy + int(math.sin(sweep_angle) * radius * 0.96),
    ), fill=WHITE, width=2)

    for dx, dy, color in ((0.42, -0.38, GREEN), (-0.50, 0.28, GREEN), (0.52, 0.32, RED), (-0.35, -0.43, RED)):
        bx = cx + int(dx * radius)
        by = cy + int(dy * radius)
        draw.ellipse((bx-3, by-3, bx+3, by+3), fill=color)
    draw.ellipse((cx-2, cy-2, cx+2, cy+2), fill=GREEN)


def sparse_matrix(draw: ImageDraw.ImageDraw, width: int, height: int, *, mobile: bool) -> None:
    face = font(FONT_MONO, 8 if mobile else 9)
    step = 50 if mobile else 65
    glyphs = "01AXPR"
    for column in range(0, width, step):
        for index, y in enumerate(range((column * 3) % 55, height, 65)):
            draw.text((column + 8, y), glyphs[(column // 10 + index) % len(glyphs)], font=face, fill=DARK_GREEN)


def make_frame(width: int, height: int, *, mobile: bool, index: int, frames: int) -> Image.Image:
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)
    sparse_matrix(draw, width, height, mobile=mobile)
    angle = -90 + index * (360 / frames)

    if mobile:
        draw_wordmark(draw, width // 2, 42, 45, center=True)
        draw.line((55, 78, width-55, 78), fill=GREEN, width=1)
        draw_radar(draw, width // 2, 225, 130, angle)
        quote = font(FONT_REG, 17)
        attribution = font(FONT_MONO_BOLD, 13)
        draw.text((45, 390), "“You’ve got to follow the evidence…", font=quote, fill=WHITE)
        draw.text((45, 419), "That doesn’t make it fact.”", font=quote, fill=WHITE)
        draw.text((45, 460), "— JOHN KIRIAKOU", font=attribution, fill=GREEN)
        draw.line((45, 486, width-45, 486), fill=GREEN, width=1)
    else:
        draw_radar(draw, 165, height // 2, 130, angle)
        draw_wordmark(draw, 360, 74, 55, center=False)
        quote = font(FONT_REG, 20)
        attribution = font(FONT_MONO_BOLD, 14)
        draw.text((363, 158), "“You’ve got to follow the evidence…", font=quote, fill=WHITE)
        draw.text((363, 191), "That doesn’t make it fact.”", font=quote, fill=WHITE)
        draw.text((363, 238), "— JOHN KIRIAKOU", font=attribution, fill=GREEN)
        draw.line((363, 270, width-55, 270), fill=GREEN, width=1)

    return image.convert("P", palette=Image.Palette.ADAPTIVE, colors=8)


def save_gif(path: Path, width: int, height: int, *, mobile: bool) -> None:
    frame_count = 6
    frames = [make_frame(width, height, mobile=mobile, index=index, frames=frame_count) for index in range(frame_count)]
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=800,
        loop=0,
        optimize=True,
        disposal=1,
    )


def main() -> None:
    save_gif(BRAND / "para11ax-readme-hero-v5.gif", 960, 347, mobile=False)
    save_gif(BRAND / "para11ax-readme-hero-mobile-v5.gif", 480, 520, mobile=True)


if __name__ == "__main__":
    main()
