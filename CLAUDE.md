# CLAUDE.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

## Releases

- Never run `yarn release` (or any `release:*` script), `npm publish`, or anything else that publishes `@myoc/excalidraw`. Releases are done manually by the maintainer, who holds the npm auth.
- feng publishes by pushing `master` to the `release` branch; agents never push to or touch `release`. Each push runs lint, typecheck and tests, then packs snapshot versions (`<next patch>-next-<sha>`) of all `@myoc/*` packages (`yarn release --tag=next --github`) and attaches the tarballs to a GitHub prerelease `v<version>` (`.github/workflows/autorelease-excalidraw.yml`). No npm publish. Internal dependencies in the tarballs point to the tarballs of the same release. Consumers pin the release asset URLs (`https://github.com/myoc-moe/excalidraw/releases/download/v<version>/myoc-<package>-<version>.tgz`). Release assets are immutable: never replace an asset of an existing release. Stable `latest` releases stay manual on npm.
