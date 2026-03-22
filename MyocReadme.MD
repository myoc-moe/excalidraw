# Myoc Excalidraw Release Notes

This file documents the release workflow for the Myoc fork of Excalidraw.

It is intended for:
- humans working in this repo
- agents making changes or preparing releases

## Scope

This fork publishes packages under the `@myoc` scope.

Important:
- this repo is released from the workspace root
- do not publish `packages/excalidraw` directly with `yarn publish`
- the root release script exists to build packages in order and keep package versions aligned

## Package Relationships

The main package depends on internal workspace packages:
- `@myoc/common`
- `@myoc/math`
- `@myoc/element`
- `@myoc/excalidraw`

These must stay version-aligned for release.

## Normal Workflow

From the repo root:

```powershell
cd D:\Code\myoc\excalidraw
yarn install
yarn build:packages
```

If both succeed, the workspace is in a releasable state.

## Release Workflow

Always run releases from the repo root:

```powershell
cd D:\Code\myoc\excalidraw
```

Internal/test releases:

```powershell
yarn release --tag=test
```

Rolling internal releases:

```powershell
yarn release --tag=next
```

Stable release:

```powershell
yarn release --tag=latest --version=0.19.503
```

What the root release script does:
- runs install
- clears build output
- builds `common`, `math`, `element`, then `excalidraw`
- updates internal package versions for the release
- publishes packages in dependency order
- restores local dependency declarations after publishing

## Do Not Do This

Do not run this from `packages/excalidraw`:

```powershell
yarn publish
```

Why:
- it skips the monorepo release flow
- it does not align internal package versions correctly
- it can publish `@myoc/excalidraw` while `@myoc/common`, `@myoc/math`, and `@myoc/element` are still on older versions

## Changelog Prompt

During `yarn release --tag=latest`, the script may print:

- `Bad commits: [...]`

For this fork, that is usually not important.

Reason:
- the changelog generator expects upstream-style PR commit messages
- Myoc often uses direct commits without upstream PR numbers

If the release is internal, this warning can usually be ignored.

## npm Scope Requirement

Publishing only works if the logged-in npm user has publish access to the `@myoc` scope.

If publish fails with a registry `404` for `@myoc/excalidraw`, check:
- the npm account is logged in correctly
- the account can publish to `@myoc`
- `@myoc` is the intended scope

## Known Repo Notes

- This fork removes or disables AI-specific behavior. If compile errors appear around `aiEnabled`, prefer removing that dependency instead of restoring upstream AI features.
- The browser example in `examples/with-script-in-browser` should use `@myoc/excalidraw`, not `@excalidraw/excalidraw`.
- Internal workspace dependencies must match the version being released.

## Before Finishing a Release

Check:

```powershell
yarn build:packages
```

If `yarn.lock` was regenerated or had previous merge conflicts, make sure it is staged before committing:

```powershell
git add yarn.lock
```

## Quick Checklist

- run commands from repo root
- use `yarn install`
- use `yarn build:packages`
- use `yarn release --tag=test|next|latest`
- do not use direct `yarn publish` in `packages/excalidraw`
- keep all `@myoc/*` package versions aligned
- ignore `Bad commits` unless changelog quality matters for the release
