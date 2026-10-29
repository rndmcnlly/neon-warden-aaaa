"""pickup_shield.glb: see pickups.py for the design notes and node names."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pickups  # noqa: E402

pickups.build_shield()
