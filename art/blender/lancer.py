"""lancer.glb: lance frigate. Original: 52 x 28 px green horizontal diamond
with a short downward lance line. Here: a long flat enamel hull, gold
heraldic trim, a dorsal crest fin, and an emissive ventral spike: a jousting
knight in profile, crossing the screen sideways.

Long axis is X (it crosses the screen); the spike points +Z in glTF (it fires
down-screen). The model is left-right symmetric, so no mirroring is needed
for pincer pairs. Nodes: lancer (root), lancer_hull, lancer_gold, lancer_crest,
lancer_trim, lancer_spike (emissive, flash before each three-way volley),
lancer_pods.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("lancer")

enamel = c.mat("lancer_enamel", "#1f7a46", metallic=0.1, roughness=0.25, coat=1.0)
gold = c.mat("lancer_gold", "#d9a83a", metallic=1.0, roughness=0.25)
dark = c.mat("lancer_dark", "#0f1a14", metallic=0.6, roughness=0.45)
mint = c.emit("lancer_mint", "mint")
spike_m = c.emit("lancer_spike", "mint", strength=10)

diamond = [(-2.6, 0.0), (0.0, -1.0), (2.6, 0.0), (0.0, 1.4)]
c.bevel(c.obj("lancer_hull", c.prism(diamond, -0.25, 0.25, top_scale=0.86), enamel, root),
        0.06, 2, angle=30)
# Gold collar: a smaller raised diamond, heraldic.
c.bevel(c.obj("lancer_gold", c.prism([(-1.5, 0.0), (0.0, -0.58), (1.5, 0.0), (0.0, 0.8)],
                                     0.22, 0.36, top_scale=0.8), gold, root), 0.03)
# Dorsal crest fin, like a helm plume, swept back along X.
c.bevel(c.obj("lancer_crest", c.transform(
    c.prism([(-0.9, 0.0), (0.9, 0.0), (0.5, 0.6), (-0.4, 0.45)], -0.05, 0.05),
    loc=(0, 0.2, 0.36), rot=(1.5708, 0, 0)), gold, root), 0.015)

# Emissive trim along the four hull edges.
t = [c.strip(diamond[i], diamond[(i + 1) % 4], 0.06, 0.16, 0.24) for i in range(4)]
c.obj("lancer_trim", c.merge(*t), mint, root)

# Twin engine pods at the diamond's side points.
pod = c.transform(c.cylinder(0.18, 0.7, 10), loc=(2.35, 0.2, 0), rot=(0, 1.5708, 0))
c.obj("lancer_pods", c.merge(pod, c.mirror_part(pod)), dark, root, smooth=True)

# Ventral spike: lance housing plus an emissive cone pointing down-screen.
c.obj("lancer_spike_housing", c.transform(c.cylinder(0.24, 0.5, 10, r_top=0.18),
                                          loc=(0, -1.05, 0), rot=(1.5708, 0, 0)),
      dark, root, smooth=True)
c.obj("lancer_spike", c.transform(c.cone(0.16, 1.2, 10), loc=(0, -1.25, 0),
                                  rot=(1.5708, 0, 0)), spike_m, root)

c.finish("lancer")
