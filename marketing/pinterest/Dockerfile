# Build context is this directory (marketing/pinterest) — standalone Python
# app, no pnpm workspace dependency, unlike apps/api's Dockerfile.
#
# Built and pushed locally (not via `railway up` / git-connected build):
# photos/ is gitignored (hundreds of MB), and Railway's upload step respects
# .gitignore by default, so a git-based build would ship with zero photos.
# `docker build` only reads .dockerignore (never .gitignore) — moot anyway
# here since photos/ is intentionally NOT baked into the image; see
# refresh_photo_pool() in bot.py, which fetches a fresh pool from Pexels at
# startup instead. See CLAUDE.md for the full build/push/deploy commands.
FROM python:3.12-slim

# No system font package installed here (Debian slim ships none by default) —
# pipeline.py's load_font() falls back to Pillow's own scalable default font
# via ImageFont.load_default(size=...) (Pillow >=10.1), which looks fine.
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["python", "bot.py"]
