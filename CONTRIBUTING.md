# Contributing to Totem

Thanks for your interest in contributing!

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.

## Development Setup

**Prerequisites:** Go 1.24+, Node.js 24+, pnpm, [mise](https://mise.jdx.dev/)

```bash
git clone https://github.com/inceptyon-labs/totem.git
cd totem
git config core.hooksPath .githooks   # activate secret-scanning pre-commit hook
mise trust && mise setup              # install deps + generate code
```

**Run the dev environment:**
```bash
mise dev    # backend :22880, frontend :5173, hot-reload
```

**Run tests:**
```bash
mise test        # Go unit tests
mise test:e2e    # Playwright end-to-end tests
```

## Making Changes

- **GraphQL schema changes:** edit `internal/graph/schema.graphqls`, then run `mise codegen`
- **Frontend GraphQL operations:** update `frontend/src/lib/graphql/operations.graphql`, run `mise codegen`. Do not use inline `gql` strings.
- **CLI commands:** see `internal/commands/`

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add external ref field to totem frontmatter
fix: resolve race condition in worktree watcher
docs: update CONTRIBUTING.md
test: add table-driven tests for bean sorting
```

Mark breaking changes with `!`: `feat!: rename GraphQL field bean → totem`

## Pull Requests

1. Fork and create a feature branch from `main`
2. Write or update tests for your changes
3. Ensure the full test suite passes (`mise test && mise test:e2e`)
4. Open a PR — reference any related issues in the description

## Reporting Issues

Use [GitHub Issues](https://github.com/inceptyon-labs/totem/issues). Bug reports should include:

- Totem version (`totem --version`)
- OS and Go version
- Steps to reproduce
- Expected vs. actual behavior
