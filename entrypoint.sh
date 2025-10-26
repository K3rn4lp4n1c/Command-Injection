#!/usr/bin/env bash
set -euo pipefail

# 1) Ensure uploads dir exists (tmpfs will be mounted here at runtime)
mkdir -p /app/uploads

# Sticky bit so only file owners (root) can delete their files in this dir
# Mode 1733 => rwx-wx-wt
chmod 1733 /app/uploads

# 2) Put the known sample in uploads but make it immutable to the app user:
# - owned by root
# - read-only
cp -f /app/assets/exiftool_test.png /app/uploads/exiftool_test.png
chown root:root /app/uploads/exiftool_test.png
chmod 444 /app/uploads/exiftool_test.png

# Optional: If your FS supports it and you really want belt+suspenders:
# chattr +i /app/uploads/exiftool_test.png || true

# 3) Drop privileges and run Flask (no reloader so it won’t try to write files)
exec gosu ctf:ctf python -m flask run --host=0.0.0.0 --port=5000 --no-reload
