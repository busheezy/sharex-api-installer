# Migration: September 7, 2026

This guide covers `6396fb8` (the last commit before September 7 in America/Chicago) through `a99b937`.

## Existing generated installations

The installer generates configuration; running a newer image does not migrate existing data or merge existing settings. Existing ShareX profiles remain valid when origins and the API key stay the same. You do not need to regenerate them just to upgrade the applications.

1. Back up the existing `.env`, Compose file, Caddy configuration, uploader profiles, database, uploads, and thumbnails. Record image digests, the Compose project name, and all mounts. Follow the [API migration guide](https://github.com/busheezy/sharex-api/blob/main/MIGRATION.md) to recover files before replacing an old API container.
2. Prefer editing your existing stack. If you want fresh templates, run the installer in a separate empty directory and compare the output before copying selected changes. Do not accept an overwrite prompt in the live deployment directory as an upgrade procedure.
3. Preserve the live `DB_PASSWORD` and other `DB_*` values. Each installer run generates a new database password and does not read your existing `.env`; changing `POSTGRES_PASSWORD` in Compose does not change an initialized database's password. Enter your existing API key explicitly when prompted. Leaving the key blank generates a new one, requiring updates in every upload client.
4. Apply the configuration changes below, retaining your host paths, project name, custom ports, domains, reverse proxy/tunnel settings, and database major version.
5. Validate and deploy from the existing deployment directory. Use Compose v2 (`docker compose`), keeping your existing project-name options. Run `docker compose config --quiet`, then pull/recreate the API and frontend as described in their migration guides. Wait for the frontend build to exit successfully before serving the new static files or restarting your web server.

| Setting                 | Before                                                             | Migration                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application images      | `busheezy/sharex-api:latest`, `busheezy/sharex-paste-front:latest` | Use the corresponding `ghcr.io/busheezy/` images; select published commit tags/digests if pinning.                                                                  |
| Installer image         | `busheezy/sharex-api-installer:latest`                             | Use `ghcr.io/busheezy/sharex-api-installer:latest` or build locally.                                                                                                |
| API mount destinations  | `/nest-sharex/uploads`, `/nest-sharex/thumbnails`                  | Change to `/app/uploads`, `/app/thumbnails` after recovering active files. Host paths can remain unchanged.                                                         |
| PostgreSQL image        | Unpinned `postgres`                                                | New templates use `postgres:17-alpine`. Keep the major version of your existing data, such as PostgreSQL 14; do not adopt 17 without a separate database migration. |
| Caddy image             | `caddy:2.5.2-alpine`                                               | New templates use `caddy:2-alpine`; preserve Caddy configuration, certificate data, and config mounts.                                                              |
| API dependency          | Database merely started                                            | Template waits for the database health check.                                                                                                                       |
| Frontend API URL        | API origin                                                         | New default is `VITE_APP_API_URL=/api`; your paste site's proxy must strip `/api` before forwarding to the API.                                                     |
| Frontend container name | Fixed `vitesharex`                                                 | Fixed name removed. Prefer Compose service commands such as `docker compose logs front`; update scripts targeting the old name if regenerating.                     |

`GENERATE_API=true` now requests a frontend build at container startup. `TYPES_URL` is obsolete for the new frontend, although the installer still emits it; it can be removed from the deployed `.env`. With your own web server, serve `docker/vite/dist` with an `index.html` fallback and proxy `/api/*`, or set a browser-accessible API origin and configure CORS. See the [frontend migration guide](https://github.com/busheezy/sharex-paste-front/blob/main/MIGRATION.md).

## Generating comparison files

Run this from a new, empty staging directory:

```sh
docker run --rm -it -v "${PWD}:/setup-sharex/output" ghcr.io/busheezy/sharex-api-installer:latest
```

Wait for the chosen revision's image-publishing job before using its image. Local source changes do not update a registry tag by themselves.

URL prompts now accept only HTTP/HTTPS origins without paths, queries, or embedded credentials. The optional exposed port must be an integer from 1 to 65535. API keys accept letters, numbers, underscores, and hyphens. Existing keys outside that format require either retaining the hand-managed configuration or deliberately rotating the key in the API and all clients. New generated credentials are 32 characters instead of 8.

The installer now exits after generation. On systems supporting Unix permissions, `.env` and `.sxcu` files are mode `0600`, including overwritten files. A Docker run can leave them owned by root; transfer ownership to the intended operator when necessary while retaining private permissions. Generated environment values are now single-quoted; use a dotenv-compatible reader instead of scripts that treat quotes as literal password characters.

## Verify and roll back

Check that the API connects to the existing database, old uploads are readable, old paste URLs work, and an existing ShareX profile can upload and delete a disposable item. If you rotated the key, reimport the generated profiles and update the VS Code secret too.

To roll back, restore the previous configuration and application image digests, preserving the database version and data mounts. Restore matching database/files backups only if needed, after accounting for new writes. Keep backups and old volumes until verification succeeds; never remove volumes as part of this update.

## Building from source

Use the repository's `.nvmrc` (Node 24.19.0) and pnpm 12.3.4 instead of the old Node/package-manager setup. From the updated checkout:

```sh
nvm use
npm install --global pnpm@12.3.4
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Keep the committed lockfile. Update custom CI jobs and editor integrations to use `pnpm check`, Oxlint, and Oxfmt instead of the removed ESLint/Prettier setup. Format with `pnpm format`.

The CLI output remains `output/`; `pnpm start:prod` now runs `dist/main.js`. There is no automated installer test suite. Removed scaffold test commands should be removed from custom CI jobs too.
