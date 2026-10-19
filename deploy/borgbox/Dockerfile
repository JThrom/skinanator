FROM python:3.11-slim@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN test -f presets/presets.json || python generate_presets.py

EXPOSE 5000

CMD ["sh", "-c", "gunicorn --bind ${HOST}:${PORT} --workers 2 --threads 4 --timeout 60 app:app"]
