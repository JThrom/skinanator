# Skinanator - Minecraft Bedrock skin editor
# Small, production-ish image served by gunicorn and exposed on the LAN.

FROM python:3.11-slim

# Avoid interactive prompts + keep Python output unbuffered for docker logs.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application.
COPY . .

# Generate the example presets at build time if they aren't present.
RUN test -f presets/presets.json || python generate_presets.py

# Persisted user data lives here (mounted as a volume in compose).
VOLUME ["/app/catalog", "/app/skins"]

EXPOSE 5000

# Serve with gunicorn (real WSGI server) bound to all interfaces so the
# container port can be published to the LAN. Two workers is plenty for a
# single-user tool; threads help with the small image endpoints.
CMD ["sh", "-c", "gunicorn --bind ${HOST}:${PORT} --workers 2 --threads 4 --timeout 60 app:app"]
