FROM python:3.12-slim

# --- System deps ---
# - ExifTool
# - lftp (FTP client)
# - git (to clone your repo)
# - gosu (drop to non-root cleanly)
# - curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libimage-exiftool-perl lftp git gosu curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Sanity: Python check
RUN python --version && pip --version

WORKDIR /app
$REPO = "https://github.com/K3rn4lp4n1c/Command-Injection.git"
$BRANCH = "docker"


# Basic shallow clone:
RUN test -n "$REPO" && git clone --depth 1 -b "$BRANCH" "$REPO" /app/src

# OPTIONAL: Sparse checkout to "clone without some files"
# Uncomment + edit the paths you want to EXCLUDE
# RUN git -C /app/src sparse-checkout init --no-cone && \
#     git -C /app/src sparse-checkout set '/*' '!:docs/' '!:big_assets/' '!:*.mp4'

# If your Flask app lives at /app/src/app.py, this will work out of the box.
# If it has a different structure, adjust FLASK_APP accordingly.
ENV FLASK_APP=/app/src/app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000
ENV PYTHONUNBUFFERED=1
# Make sure Flask is installed by your requirements
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# --- Flag from your filesystem (baked in) ---
# You said the flag will be copied in; put it next to this Dockerfile and build.
COPY flag.txt /flag.txt
RUN chown root:root /flag.txt && chmod 444 /flag.txt

# --- Known sample image goes into read-only assets ---
# This will later be copied into the writable tmpfs uploads folder at runtime.
COPY exiftool_test.png /app/assets/exiftool_test.png
RUN chown root:root /app/assets/exiftool_test.png && chmod 444 /app/assets/exiftool_test.png

# Healthcheck to your existing endpoint
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

  # --- lock challenge files (root-owned, read-only) ---
RUN chown root:root app.py flag.txt exiftool_test.png \
 && chmod 0444 app.py flag.txt exiftool_test.png

# --- lock the parent directory of WORKDIR (no writes above the app dir) ---
RUN parent="$(dirname "$PWD")" \
 && chown root:root "$parent" \
 && chmod 0555 "$parent"

# Non-root user for the app
RUN useradd -m -U -s /bin/bash ctf

# Entrypoint will prep uploads and drop privileges to 'ctf'
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000

# Keep root here so entrypoint can prep tmpfs + perms, then gosu to ctf
ENTRYPOINT ["/entrypoint.sh"]
