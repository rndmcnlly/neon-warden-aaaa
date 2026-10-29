"""pilot_figure_issued.glb: see pilot_figure.py for the design notes and node names."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pilot_figure  # noqa: E402

pilot_figure.build("issued")
