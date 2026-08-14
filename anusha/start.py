#!/usr/bin/env python3
"""Start Anusha Shop for a few days of real use. python3 anusha/start.py"""
import subprocess
import sys
from pathlib import Path

app = Path(__file__).resolve().parent / "app.py"
print("Anusha Shop — trial")
print("Open this on this computer:  http://127.0.0.1:5050")
print("Leave this window open while you work.")
print("Every night: Backup → Download JSON onto pendrive.")
print("")
sys.exit(subprocess.call([sys.executable, str(app)]))
