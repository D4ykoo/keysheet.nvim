# keysheet — keymap overview editor/generator.
#
# Zero runtime dependencies (only bun/node builtins), and Bun runs the .ts
# sources directly, so there's no install or build step: just copy and run.
FROM oven/bun:1-alpine

# Non-root user for a smaller attack surface. The base image ships `bun`.
WORKDIR /app

# Copy only what the running server needs (see .dockerignore for exclusions).
# --chown=bun so the non-root runtime user can write keymaps.json when the
# editor's Save button is used (without needing a bind-mount to fix ownership).
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun client ./client
COPY --chown=bun:bun keymaps.json ./

# The editor server. PORT/HOST are read from the environment (see cli.ts /
# serve.ts); HOST=0.0.0.0 makes the port reachable from outside the container.
ENV PORT=4711 \
    HOST=0.0.0.0
EXPOSE 4711

# Drop privileges — `bun` user is provided by the oven/bun image.
USER bun

CMD ["bun", "run", "src/cli.ts", "serve", "keymaps.json"]
