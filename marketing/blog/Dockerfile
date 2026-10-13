# Build context is this directory (marketing/blog) — standalone Python app, no pnpm
# workspace dependency. On Railway: root directory = marketing/blog, Railway finds this
# Dockerfile automatically. No volume needed — bot.py is stateless (see its docstring).
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["python", "bot.py"]
