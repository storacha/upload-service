# CLAUDE.md - upload-service

## Project Overview

Storacha upload-service monorepo. A collection of packages for decentralized storage using UCAN authorization, IPLD data structures, and Filecoin integration.

## Monorepo Structure

- **Package manager:** pnpm 10.1.0 (pinned via `packageManager` field)
- **Task runner:** Nx 22.x
- **Workspaces:** `packages/**` (18 packages)
- **Language:** JavaScript/TypeScript (ESM, `type: "module"`)

### Key Packages

| Package | npm name | Description |
|---------|----------|-------------|
| `ucn` | `@storacha/ucn` | User Controlled Names (UCAN-authorized mutable refs) |
| `upload-client` | `@storacha/upload-client` | Upload client library |
| `upload-api` | `@storacha/upload-api` | Upload API server |
| `w3up-client` | `@storacha/client` | Main web3 storage client |
| `capabilities` | `@storacha/capabilities` | UCAN capability definitions |
| `console` | `@storacha/console` | Web console (Next.js) |
| `cli` | `@storacha/cli` | CLI tool |

## Commands

### Running tests

```sh
# Run tests for affected packages (preferred - uses Nx caching)
pnpm nx affected -t test

# Run tests for a specific package
pnpm nx test @storacha/ucn

# Run tests directly in a package directory
cd packages/ucn && npx vitest --run

# Watch mode
cd packages/ucn && npx vitest
```

### Building

```sh
# Build affected packages
pnpm nx affected -t build

# Build a specific package
pnpm nx build @storacha/ucn

# Build all
pnpm nx run-many -t build
```

### Linting & Formatting

```sh
# Lint affected
pnpm nx affected -t lint

# Typecheck affected
pnpm nx affected -t typecheck

# Full CI check (what CI runs)
pnpm nx affected -t typecheck lint build test depcheck
```

### Installing dependencies

```sh
pnpm install
```

## Code Style & Conventions

### Formatting (Prettier)

- No semicolons
- Single quotes
- 2-space indentation
- ES5 trailing commas

### Linting (ESLint)

- Extends `@storacha/eslint-config`
- TypeScript-aware (`@typescript-eslint`)
- JSDoc plugin enabled
- Key rule: `no-floating-promises: error`

### TypeScript

- Strict mode enabled
- Target: ES2022, Module: Node16
- Composite builds with project references
- Per-package structure: `tsconfig.json` (refs), `tsconfig.lib.json` (src), `tsconfig.spec.json` (test)
- Types generated via `tsc --build`

### Package Structure Convention

```
packages/<name>/
├── src/           # Source code (.js with JSDoc types, or .ts)
│   ├── api.ts     # Type definitions (auto-generated .js ignored by eslint)
│   └── index.js   # Entry point
├── test/          # Tests
│   ├── *.spec.js  # Test files (ucn uses .spec.js)
│   └── helpers.js # Test utilities
├── dist/          # Built output (gitignored)
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

### Test Conventions

- **Framework:** Vitest (primary), Mocha (some older packages)
- **Pattern:** `test/*.spec.js` or `test/*.test.js`
- **Imports:** `import { describe, it, assert, expect } from 'vitest'`
- **Style:** Use `assert` for most checks, `expect(...).rejects.toThrow()` for async errors
- **Fixtures:** Shared via `test/helpers.js`

## Git Conventions

### Commit Messages

Conventional Commits format: `<type>(<scope>): <message>`

- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`
- Scope: package name when relevant (e.g., `feat(ucn): add pail support`)
- Message: lowercase, imperative

### Branching

- Main branch: `main`
- Feature branches: `feat/<description>`
- Release branch: `release` (automated)

### Releases

- Uses **Nx version plans** (`nx release plan`)
- When opening a PR with releasable changes, generate a version plan
- Release automation creates a rolling release PR on the `release` branch
- Independent versioning per package (SemVer)

## CI

- **Node version:** 24 (in CI)
- **Pipeline:** `pnpm nx affected -t typecheck lint build test depcheck`
- Uses `nrwl/nx-set-shas` for affected detection
- Nx caching enabled for most targets

## Implementation Checklist

When implementing features or making changes, verify that the following Nx targets all pass for affected packages before considering the work complete:

```sh
pnpm nx affected -t typecheck lint build test
```

This mirrors the CI pipeline and catches type errors, lint violations, build failures, and test regressions early.

## Important Notes

- The `@web3-storage/pail` and `@web3-storage/clock` packages are external dependencies used heavily by `@storacha/ucn`
- UCAN (User Controlled Authorization Networks) is the authorization layer - see `@ucanto/*` packages
- Many packages use JSDoc for types with separate `.ts` files for type definitions (`api.ts`)
- The `api.ts` → `api.js` generated files are ignored by eslint
