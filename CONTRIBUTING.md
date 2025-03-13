# Contributing

Join in. All welcome! storacha.network is open-source. The code is dual-licensed under [MIT + Apache 2.0](license.md)

This project uses node v18 and `pnpm`. It's a monorepo that use [pnpm workspaces](https://pnpm.io/workspaces) to handle resolving dependencies between the local `packages/*` folders.

If you're opening a pull request, please generate a version plan with `nx release plan` to note the changes for the changelog and version bumping during [release](#release-process).

## Setup a development environment

We use [`pnpm`](https://pnpm.io/) in this project and commit the `pnpm-lock.yaml` file. We manage our packages and tasks within `pnpm` using [`nx`](https://nx.dev/).

```bash
# install all dependencies in the mono-repo
pnpm install
# setup environment variables
cp .env.tpl .env
```

The individual packages may have additional setup instructions, and include specific usage information. You are also encouraged to set up your IDE with linting and formatting to ensure your commits can be merged.

### VS Code config

To install the recommended extensions, if you're not prompted automatically, run `Extensions: Show Recommended Extensions`. In particular, make sure you install [Workspace Config+](https://marketplace.visualstudio.com/items?itemName=Swellaby.workspace-config-plus), which merges the shared config with any local config to produce the workspace settings.

To override any settings locally, but specifically in this repo, create a `.vscode/settings.local.json` file. For more information, see the [`.vscode` README](./.vscode/README.md).

## Running tasks

Use `nx` to run a task within a project. This ensures that dependency tasks run first. `nx` is installed with `pnpm`, so it typically must be run as `pnpm nx`. This zsh/bash function will make it work as just `nx`; in a `pnpm` repo it will call `pnpm nx`, and elsewhere it will attempt to call the global `nx`. Add it to your `.zshrc`/`.bashrc` to use it.

```sh
nx() {
  if [[ -f pnpm-lock.yaml ]]; then
    pnpm nx "$@"
  else
    command nx "$@"
  fi
}
```

Some examples of useful things to run:

```sh
# Build a single package
nx build @storacha/ui-react
# ...or, equivalently
nx run @storacha/ui-react:build

# Build all packages
nx run-many -t build

# Run tests on anything that's changed in the current branch
nx affected -t test

# Lint everything whenever files change
nx watch --all -- nx run-many -t lint

# Run a set of tasks to the first failure whenever files change
scripts/nx-watch-run typecheck lint build test

# Reset the cache and kill the nx daemon.
# Ideally never necessary, but a good first step if anything looks wrong.
nx reset
```

## Release Process

We automate our CHANGELOG generation, the creation of GitHub releases, and version bumps for our packages using [Nx's Release feature](https://nx.dev/recipes/nx-release/get-started-with-nx-release) and some custom scripting. We use [version plans](https://nx.dev/recipes/nx-release/file-based-versioning-version-plans) to track what's changed in each package. Here's how the workflow works:

1. While you're on a feature branch, if your feature is something that needs to be released in a new version (that is, it's not just changes to, say, documentation or the test runner), run `nx release plan`.
2. Nx will notice what packages have been affected by your changes and ask you what kind of version bump is required. Then it'll ask for a changelog message. From that, it'll create a version plan file. Commit that and include it as part of your PR.
3. When a PR is merged which includes a version plan, a release PR will be automatically opened to move the changelog entries into the changelogs and release the new versions. That PR will update as more features are merged to roll up all pending changes. It'll also bump any packages which depend on changed packages to point to the latest version.
4. When _that_ PR is merged, those new versions will be published, and releases will be added to the GitHub repo.

Note that there's a single release PR for all packages in the repo (or no PR, if there's nothing to publish right now). This ensures that we always publish the versions that depend on one another all together.

### How do we define our version bumps?

We use [SemVer](https://semver.org/) for our versioning scheme. Quoting from there:

> Given a version number MAJOR.MINOR.PATCH, increment the:
>
> 1. MAJOR version when you make incompatible API changes
> 2. MINOR version when you add functionality in a backward compatible manner
> 3. PATCH version when you make backward compatible bug fixes

That is, if package depends on another package's version `2.3.4`, the first package should:

1. Be able to use any version `2.3.x` without changes to its code, though earlier releases may be buggier than later ones.
2. Be able to use any version `2.x.y` without changes to its code _as long as `x` is at least `3`_, because it depends on features that were released in `2.3` and weren't available in `2.2`.
3. _Not_ know whether it can use any version that doesn't start with `2` without changing its code. Version `1` and version `3` may have completely incompatible APIs.

The release system will always create the smallest correct version bump. So, if a package is currently at `2.3.4`, given three `minor` changes, it would bump to `2.4.0`, rolling all three into a single minor-version bump. But given those three `minor` changes _and_ a `major` (ie, breaking) change, it would bump to `3.0.0`.

Nx Release also offers prerelease bumps (the `pre*` options). These begin a series of prereleases leading up to a major, minor, or patch release. As of this writing, we don't use these, but they're available to us if they become useful in the future.
