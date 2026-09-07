# ShareX API Installer

Generate a Docker Compose stack, Caddy configuration, environment file, and ShareX uploader profiles for [ShareX API](https://github.com/busheezy/sharex-api).

## Use

```sh
docker run --rm -it -v "${PWD}:/setup-sharex/output" ghcr.io/busheezy/sharex-api-installer:latest
```

For the updated local source, build and run the image yourself:

```sh
docker build -t sharex-api-installer:local .
docker run --rm -it -v "${PWD}:/setup-sharex/output" sharex-api-installer:local
```

The installer asks for API and paste-site origins, an API key, and whether to expose a port for your own web server. Defaults generate 32-character random credentials. Existing output requires confirmation before it is overwritten. The installer creates a missing output directory automatically and exits after generation.

Generated output includes:

- `.env` with credentials.
- `docker-compose.yaml` with PostgreSQL, the API, and the paste frontend.
- `sxcu/` with image, file, text, and URL upload profiles.
- `docker/caddy/Caddyfile` when using the bundled web server.

Environment and uploader files are created with owner-only permissions on systems that support them. Keep them private. API keys may contain letters, numbers, underscores, and hyphens so they can be embedded safely in every generated format.

From the output directory, run `docker compose up -d`. The frontend container generates static files and exits normally. With your own web server, route requests to the API and serve `docker/vite/dist` with an `index.html` fallback for paste URLs. The browser needs access to `/api` or the configured API origin.

## Existing installations

Generated profiles retain the same endpoints and response fields. The API mounts now target `/app/uploads` and `/app/thumbnails`, matching the API image. Copy any uploads held only inside an older container into the mounted host directories before replacing it.

New configurations pin PostgreSQL 17 and Caddy 2. Before regenerating an existing stack, back up its database, uploads, and configuration. Do not reuse an old PostgreSQL data directory with a different major version without migrating it; keep the existing database image tag until then. Local source changes do not update published `latest` images automatically.

## Development

Use Node.js 24.19+ within 24.x and pnpm 12.3.4.

```sh
nvm use
npm install --global pnpm@12.3.4
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm start:prod
```

The local CLI writes to `output/`. Use `pnpm format` and `pnpm lint:fix` for formatting and lint fixes. Recommended VS Code extensions enable Oxc on save. CI checks linting, formatting, types, compilation, and the Docker build. There is no automated installer test suite; unused scaffold test commands have been removed.

## Image publishing

CI publishes `ghcr.io/busheezy/sharex-api-installer:latest` and `sha-<commit>` tags after checks pass on `main`. Images support Linux amd64 and arm64. Pull requests build images without publishing them. Publishing uses the repository’s GitHub token; Docker Hub credentials are not required.

## Dependency compatibility

The installer uses NestJS 12, Inquirer 14, and Nano ID 6. TypeScript stays on 6.0.3 because Nest CLI requires the compiler API that TypeScript 7 does not provide. doT uses its latest stable release, 1.1.3, instead of the old 2.0 beta, with whitespace-preserving template settings.
