#!/usr/bin/env python3
"""Generate synthetic subject + daily health CSVs for demos (stdlib only)."""

from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

# ---- CONFIG ----
NUM_SUBJECTS = 10
NUM_DAYS = 30
start_date = datetime(2025, 1, 1)

OUT_DIR = Path(__file__).resolve().parent / "generated_health"

# ---- SUBJECTS ----
subjects = []
for i in range(NUM_SUBJECTS):
    subjects.append({
        "subject_id": f"S{i:03d}",
        "age": random.randint(25, 50),
        "sex": random.choice(["M", "F"]),
        "fitness_level": random.choice(["low", "medium", "high"]),
    })

# ---- DAILY HEALTH ----
# Integer ranges match numpy.random.randint(low, high) -> [low, high)
rows = []
for s in subjects:
    for d in range(NUM_DAYS):
        date = start_date + timedelta(days=d)
        rows.append({
            "subject_id": s["subject_id"],
            "date": date.strftime("%Y-%m-%d"),
            "resting_hr": random.randrange(50, 80),
            "hrv": random.randrange(30, 80),
            "sleep_minutes": random.randrange(300, 480),
        })

# ---- OUTPUT ----
OUT_DIR.mkdir(parents=True, exist_ok=True)
subjects_path = OUT_DIR / "subjects.csv"
daily_path = OUT_DIR / "daily_health.csv"

with open(subjects_path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(
        f,
        fieldnames=["subject_id", "age", "sex", "fitness_level"],
    )
    w.writeheader()
    w.writerows(subjects)

with open(daily_path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(
        f,
        fieldnames=["subject_id", "date", "resting_hr", "hrv", "sleep_minutes"],
    )
    w.writeheader()
    w.writerows(rows)

print("done")
print(f"wrote {subjects_path}")
print(f"wrote {daily_path}")
