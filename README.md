# Totem

<p align="center">
  <img src="assets/logo-gpt2.png" alt="Totem logo" height="120" />
</p>

[![License](https://img.shields.io/github/license/inceptyon-labs/totem?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/inceptyon-labs/totem?style=for-the-badge)](https://github.com/inceptyon-labs/totem/releases)
[![Go Version](https://img.shields.io/github/go-mod/go-version/inceptyon-labs/totem?style=for-the-badge)](https://go.dev/)
[![CI](https://img.shields.io/github/actions/workflow/status/inceptyon-labs/totem/test.yml?style=for-the-badge&label=ci)](https://github.com/inceptyon-labs/totem/actions/workflows/test.yml)

**Totem is a lightweight, flat-file issue tracker built for AI-agent workflows.**

Each issue is a markdown file — a *totem* — checked into the repo alongside the code it describes. Agents create and update totems at the speed of code edits, without the overhead of a heavyweight tracker. When you need portfolio-level visibility, many totems roll up to Jira for project, portfolio, and initiative tracking.

Use it through:
- **`totem`** — CLI for create, list, update, show, query
- **`totem-tui`** — interactive terminal UI
- **`totem-serve`** — local web UI with GraphQL API, real-time updates, and worktree management

## Why Totem

- **Agent-native.** Coding agents read, create, and update totems from CLI or GraphQL at edit speed. No web forms, no SaaS round-trips, no JQL.
- **Lightweight.** No database, no SaaS account. A `.totem/` directory and you're done.
- **Git-native.** Markdown in git means every change is attributed, diffable, and version-controlled alongside the code it describes.
- **Rolls up to your PM stack.** Tag totems with external IDs (Jira, Linear, GitHub Issues). Companion tools like [PASIV](https://github.com/inceptyon-labs/pasiv) push completions to your tracker for project, portfolio, and initiative visibility — Totem itself stays stack-agnostic.

## Status

Totem is early-stage. Schema and APIs may change as we iterate.

## Installation

Once releases are published to the Inceptyon Labs Homebrew tap:

```bash
brew tap inceptyon-labs/tap
brew install totem
```

Or build from source:

```bash
git clone https://github.com/inceptyon-labs/totem.git
cd totem
mise trust && mise setup
mise build
mise install   # copies binaries to ~/.local/bin
```

## Quick Start

```bash
cd your-project
totem init                          # creates .totem/ and .totem.yml
totem create "Fix login bug" -t bug
totem list
totem-tui                           # interactive browser
totem-serve                         # web UI at http://localhost:8080
```

## Configuration

`totem init` creates a `.totem.yml` at the project root. See the file for inline comments on each setting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please review our [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md) before opening issues or PRs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for attribution.
