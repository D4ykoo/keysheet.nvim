# keysheet — keymap overview editor/generator.
#
# Zero runtime dependencies (only bun/node builtins), and Bun runs the .ts
# sources directly, so there's no install or build step: just copy and run.
FROM oven/bun:1-alpine

# Non-root user for a smaller attack surface. The base image ships `bun`.
WORKDIR /app

# Copy only what the running server needs (see .dockerignore for exclusions).
COPY package.json ./
COPY src ./src
COPY client ./client
COPY keymaps.json ./

# The editor server. PORT/HOST are read from the environment (see cli.ts /
# serve.ts); HOST=0.0.0.0 makes the port reachable from outside the container.
ENV PORT=4711 \
    HOST=0.0.0.0
EXPOSE 4711

# Drop privileges — `bun` user is provided by the oven/bun image.
USER bun

CMD ["bun", "run", "src/cli.ts", "serve", "keymaps.json"]
