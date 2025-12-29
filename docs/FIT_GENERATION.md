# FIT File Generation & Testing

This document describes the tools and processes for generating FIT files used in verification and testing, particularly for Strava uploads.

## FIT Generator Tool (`fit-gen`)

The `fit-gen` CLI tool (`src/go/cmd/fit-gen`) converts a `StandardizedActivity` JSON representation into a valid binary `.fit` file.

### Build
```bash
make build-go
# Binary location: ./bin/fit-gen
```

### Usage
```bash
./bin/fit-gen -input <path-to-json-activity> -output <path-to-fit-file>
```

## Test Data Stubs

Located in `src/go/cmd/fit-gen/stubs/`, these JSON files represent various activity scenarios (e.g., Weight Training, Running with GPS, Cycling with Power).

### Generating Stubs
A Python script is provided to generate realistic, 5-minute long activity stubs with staggered dates to avoid overlap.

**Script:** `src/go/cmd/fit-gen/stubs/generate_test_data.py`

**Usage:**
```bash
python3 src/go/cmd/fit-gen/stubs/generate_test_data.py
```
This command will regenerate the JSON stub files in the same directory.

## Validation Workflow

To manually verify FIT file correctness (e.g., for Strava):

1.  **Generate Stubs:** Run the python script to get fresh data.
2.  **Generate FIT Files:** Use `fit-gen` to convert the JSON stubs to `.fit` files.
    ```bash
    ./bin/fit-gen -input src/go/cmd/fit-gen/stubs/verify_run_gps_hr.json -output src/go/verify_run_gps_hr.fit
    ```
3.  **Upload:** Upload the resulting `.fit` file to Strava (or other platform).
4.  **Verify:** Check that all data fields (Heart Rate, GPS map, Power, etc.) are displayed correctly.
