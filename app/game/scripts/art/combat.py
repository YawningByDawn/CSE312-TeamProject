"""The overhaul's fight, baked into the people pipeline (docs/art-pipeline.md: people/, poses/, life/).

python scripts/art/combat.py [root]   (Python 3 with Pillow and NumPy; deterministic: run twice, the same bytes)

- swing: the host's pick swing on click, a pose series per facing the walk has (h, u, d), in every role
  (assets/poses/poses.json `swing:<dir>`); the rig (src/view/life/rig.ts) plays it with the look's own parts.
- the skeleton: one of the mine's dead as a look of its own (people.json `s01`, role `skeleton`, its parts in
  assets/people/s01.hi.webp and its low detail on assets/poses/lo-4.webp), walking, swinging its old pick and
  falling apart under the people's clip names (`idle`, `walk:own:<dir>`, `swing:<dir>`, `collapse`). Every part has its
  outline `o:<part>` beside it: the part's silhouette grown by `OUTLINE` in dark blood red, drawn behind the whole figure (rig.ts).
- hit: a struck body's flash and chips, frames `hit-0..` of the life atlas (assets/life), white for the game to tint.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parents[2]

# rig.ts pose channels, one baked step each
CH = 'HX HY LEAN NOD LOOK FNX FNY FFX FFY HNX HNY HFX HFY PROP ROT OX OY ARC GRIP2 SQUASH ELB FIN DROOP FLICK WICK'.split()
STEP = len(CH)


def write_json(path, data):
    path.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')


def keyed(keys, n, dur, loop):
    """A series from keyframes [(time 0..1, {channel: value})]: every channel eased (cosine) between the keys that set it."""
    base = keys[0][1]
    f = []
    for i in range(n):
        u = i / n if loop else i / (n - 1)
        for c in CH:
            pts = [(t, k[c]) for t, k in keys if c in k] or [(0, base.get(c, 0))]
            if loop and pts[-1][0] < 1:
                pts.append((1, pts[0][1]))
            v = pts[-1][1]
            for (t0, a), (t1, b) in zip(pts, pts[1:]):
                if t0 <= u <= t1:
                    e = 0 if t1 == t0 else (u - t0) / (t1 - t0)
                    v = a + (b - a) * (0.5 - 0.5 * math.cos(math.pi * e))
                    break
            f.append(round(v, 3))
    return f


# The swing: ready, wound up over the shoulder, the blow through what stands in front, the follow-through, back to ready.
# The blow lands at `IMPACT` of the clip (its `im`, where the rig bursts the look's impact chips).
SWING_DUR, SWING_N, IMPACT = 0.62, 16, 0.42
READY = dict(HX=0.4, HY=-17.6, LEAN=0.3, NOD=0.25, LOOK=1, FNX=6.2, FNY=0, FFX=-5.6, FFY=0, HNX=6.8, HNY=-19.5, HFX=-1.2,
             HFY=-18, PROP=-0.55, ROT=0, OX=0, OY=0, ARC=0.3, GRIP2=4.5, SQUASH=1, ELB=0.1, FIN=0.1, DROOP=0, FLICK=0, WICK=1.1)
# per facing: the turn of the body, the feet in depth, where the blow ends (hand, pick angle)
FACING = {
    'h': dict(look=1.0, fny=0.0, ffy=0.0, hit=(11.2, -20.5, 0.1), thru=(10.2, -15.5, 0.75)),
    'd': dict(look=0.55, fny=2.4, ffy=-1.6, hit=(9.0, -16.0, 0.55), thru=(8.0, -12.5, 1.05)),
    'u': dict(look=1.0, fny=-2.6, ffy=1.4, hit=(10.6, -24.5, -0.35), thru=(10.4, -20.5, 0.2)),
}


def swing(face):
    F = FACING[face]
    ready = dict(READY, LOOK=F['look'], FNY=F['fny'], FFY=F['ffy'])
    (hx, hy, hp), (tx, ty, tp) = F['hit'], F['thru']
    keys = [
        (0.0, ready),
        (0.34, dict(HX=-1.7, HY=-19.4, LEAN=-0.32, NOD=-0.22, HNX=-1.9, HNY=-38.5, PROP=-2.35, ELB=0.42, GRIP2=4.2, FIN=-0.5, SQUASH=1.0)),
        (IMPACT, dict(HX=1.5, HY=-16.6, LEAN=0.62, NOD=0.38, HNX=hx, HNY=hy, PROP=hp, ELB=0.0, GRIP2=4.6, FNX=8.2, FIN=-0.5, SQUASH=0.96, WICK=1.4)),
        (0.56, dict(HX=1.3, HY=-16.0, LEAN=0.66, NOD=0.4, HNX=tx, HNY=ty, PROP=tp, ELB=0.0, FNX=8.2, FIN=-0.2, SQUASH=0.97, WICK=1.2)),
        (0.84, dict(FNX=6.2, FIN=0.1, SQUASH=1.0, WICK=1.1)),
    ]
    return {'dur': SWING_DUR, 'loop': True, 'gait': 0, 'n': SWING_N, 'f': keyed(keys, SWING_N, SWING_DUR, True), 'h': [0],
            'im': [round(IMPACT * SWING_DUR, 3)]}


def put_series(poses, roles, name, s):
    """Series `s` under `name` in each of `roles`: in the slot the name already has, else a new one."""
    ix = next((r[name] for r in (poses['roles'].get(x, {}) for x in roles) if name in r), None)
    if ix is None:
        ix = len(poses['series'])
        poses['series'].append(s)
    else:
        poses['series'][ix] = s
    for x in roles:
        poses['roles'].setdefault(x, {})[name] = ix
    return ix


def shamble(s, face):
    """The dead's walk from a digger's (pick on the shoulder): stooped, the head lolling, one leg dragged."""
    f, n = list(s['f']), s['n']
    for i in range(n):
        u, o = i / n, i * STEP
        ph = 2 * math.pi * u
        f[o + CH.index('LEAN')] = round(f[o + CH.index('LEAN')] + 0.2 + 0.05 * math.sin(2 * ph), 3)
        f[o + CH.index('NOD')] = round(0.28 + 0.14 * math.sin(2 * ph + 1.1), 3)
        f[o + CH.index('HY')] = round(f[o + CH.index('HY')] + 0.9 + 0.5 * max(0.0, math.sin(ph)), 3)
        f[o + CH.index('HX')] = round(f[o + CH.index('HX')] - 0.5, 3)
        far = CH.index('FFY')
        f[o + far] = round(f[o + far] * 0.45 + (0.4 if face == 'h' else 0), 3)
    return dict(s, f=f)


def skeleton_series(poses):
    digger = poses['roles']['digger']
    walk = {face: shamble(poses['series'][digger[f'walk:own:{face}']], face) for face in 'hud'}
    idle = {'dur': 2.6, 'loop': True, 'gait': 0, 'n': 24, 'h': [0], 'f': keyed([
        (0.0, dict(READY, HX=0.2, HY=-16.9, LEAN=0.24, NOD=0.3, HNX=5.2, HNY=-15.5, PROP=1.25, ELB=0.0, GRIP2=4.4, FIN=-0.6, WICK=0)),
        (0.3, dict(HX=0.5, NOD=0.14, LEAN=0.2)),
        (0.36, dict(NOD=0.55)),
        (0.62, dict(HX=-0.1, NOD=0.28, LEAN=0.3, HY=-17.2)),
    ], 24, 2.6, True)}
    attack = {}
    for face in 'hud':
        s = swing(face)
        s.update(dur=0.95, im=[round(IMPACT * 0.95, 3)])
        attack[face] = s
    # the people's fall, quicker
    die = dict(poses['series'][digger['collapse']], dur=1.6)
    return idle, walk, attack, die


# ---- the skeleton's parts (rig frames as people.json's: a limb along +x for its rest length, the torso up from the hip,
# the head round its centre, a prop from the hand at its angle bin)

from paint import Layer, circle, clip, cut, ellipse, mark, pack, path, poly, ramp, render, seg, union, wob  # noqa: E402

BONE = ramp('#5e4d37', '#846a49', '#b9a77f', '#d6caa6')
BONE_FAR = ramp('#3a2d1f', '#5e4d37', '#846a49', '#b9a77f')
HORN = ramp('#3a2d1f', '#5e4d37', '#846a49', '#af926f')
RAG = ramp('#1a1a19', '#3a2d1f', '#5e4d37', '#846a49')
IRON = ramp('#1a1a19', '#252523', '#3c3a36', '#575855')
WOOD = ramp('#1a1a19', '#3a2d1f', '#5e4d37', '#846a49')
CHAR = ramp('#1a1a19', '#1a1a19', '#252523', '#3c3a36')
RUST = (0x84, 0x6a, 0x49)
DUSK = (0x5e, 0x4d, 0x37)
REST = {'thigh': 5.54, 'shin': 5.18, 'upper': 4.73, 'fore': 4.79, 'torso': 13.65}
TB = math.pi / 16
K = {'lo': 0.625, 'hi': 0.218772}
# an enemy's red hairline: half a css px at the mine's play zoom (1.9 per rig unit), a dark desaturated blood red
OUTLINE, HARM = 0.25, (0x66, 0x2a, 0x25)


def bone_limb(L, r, knob0, knob1, mat, twin=False, seed=0):
    layers = []
    if twin:
        layers.append(Layer(seg(0.4, 0.45, L - 0.6, 0.4, r * 0.45), mat, shade=0.4, lit=0.25))
    shaft = union(seg(0, 0, L, 0, r, r * 0.9), circle(0, 0, knob0), ellipse(L, 0.05, knob1 * 1.1, knob1 * 0.9))
    layers.append(Layer(wob(shaft, 0.04, seed), mat, shade=max(0.5, r * 0.9), lit=r * 0.8,
                        marks=[mark(seg(L * 0.35, -r * 0.2, L * 0.55, r * 0.15, 0.08)), mark(circle(L, 0.05, knob1 * 0.28), DUSK, 0.8)]))
    return layers


def skull(tq):
    a = tq * TB
    sa, ca, R = math.sin(a), math.cos(a), 6.3
    layers = []
    for s in (1, -1):
        dx, dy = s * ca - 0.8 * sa, -0.4
        nrm = math.hypot(dx, dy)
        dx, dy = dx / nrm, dy / nrm
        rx = s * R * 0.82 * ca - R * 0.35 * sa
        spines = [seg(rx, -0.6, rx + (dx * math.cos(t) - dy * math.sin(t)) * l, -0.6 + (dx * math.sin(t) + dy * math.cos(t)) * l, 0.5, 0.24)
                  for t, l in ((-0.55, 3.9), (-0.12, 3.3), (0.32, 2.5))]
        layers.append(Layer(union(*spines), BONE_FAR if s * sa > 0.3 else BONE, lw=0.2, shade=0.35, lit=0.25))
    jx = R * 0.5 * sa
    head = union(circle(0, -0.9, R), ellipse(jx, 4.5, 2.5 + 1.2 * ca, 1.9), ellipse(R * 0.66 * sa, 2.0, 2.3 + 0.6 * ca, 2.5))
    marks = []
    for e in (-0.5, 0.5):
        if math.cos(a + e) > -0.1:
            fx = max(0.3, math.cos(a + e))
            marks.append(mark(ellipse(R * 0.78 * math.sin(a + e), 0.4, 1.45 * fx, 1.75, 0.15 * e)))
    nx = R * 0.9 * sa
    marks += [
        mark(poly([(nx - 0.75 * max(0.4, ca), 2.2), (nx + 0.75 * max(0.4, ca), 2.2), (nx + 0.2 * sa, 3.5)])),
        mark(path([(jx - 1.9 - 0.8 * ca, 4.5), (jx + 2.2 + 0.6 * sa, 4.7)], 0.2)),
        *[mark(seg(jx + x, 3.6, jx + x, 5.6, 0.12)) for x in (-1.5, -0.6, 0.3, 1.2, 2.1) if abs(x - 0.6 * sa) < 2.6],
        mark(path([(-2.6 - sa, -6.2), (-1.7 - sa, -4.6), (-2.4 - sa, -3.5), (-1.5 - sa, -2.2)], 0.12)),
        mark(ellipse(-1.8 * sa + 1.2, -3.4, 1.6, 0.9), DUSK, 0.5),
    ]
    layers.append(Layer(wob(head, 0.06, tq), BONE, shade=1.9, lit=1.7, marks=marks))
    return layers


def cap(tq):
    a = tq * TB
    sa = math.sin(a)
    cx = 0.7 * sa
    brim = cut(ellipse(cx, -4.5, 6.8, 2.2), poly([(cx - 7.2, -5.2), (cx - 5.1, -3.0), (cx - 7.2, -2.2)]))
    dome = clip(ellipse(cx + 0.2, -5.0, 5.0, 3.7), lambda X, Y: Y + 4.6)
    stump = seg(cx + 0.5, -8.0, cx + 0.9, -9.6, 0.65, 0.42)
    return [Layer(wob(union(brim, dome), 0.05, tq + 9), HORN, shade=1.0, lit=1.2,
                  marks=[mark(path([(cx + 2.6, -8.4), (cx + 1.8, -6.6), (cx + 2.5, -5.4)], 0.12)),
                         mark(path([(cx - 6.8, -4.2), (cx + 6.6, -4.4)], 0.1), DUSK, 0.9),
                         mark(ellipse(cx - 2.6, -6.7, 0.9, 0.5), DUSK, 0.7)]),
            Layer(stump, CHAR, shade=0.3, lit=0.25, marks=[mark(circle(cx + 0.9, -9.6, 0.3), (0x57, 0x58, 0x55), 0.9)])]


def torso(tb):
    a = tb * TB
    sa, ca = math.sin(a), math.cos(a)
    T, wk = REST['torso'], 0.72 + 0.28 * abs(ca)
    rcx, rx, ry, rcy = 0.9 * sa, 4.5 * wk, 4.5, -8.7
    sx = -2.0 * sa
    spine = Layer(seg(sx, -1.2, sx * 1.1, -T + 0.4, 0.95, 0.75), BONE, shade=0.5, lit=0.4,
                  marks=[mark(seg(sx - 0.8, -2 - i * 1.15, sx + 0.8, -2 - i * 1.15, 0.09)) for i in range(10)])
    cage = ellipse(rcx, rcy, rx, ry)
    inner = lambda X, Y: cage(X, Y) + 0.75
    ribs = []
    for i in range(4):
        yi = -11.4 + i * 1.75
        ribs.append(mark(clip(lambda X, Y, yi=yi: np.abs(Y - (yi + 0.07 * (X - rcx) ** 2 + 0.28 * (X - rcx) * sa)) - 0.33, inner)))
    ribcage = Layer(wob(cage, 0.05, tb), BONE, shade=1.5, lit=1.3, marks=ribs)
    pel = union(ellipse(0.3 * sa, -0.9, 3.8 * wk, 1.8), ellipse(0.3 * sa - 2.2 * wk, -1.7, 1.5, 1.5), ellipse(0.3 * sa + 2.2 * wk, -1.7, 1.5, 1.5))
    pmarks = [mark(ellipse(0.3 * sa + s * 1.3 * ca, -0.5, 0.55 * max(0.3, ca), 0.6)) for s in (-1, 1)] if ca > 0.3 else []
    pelvis = Layer(wob(pel, 0.05, tb + 3), BONE, shade=0.9, lit=0.8, marks=pmarks)
    clav = Layer(union(seg(rcx - rx * 0.8, -T + 1.6, rcx - 0.3, -T + 0.8, 0.62), seg(rcx + 0.3, -T + 0.8, rcx + rx * 0.8, -T + 1.5, 0.62)), BONE, shade=0.4, lit=0.35)
    front = [spine, pelvis, ribcage, clav] if ca >= 0 else [ribcage, pelvis, spine, clav]
    if ca > -0.3:
        front.insert(3, Layer(seg(rcx + rx * 0.85 * sa, -T + 1.4, rcx + rx * 0.85 * sa, -6.8, 0.62, 0.5), BONE, shade=0.4, lit=0.4))
    if ca < 0:
        front.insert(1, Layer(union(*[ellipse(rcx + s * 2.3 * abs(ca), -10.6, 1.7, 2.3, s * 0.2) for s in (-1, 1)]), BONE, shade=0.8, lit=0.6))
    # what is left of the miner's tunic: a strap over the shoulder and a torn skirt with the pelvis through its holes
    hw = 4.2 * wk
    rag = cut(poly([(-hw, -2.9), (hw * 0.2, -2.7), (hw * 0.5, -1.2), (hw * 0.15, 0.6), (-0.6, 2.4), (-1.3, 0.9), (-2.1, 2.9),
                    (-2.8, 1.2), (-hw + 0.3, 2.2), (-hw - 0.3, 0.2)]),
              circle(-1.6 + 0.6 * sa, -0.6, 0.75))
    strap = seg(rcx - rx * 0.6, -T + 0.9, rcx + rx * 0.55, -3.2, 0.5)
    belt = seg(-hw - 0.1, -2.7, hw + 0.1, -2.5, 0.55)
    front += [Layer(wob(union(rag, strap), 0.07, tb + 5), RAG, shade=1.0, lit=0.7,
                    marks=[mark(path([(-hw + 1.2, -1.6), (-hw + 1.6, 0.8)], 0.1)), mark(path([(1.6, -1.5), (1.9, 0.6)], 0.1))]),
              Layer(belt, WOOD, shade=0.35, lit=0.3, marks=[mark(ellipse(0.9 * sa + 0.6, -2.6, 0.55, 0.45), (0x84, 0x6a, 0x49))])]
    return front


def foot(b):
    p = max(0.35, abs(math.sin(b * TB)))
    toes = union(*[seg(1.6 * p, y * 0.4, 3.9 * p, 0.25 + y * 0.55, 0.3, 0.22) for y in (-0.6, 0, 0.6)])
    return [Layer(wob(union(circle(0.1, 0, 0.8), ellipse(1.1 * p + 0.2, -0.05, 1.3 * p + 0.3, 0.7), toes), 0.03, b), BONE, shade=0.5, lit=0.4)]


def pick(b):
    t = 2 * math.pi * b / 48
    ux, uy, px, py = math.cos(t), math.sin(t), -math.sin(t), math.cos(t)
    P = lambda a, q: (ux * a + px * q, uy * a + py * q)
    handle = seg(*P(-3.8, 0), *P(15.0, 0), 0.62, 0.72)
    wrap = seg(*P(-0.6, 0), *P(1.8, 0), 0.8)
    # the head a crescent bent back towards the hand: its blade (the +90 side, where the rig bursts the impact) whole,
    # the other arm snapped off short
    arc = lambda q: P(15.7 - 2.3 * q * q, 6.0 * q)
    qs = [-0.42 + i * (1.42 / 10) for i in range(11)]
    rad = lambda q: 1.05 - 0.7 * max(0.0, q) ** 1.3
    head = union(*[seg(*arc(q0), *arc(q1), rad(q0), rad(q1)) for q0, q1 in zip(qs, qs[1:])])
    stub = poly([arc(-0.42), P(15.4, -3.4), P(14.7, -2.9), P(14.9, -2.3), P(14.3, -2.0)])
    eye = ellipse(*P(15.6, 0), 1.25, 1.25)
    return [Layer(wob(handle, 0.03, b), WOOD, shade=0.4, lit=0.35,
                  marks=[mark(seg(*P(3, -0.12), *P(8, 0.05), 0.07)), mark(seg(*P(10, 0.1), *P(13, -0.05), 0.07)),
                         mark(seg(*P(-3.6, -0.1), *P(-2.0, 0.2), 0.08))]),
            Layer(wrap, RAG, shade=0.4, lit=0.3, marks=[mark(seg(*P(x, -0.7), *P(x + 0.4, 0.7), 0.08)) for x in (-0.2, 0.5, 1.2)]),
            Layer(wob(union(head, stub, eye), 0.03, b + 1), IRON, shade=0.7, lit=0.6,
                  marks=[mark(circle(*arc(0.35), 0.5), RUST, 0.9), mark(circle(*arc(0.7), 0.32), RUST, 0.8), mark(circle(*arc(-0.25), 0.45), RUST, 0.85),
                         mark(seg(*arc(0.5), *P(15.0, 4.6), 0.12), DUSK, 0.9), mark(circle(*P(15.6, 0), 0.38), (0x57, 0x58, 0x55))])]


def skeleton_parts():
    """name -> [(bins, layers)]"""
    R = REST
    parts = {}
    for s, far in (('f', True), ('n', False)):
        m = BONE_FAR if far else BONE
        parts['thi' + s] = [((), bone_limb(R['thigh'], 0.85, 1.25, 1.15, m, seed=1))]
        parts['shi' + s] = [((), bone_limb(R['shin'], 0.78, 1.1, 0.9, m, seed=2))]
        parts['bd' + s] = [((), [Layer(ellipse(0.7, -0.15, 0.9, 0.7), m, shade=0.4, lit=0.35)])]
        parts['ft' + s] = [((b,), [Layer(L.shape, m, shade=L.shade, lit=L.lit) for L in foot(b)]) for b in range(1, 17)]
        parts['uai' + s] = [((), bone_limb(R['upper'], 0.72, 1.0, 0.85, m, seed=3))]
        parts['fai' + s] = [((), bone_limb(R['fore'], 0.64, 0.85, 0.75, m, seed=4))]
        parts[f'hd{s}0'] = [((), [Layer(union(ellipse(0.8, 0, 1.0, 0.8), *[seg(1.2, y * 0.35, 3.0, y * 0.85, 0.34, 0.26) for y in (-1, 0, 1)],
                                             seg(0.9, 0.5, 1.8, 1.3, 0.22)), m, shade=0.35, lit=0.3)])]
        parts[f'hd{s}1'] = [((), [Layer(union(circle(0.9, 0, 1.15), circle(1.6, 0.55, 0.7)), m, shade=0.45, lit=0.4,
                                        marks=[mark(seg(1.4, -0.6, 1.5, 0.3, 0.07))])])]
    parts['tr'] = [((0, tb, 0), torso(tb)) for tb in range(8)] + [((1, tb, 0), torso(tb)) for tb in range(7, 16)]
    parts['hu'] = [((0, 0, tq, 4), skull(tq)) for tq in range(8)]
    parts['hk'] = [((tq,), cap(tq)) for tq in range(8)]
    parts['gp:n'] = [((), [Layer(union(*[circle(x, 0, 0.5) for x in (-0.95, 0, 0.95)]), BONE, shade=0.35, lit=0.3)])]
    parts['pn:pick:n'] = [((b,), pick(b)) for b in range(48)]
    return parts


def rim(layers):
    """a part's outline: the union of its layers grown by OUTLINE (rendered, then the whole picture set to HARM)"""
    d = union(*[L.shape for L in layers])
    return [Layer(lambda X, Y: d(X, Y) - OUTLINE, IRON, flat=True)]


