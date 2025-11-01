FROM python:3.12-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      libimage-exiftool-perl inetutils-ftp git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Sanity: Python check
RUN python --version && pip --version

WORKDIR /app

# Clone the repo
ARG REPO="https://github.com/K3rn4lp4n1c/Command-Injection.git"
ARG BRANCH="docker"
RUN test -n "$REPO" && git clone -b "$BRANCH" "$REPO" /app/

# Set environmental variables
ENV FLASK_APP=/app/app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000
ENV PYTHONUNBUFFERED=1

# Get Python libraries and modules
RUN set -eux; \
    if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    fi

# --- Flag from your filesystem (baked in) ---
COPY flag.txt /flag.txt
RUN set -eux; \ 
    find /app -type f -exec chown root:root {} + -exec chmod 444 {} +

# Healthcheck to your existing endpoint
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

# --- lock the parent directory of WORKDIR (no writes above the app dir) ---
RUN parent="$(dirname "$PWD")" \
 && chown root:root "$parent" \
 && chmod 0555 "$parent"

# Non-root user for the app
RUN useradd -m -U -s /bin/bash ctf
USER ctf

EXPOSE 5000

CMD ["python", "app.py"]