# Totem

[![License](https://img.shields.io/github/license/inceptyon-labs/totem?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/inceptyon-labs/totem?style=for-the-badge)](https://github.com/inceptyon-labs/totem/releases)
[![Go Version](https://img.shields.io/github/go-mod/go-version/inceptyon-labs/totem?style=for-the-badge)](https://go.dev/)

**Totem is a lightweight, flat-file issue tracker built for teams that need an audit trail but don't want Jira.**

Each issue is a markdown file — a *totem* — checked into the repo alongside the code it describes. Every change is a git commit: attributed, signed, immutable, diffable. The audit trail comes for free.

Use it through:
- **`totem`** — CLI for create, list, update, show, query
- **`totem-tui`** — interactive terminal UI
- **`totem-serve`** — local web UI with GraphQL API, real-time updates, and worktree management

## Why Totem

- **Audit-trail-first.** Markdown in git = signed, attributed, immutable history. No separate audit log to manage.
- **Lightweight.** No database, no SaaS account, no JQL. A `.totem/` directory and you're done.
- **Agent-native.** Your coding agents can read the totems, propose new ones, and update status from CLI or GraphQL.
- **Optional rollup.** Configure a Jira connector to summarize many totems into a single Jira epic — bridge to your existing PM stack without dragging it into the codebase.

## Status

Totem is an early-stage fork of the excellent [hmans/beans](https://github.com/hmans/beans), rebranded and aimed at corporate/audit use cases. Schema and APIs may change as we iterate.

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

## Credits

Totem is a fork of [hmans/beans](https://github.com/hmans/beans) by Hendrik Mans. The original project is licensed under Apache-2.0; this fork retains the same license. Branding, scope, and direction differ — see [NOTICE](NOTICE) for attribution details.

## License

Apache-2.0. See [LICENSE](LICENSE).