def bounds(layers):
    """the rig rect a part's layers cover, found on a coarse grid"""
    g = np.linspace(-30, 30, 601)
    X, Y = np.meshgrid(g, g)
    m = np.zeros(X.shape, bool)
    for L in layers:
        m |= L.shape(X, Y) < 0.5
    ys, xs = np.nonzero(m)
    return g[xs.min()] - 0.2, g[ys.min()] - 0.2, g[xs.max()] + 0.2, g[ys.max()] + 0.2


def bake_skeleton(people, poses):
    parts = skeleton_parts()
    parts.update({'o:' + n: [(b, rim(ls)) for b, ls in vs] for n, vs in list(parts.items())})
    cells = {'lo': [], 'hi': []}
    table = {}
    for name, variants in parts.items():
        table[name] = []
        for bins, layers in variants:
            rect = bounds(layers)
            i = len(cells['hi'])
            for lod in ('lo', 'hi'):
                cells[lod].append(render(layers, *rect, K[lod]))
                if name.startswith('o:'):
                    cells[lod][-1][0][..., :3] = HARM
            table[name].append([*bins, i, i])
    pages, cellrows = {}, {}
    for lod in ('lo', 'hi'):
        at, page = pack([c[0] for c in cells[lod]], 2048)
        pages[lod] = page
        cellrows[lod] = [v for (x, y), (pic, ox, oy) in zip(at, cells[lod]) for v in (x, y, pic.shape[1], pic.shape[0], round(ox, 4), round(oy, 4))]
    look = {'id': 's01', 'role': 'skeleton', 'key': 's01', 'hk': 1.0,
            'kit': {'back': False, 'long': False, 'waders': False, 'headBack': False, 'headKit': True, 'hoodup': False, 'closed': True, 'lift': 0.1},
            'rest': REST, 'tally': False, 'rainHood': False, 'k': K, 'parts': table, 'cells': cellrows}
    people[:] = [d for d in people if d['id'] != 's01'] + [look]
    lo = poses['lo']
    if 'lo-4.webp' not in lo['pages']:
        lo['pages'].append('lo-4.webp')
        lo['h'].append(0)
    pi = lo['pages'].index('lo-4.webp')
    lo['h'][pi] = int(pages['lo'].shape[0])
    lo['at']['s01'] = [0, 0, pi]
    poses['looks']['s01'] = [0.16, 0.06, 7]
    return pages


