import json
from datetime import datetime, timedelta
import math

def generate_activity(filename, name, type_name, duration_sec, day_offset=0, has_gps=False, has_hr=False, has_power=False, static_hr=None):
    # Base start time: Jan 1 2024. Add day_offset to stagger activities.
    start_time = datetime(2024, 1, 1, 10, 0, 0) + timedelta(days=day_offset)
    records = []

    lat = 37.7749
    lon = -122.4194

    for i in range(duration_sec):
        t = start_time + timedelta(seconds=i)
        rec = {"timestamp": t.strftime("%Y-%m-%dT%H:%M:%SZ")}

        if has_hr:
            # Sine wave HR around 140
            hr = 140 + int(20 * math.sin(i / 10.0))
            if static_hr:
                hr = static_hr
            rec["heart_rate"] = hr

        if has_power:
            # Sine wave Power around 150
            rec["power"] = 150 + int(50 * math.sin(i / 5.0))
            rec["cadence"] = 80 + int(5 * math.sin(i / 20.0))

        if has_gps:
            # Move slightly
            rec["position_lat"] = lat + (i * 0.0001)
            rec["position_long"] = lon + (i * 0.0001)
            rec["altitude"] = 10.0 + (i * 0.1)
            rec["speed"] = 3.0

        records.append(rec)

    activity = {
        "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "name": name,
        "type": type_name,
        "sessions": [{
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_elapsed_time": duration_sec,
            "total_distance": duration_sec * 3.0 if has_gps else 0,
            "laps": [{
                "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "total_elapsed_time": duration_sec,
                "total_distance": duration_sec * 3.0 if has_gps else 0,
                "records": records
            }]
        }]
    }

    with open(filename, 'w') as f:
        json.dump(activity, f, indent=2)
    print(f"Generated {filename} (Date: {start_time.strftime('%Y-%m-%d')})")

# Generate all stubs (5 minutes = 300 seconds)
duration = 300

# 1. Weight Training (Jan 1)
generate_activity("src/go/cmd/fit-gen/stubs/verify_weight_training.json", "Weight Training", "WEIGHT_TRAINING", duration, day_offset=0)

# 2. Weight Training with HR (Jan 2)
generate_activity("src/go/cmd/fit-gen/stubs/verify_weight_training_hr.json", "Weight Training + HR", "WEIGHT_TRAINING", duration, day_offset=1, has_hr=True)

# 3. Run GPS HR (Jan 3)
generate_activity("src/go/cmd/fit-gen/stubs/verify_run_gps_hr.json", "Run GPS+HR", "RUNNING", duration, day_offset=2, has_gps=True, has_hr=True)

# 4. Ride Power (Jan 4)
generate_activity("src/go/cmd/fit-gen/stubs/verify_ride_power.json", "Ride Power", "CYCLING", duration, day_offset=3, has_power=True)

# 5. Ride HR Power (Jan 5)
generate_activity("src/go/cmd/fit-gen/stubs/verify_ride_hr_power.json", "Ride HR+Power", "CYCLING", duration, day_offset=4, has_power=True, has_hr=True)

# 6. Workout Virtual GPS (Jan 6)
generate_activity("src/go/cmd/fit-gen/stubs/verify_workout_hr_virtual_gps.json", "Virtual GPS Workout", "WORKOUT", duration, day_offset=5, has_gps=True, has_hr=True)
