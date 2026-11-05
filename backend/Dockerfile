# The API container. Build from backend/:  docker build -t virello-api .
# Run migrations as a separate release step (they are not run at start-up):
#   docker run --rm --env-file .env virello-api alembic upgrade head

# Pinned by digest so a moved tag cannot change what is built; Dependabot proposes digest updates.
FROM python:3.13-slim@sha256:09a17cad02668ae61ece136b4fd36ac3849e14f670ebedb637ea3e15580525bc AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
# Dependencies first: this layer is reused until pyproject.toml or uv.lock changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

FROM base AS runtime
# The server never installs anything, so it needs no pip or setuptools. The ones in the base image bundle
# their own copies of libraries (msgpack, urllib3 and others) that carry their own vulnerabilities.
RUN python -m pip uninstall --yes pip setuptools wheel \
 && rm -rf /usr/local/lib/python3.13/site-packages/pip* /usr/local/lib/python3.13/site-packages/setuptools* \
      /usr/local/lib/python3.13/site-packages/pkg_resources /usr/local/lib/python3.13/site-packages/wheel* \
 && groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=build --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000
USER app
EXPOSE 8000
# No curl in the slim image, so ask the server itself. /healthz never touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4).status == 200 else 1)"
# --no-server-header: do not announce the server software. The host terminates TLS in front of this.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