# ---- the hit: a struck body's flash, a broken ring and chips flying off, white and grey in ink for the game to tint
# (src/view/life/clips.ts steps a cell name ending `-` through its frames); world units of the cell = px / HIT_K

HIT_N, HIT_K = 6, 8
WHITE = ramp('#ffffff', '#ffffff', '#ffffff', '#ffffff')
GREY = ramp('#9c9c9c', '#9c9c9c', '#9c9c9c', '#9c9c9c')


def star(n, r_long, r_short, rot, seed):
    pts = []
    for k in range(2 * n):
        j = math.sin(seed * 7.1 + k * 3.7)
        r = (r_long * (0.72 + 0.28 * j) if k % 2 == 0 else r_short * (0.85 + 0.15 * j))
        a = rot + k * math.pi / n + 0.22 * j
        pts.append((r * math.cos(a), r * math.sin(a)))
    return poly(pts)


def hit_frame(i):
    t = i / (HIT_N - 1)
    layers = []
    if i <= 2:
        grow, hole = [0.8, 1.0, 1.1][i], [0, 0, 0.42][i]
        outer = star(6, 8.0 * grow, 3.4 * grow, 0.3, 1)
        inner = star(6, 5.2 * grow, 2.2 * grow, 0.3, 1)
        if hole:
            outer, inner = cut(outer, circle(0, 0, 8.0 * hole)), cut(inner, circle(0, 0, 8.0 * hole))
        layers += [Layer(outer, GREY, lw=0.3, flat=True), Layer(inner, WHITE, lw=0.0, flat=True)]
    if i >= 1:
        for k in range(6):
            a = k * 2 * math.pi / 6 + 0.5 + 0.4 * math.sin(k * 5.3)
            d = 3.4 + 4.8 * t ** 0.7 * (0.8 + 0.2 * math.sin(k * 2.1))
            cx, cy = d * math.cos(a), d * math.sin(a) + 2.2 * t * t
            s = 2.1 - 0.9 * t
            sp = a + 2.5 * t * (1 if k % 2 else -1)
            c, sn = math.cos(sp), math.sin(sp)
            shard = poly([(cx + c * x * s - sn * y * s, cy + sn * x * s + c * y * s) for x, y in ((1.2, 0), (-0.5, 0.6), (-0.8, -0.3), (0.1, -0.7))])
            layers.append(Layer(shard, WHITE if k % 3 else GREY, lw=0.25, flat=True))
    return layers


