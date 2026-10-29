"""logo_cm121.glb: see logos.py for the design notes and node names."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import logos  # noqa: E402

logos.build_cm121()
