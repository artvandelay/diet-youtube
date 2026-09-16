#!/usr/bin/env python3
"""Generate Diet-Youtube PNG icons without third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int, rgb_at) -> None:
    raw = b"".join(
        b"\x00" + bytes(ch for x in range(size) for ch in rgb_at(x, y, size))
        for y in range(size)
    )
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def icon_color(x: int, y: int, size: int) -> tuple[int, int, int]:
    # Dark plate, crimson play-D, white bite/minus — reads at 16px.
    cx, cy = (size - 1) / 2, (size - 1) / 2
    nx, ny = (x - cx) / (size / 2), (y - cy) / (size / 2)
    bg = (15, 15, 15)
    red = (255, 61, 61)
    white = (245, 245, 245)

    # rounded square background
    r = max(abs(nx), abs(ny))
    if r > 0.92:
        return bg

    # crimson disc
    dist = (nx * nx + ny * ny) ** 0.5
    if dist < 0.62:
        # D-shaped play: keep left bar + right semicircle, cut a small minus
        in_d = nx > -0.22 and (nx < -0.02 or (nx + 0.02) ** 2 + ny * ny < 0.28)
        minus = abs(ny) < 0.08 and 0.02 < nx < 0.36
        if in_d and not minus:
            return white if dist < 0.58 else lerp(red, white, 0.15)
        return red
    if dist < 0.70:
        return lerp(red, bg, (dist - 0.62) / 0.08)
    return bg


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "icons"
    out.mkdir(exist_ok=True)
    for size in (16, 48, 128):
        write_png(out / f"icon{size}.png", size, icon_color)
        print(f"wrote {out / f'icon{size}.png'}")


if __name__ == "__main__":
    main()