def bake_hit(LIFE):
    life = json.loads((LIFE / 'manifest.json').read_text())
    page = np.asarray(Image.open(LIFE / 'life.png').convert('RGBA'))
    old = [v for name, v in life['cells'].items() if name.startswith('hit-')]
    top = min(v[1] for v in old) if old else page.shape[0]
    pics = [render(hit_frame(i), -9.6, -9.6, 9.6, 9.6, 1 / HIT_K) for i in range(HIT_N)]
    at, strip = pack([p[0] for p in pics], page.shape[1])
    page = np.concatenate([page[:top], strip])
    for i, ((x, y), (pic, ox, oy)) in enumerate(zip(at, pics)):
        life['cells'][f'hit-{i}'] = [x, top + y, pic.shape[1], pic.shape[0], HIT_K, round(-ox * HIT_K, 3), round(-oy * HIT_K, 3)]
    life['h'] = int(page.shape[0])
    Image.fromarray(page, 'RGBA').save(LIFE / 'life.png', optimize=True)
    write_json(LIFE / 'manifest.json', life)


def save_webp(arr, path):
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', lossless=True, quality=100, method=6, exact=False)


def main(root=ROOT):
    t0 = time.time()
    a = Path(root) / 'assets'
    poses = json.loads((a / 'poses/poses.json').read_text())
    people = json.loads((a / 'people/people.json').read_text())
    people_roles = [r for r in poses['roles'] if r != 'skeleton']
    for face in 'hud':
        put_series(poses, people_roles, f'swing:{face}', swing(face))
    idle, walk, attack, die = skeleton_series(poses)
    put_series(poses, ['skeleton'], 'idle', idle)
    for face in 'hud':
        put_series(poses, ['skeleton'], f'walk:own:{face}', walk[face])
        put_series(poses, ['skeleton'], f'swing:{face}', attack[face])
    put_series(poses, ['skeleton'], 'collapse', die)
    pages = bake_skeleton(people, poses)
    save_webp(pages['hi'], a / 'people/s01.hi.webp')
    save_webp(pages['lo'], a / 'poses/lo-4.webp')
    write_json(a / 'poses/poses.json', poses)
    write_json(a / 'people/people.json', people)
    bake_hit(a / 'life')
    # one level each: PNG and WebP pages ship level 0 and the GPU mips them
    for f in ('people/s01.hi.webp', 'poses/lo-4.webp', 'life/life.png', 'poses/poses.json', 'people/people.json', 'life/manifest.json'):
        print(f'{f}: {(a / f).stat().st_size} B')
    print(f'baked in {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(*sys.argv[1:])
