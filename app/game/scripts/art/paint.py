"""Distance-field painting for baked parts: shapes are signed distances (rig units, negative inside), a layer is a
shape in one material ramp with an ink contour that swells on the shadow side, flat hard-edged tones from the one
light (docs/style.md 2, 3, 5) and ink marks clipped inside it. A part renders at `ss` x supersampling and is box-filtered
to its atlas density, so an edge ramps over one texel and nothing is resampled soft afterwards."""
import math
import numpy as np

INK = (0x0b, 0x0a, 0x0c)
# towards the light: up and a little left, for every shadow (docs/style.md 5)
LX, LY = -0.5, -0.866


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def ramp(*hs):
    """deep, shadow, base, light"""
    return [np.array(hexc(h), np.float32) / 255 for h in hs]


# ---- shapes: f(X, Y) -> signed distance

def circle(cx, cy, r):
    return lambda X, Y: np.hypot(X - cx, Y - cy) - r


def ellipse(cx, cy, rx, ry, rot=0.0):
    c, s = math.cos(rot), math.sin(rot)
    def f(X, Y):
        u, v = (X - cx) * c + (Y - cy) * s, -(X - cx) * s + (Y - cy) * c
        k = np.hypot(u / rx, v / ry)
        return (k - 1) * min(rx, ry)
    return f


def seg(ax, ay, bx, by, ra, rb=None):
    """a tapered capsule from a (radius ra) to b (radius rb)"""
    rb = ra if rb is None else rb
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    def f(X, Y):
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
        return np.hypot(X - ax - dx * t, Y - ay - dy * t) - (ra + (rb - ra) * t)
    return f


def poly(pts):
    """a closed polygon (even-odd inside)"""
    P = np.array(pts, np.float64)
    def f(X, Y):
        d = np.full(X.shape, np.inf)
        inside = np.zeros(X.shape, bool)
        for i in range(len(P)):
            (ax, ay), (bx, by) = P[i], P[i - 1]
            dx, dy = bx - ax, by - ay
            t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy or 1e-9), 0, 1)
            d = np.minimum(d, np.hypot(X - ax - dx * t, Y - ay - dy * t))
            cross = ((ay > Y) != (by > Y)) & (X < (bx - ax) * (Y - ay) / ((by - ay) or 1e-9) + ax)
            inside ^= cross
        return np.where(inside, -d, d)
    return f


def path(pts, r):
    """a stroke through points"""
    parts = [seg(*a, *b, r) for a, b in zip(pts, pts[1:])]
    return union(*parts)


def union(*fs):
    def f(X, Y):
        d = fs[0](X, Y)
        for g in fs[1:]:
            d = np.minimum(d, g(X, Y))
        return d
    return f


def cut(a, b):
    return lambda X, Y: np.maximum(a(X, Y), -b(X, Y))


def clip(a, b):
    return lambda X, Y: np.maximum(a(X, Y), b(X, Y))


def wob(f, amp, seed):
    """the hand's wobble: low-frequency, a fraction of a texel at the drawn scale"""
    p = [(math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 for i in range(6)]
    return lambda X, Y: f(X, Y) + amp * (np.sin(X * (1.3 + p[0]) + Y * (0.7 + p[1]) + p[2] * 6.28)
                                         + 0.6 * np.sin(X * (0.6 + p[3]) - Y * (1.7 + p[4]) + p[5] * 6.28))


# ---- layers

class Layer:
    def __init__(self, shape, mat, lw=0.3, shade=1.6, lit=1.1, marks=(), flat=False):
        self.shape, self.mat, self.lw, self.shade, self.lit, self.marks, self.flat = shape, mat, lw, shade, lit, marks, flat


def mark(shape, colour=INK, alpha=1.0):
    """an ink (or tone) mark inside the layer it belongs to"""
    return (shape, np.array(colour if isinstance(colour[0], float) else [c / 255 for c in colour], np.float32), alpha)


def render(layers, x0, y0, x1, y1, K, ss=4, lw_min_px=0.6):
    """Layers (back to front) over the rig rect into a straight-alpha RGBA uint8 cell at K rig units per px, its pixel
    (0, 0) at rig (ox, oy): returns (rgba, ox, oy). Rect edges are padded by a texel and aligned to the texel grid."""
    ox, oy = math.floor(x0 / K - 1) * K, math.floor(y0 / K - 1) * K
    w, h = math.ceil((x1 - ox) / K + 1), math.ceil((y1 - oy) / K + 1)
    k = K / ss
    X, Y = np.meshgrid(ox + (np.arange(w * ss) + 0.5) * k, oy + (np.arange(h * ss) + 0.5) * k)
    out = np.zeros((h * ss, w * ss, 4), np.float32)
    ink = np.array(INK, np.float32) / 255
    # a layer is painted only over the texels its shape reaches: a sample inside lies within a texel of a sample near its
    # texel's centre, and a shape's distance changes no faster than distance, so one over 1.5 texels out holds none
    Xc, Yc = X[ss // 2::ss, ss // 2::ss], Y[ss // 2::ss, ss // 2::ss]
    for L in layers:
        near = L.shape(Xc, Yc) < 1.5 * K
        if not near.any():
            continue
        rows, cols = np.nonzero(near.any(1))[0], np.nonzero(near.any(0))[0]
        box = (slice(max(rows[0] - 1, 0) * ss, min(rows[-1] + 2, h) * ss), slice(max(cols[0] - 1, 0) * ss, min(cols[-1] + 2, w) * ss))
        Xb, Yb = X[box], Y[box]
        f, (deep, shadow, base, light) = L.shape, L.mat
        d = f(Xb, Yb)
        inside = d < 0
        if not inside.any():
            continue
        lw = max(L.lw, lw_min_px * K)
        col = np.empty(Xb.shape + (3,), np.float32)
        col[:] = base
        if not L.flat:
            away = lambda s: f(Xb - LX * s, Yb - LY * s) >= 0
            col[(f(Xb + LX * L.lit, Yb + LY * L.lit) >= 0)] = light
            col[away(L.shade)] = shadow
            col[away(L.shade * 0.38)] = deep
        for shape, c, a in L.marks:
            m = (shape(Xb, Yb) < 0) & (d < -lw * 0.5)
            col[m] = col[m] * (1 - a) + c * a
        line = lw * np.where(f(Xb - LX * lw * 2.2, Yb - LY * lw * 2.2) >= 0, 1.45, 0.8)
        col[d > -line] = ink
        a = inside.astype(np.float32)[..., None]
        out[box] = np.concatenate([col * a, a], -1) + out[box] * (1 - a)
    small = out.reshape(h, ss, w, ss, 4).mean(axis=(1, 3))
    al = small[..., 3:4]
    rgb = np.where(al > 0, small[..., :3] / np.maximum(al, 1e-6), 0)
    return (np.concatenate([rgb, al], -1) * 255 + 0.5).clip(0, 255).astype(np.uint8), ox, oy


def pack(cells, width, pad=8):
    """Shelf-pack cell pictures (h x w x 4) into a page `width` wide, every offset a multiple of 8: their (x, y), the page."""
    order = sorted(range(len(cells)), key=lambda i: (-cells[i].shape[0], i))
    at, x, y, shelf = [None] * len(cells), 0, 0, 0
    for i in order:
        h, w = cells[i].shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        at[i] = (x, y)
        x += -(-(w + 1) // pad) * pad
        shelf = max(shelf, -(-(h + 1) // pad) * pad)
    page = np.zeros((y + shelf, width, 4), np.uint8)
    for (x, y), c in zip(at, cells):
        page[y:y + c.shape[0], x:x + c.shape[1]] = c
    return at, page
