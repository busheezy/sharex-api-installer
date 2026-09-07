FROM node:26.8.1-bookworm-slim AS base
WORKDIR /setup-sharex
RUN npm install --global pnpm@12.3.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

FROM base AS prod-deps
RUN --mount=type=cache,id=sharex-installer-pnpm,target=/root/.local/share/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=sharex-installer-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26.8.1-bookworm-slim
WORKDIR /setup-sharex
COPY --from=prod-deps /setup-sharex/node_modules ./node_modules
COPY --from=build /setup-sharex/dist ./dist
COPY src-cfgs ./src-cfgs
VOLUME ["/setup-sharex/output"]
CMD ["node", "dist/main.js"]
