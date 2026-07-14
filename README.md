# barewt (`bwt`)

[Español](README.es.md)

CLI for git worktrees using the bare clone pattern. Clone once, work on multiple branches simultaneously — each in its own folder. No switching, no stashing.

**Designed for AI agents.** barewt gives each AI coding session its own clean worktree with independent context, shared through linked paths like `openspec/`. Your AI agent provisions worktrees, you switch between them, and `bwt prune` cleans up after merged PRs.

## Installation

```bash
npm install -g barewt
```

## Workflow

```
project/
├── .git/               ← bare clone (repo only, no working tree)
├── main/               ← worktree for main
├── feature/login/      ← worktree for feature/login
└── fix/crash/          ← worktree for fix/crash
```

Each branch lives in its own folder alongside `.git/`. Every worktree is independent.

## Command tree

```
bwt
├── init [url]             i    -n, --name <dir>   -a, --auto
│     -a, --auto: fully automated. Clones the repo, creates a worktree
│     for the default branch, and protects it — no questions asked.
│
├── clone <repo> [name]    c
│     Create a bare clone inside <name>/.git
│
├── add <branch>           a    -n, --new
│     Create a worktree for a branch. --new creates the branch first.
│
├── list                   l    -p, --protected   -u, --unprotected
│     List worktrees. --protected / --unprotected filter by status.
│
├── remove <branch>        r    -f, --force
│     Remove a worktree (keeps the branch). --force overrides dirty check.
│
├── prune                  p    -d, --dry-run   -y, --yes   -k, --keep-branches   -f, --force
│     Remove worktrees whose upstream branch was deleted on origin.
│     --dry-run shows what would happen. --keep-branches keeps local branches.
│     --force removes even dirty worktrees.
│
├── wipe                   w
│     Interactive checkbox selector to remove worktrees.
│     Protected branches are excluded.
│
├── protect <branch>       pt
│     Mark a branch as protected (survives prune and wipe).
│
├── unprotect <branch>     up
│     Remove protection from a branch.
│
├── link [path]            lk   -s, --sync
│     Share a folder/file from project root into all worktrees via symlinks.
│     Without arguments, lists registered paths. -s, --sync recreates missing symlinks.
│
└── unlink <path>          ul
      Remove a shared symlink from all worktrees and unregister it.
```

## Commands

### `bwt init [url]` (alias `i`)

Interactive wizard to set up a new project from scratch.

```
$ bwt init
? Repository URL › git@github.com:user/repo.git
? Project folder name › (repo)
Cloned into repo/.git

Protected branches are never deleted by prune or wipe.
? Protect a branch (name, or Enter to finish) › develop

Created worktree for develop
Created worktree for main
? Add another worktree (name, or Enter to finish) › (Enter)

Summary:
  Worktrees: develop, main
  Protected: develop, main

Ready! cd repo/.git to get started
```

### `bwt clone <repo> [name]` (alias `c`)

Creates a bare clone inside a `.git` folder.

```bash
bwt clone git@github.com:user/repo.git
# creates: repo/.git/

bwt clone git@github.com:user/repo.git my-project
# creates: my-project/.git/
```

### `bwt add <branch>` (alias `a`)

Creates a worktree for a given branch. Run from inside `.git/`.

```bash
cd repo/.git
bwt add main                    # → ../main/
bwt add feature/login           # → ../feature/login/
bwt add fix/crash -n --new      # creates the branch first
```

### `bwt list` (alias `l`)

Lists all active worktrees.

```bash
cd repo/.git
bwt list
#   main          abc1234  ../main
#   feature/login def5678  ../feature/login

bwt list -p --protected     # only protected worktrees
bwt list -u --unprotected   # only unprotected worktrees
```

### `bwt remove <branch>` (alias `r`)

Removes a worktree (does not delete the branch).

```bash
bwt remove feature/login
bwt remove fix/crash -f --force   # even with uncommitted changes
```

### `bwt prune` (alias `p`)

Removes orphan worktrees whose branches were deleted on origin (after merging a PR).

```bash
bwt prune                         # removes [gone] worktrees + local branches
bwt prune -d --dry-run            # shows what would happen
bwt prune -k --keep-branches      # removes worktrees only
bwt prune -f --force              # even dirty worktrees
```

Protected branches (see `bwt protect`) are never removed.

### `bwt wipe` (alias `w`)

Interactive selector to remove worktrees manually.

```
$ bwt wipe
Select worktrees to remove ›
  ◯ feature/login
  ◯ develop
```

Protected branches are excluded from the list.

### `bwt protect <branch>` / `bwt unprotect <branch>` (aliases `pt` / `up`)

Mark or unmark a branch as protected. Protected branches survive `prune` and `wipe`.

```bash
bwt protect develop
bwt unprotect develop
```

### `bwt link [path]` (alias `lk`)

Shares a folder or file across all worktrees via symlinks. Without arguments, lists registered paths.

```
project/
├── .git/
├── openspec/             ← real, shared across all worktrees
├── main/
│   └── openspec → ../openspec
└── feature/login/
    └── openspec → ../../openspec
```

```bash
bwt link                      # list linked paths
bwt link openspec             # creates symlinks in all worktrees
bwt link --sync               # recreates missing symlinks
```

Each `bwt add` automatically creates symlinks for all linked paths in new worktrees.

### `bwt unlink <path>` (alias `ul`)

Removes the symlink from all worktrees and unregisters the path.

```bash
bwt unlink openspec          # removes symlinks and config entry
```

## Multi-agent orchestration

barewt is purpose-built for parallel AI agent workflows using
Spec-Driven Development (SDD). Each agent gets its own worktree
with an isolated branch, but all share a global context through
linked paths.

```
                   ┌──────────────────────┐
                   │   project/.opencode/  │  ← global state, tasks, SDD specs
                   │   project/openspec/   │  ← shared specs (linked path)
                   └──────┬───────────────┘
                          │ shared symlink
          ┌───────────────┼───────────────┐
          │               │               │
     ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
     │  main/  │    │ feat/A/ │    │ feat/B/ │
     │ agent 0 │    │ agent 1 │    │ agent 2 │
     └─────────┘    └─────────┘    └─────────┘
```

### Why it works

- **Global context.** Linked paths (`.opencode/`, `openspec/`,
  `.cursor/rules`) give every agent the same view of tasks, specs,
  and project rules — no matter which branch they're on.
- **Isolated work.** Each agent works in its own worktree with
  its own branch. They never conflict or overwrite each other.
- **SDD-ready.** `bwt link openspec` shares specs across the whole
  team. Propose in one worktree, review in another, apply in parallel.
- **Clean lifecycle.** Merge the PR → `bwt prune` removes the
  worktree and branch. Start the next iteration from a clean state.

### Usage

```bash
# 1. Set up the project with shared context
bwt init git@github.com:team/project.git
cd project/.git
bwt link openspec           # SDD specs visible to all agents
bwt link .opencode          # opencode tasks & state
bwt link .cursor/rules      # AI coding rules for all agents

# 2. Launch parallel agents
bwt add feat/payment-api    # agent 1
bwt add feat/auth-refactor  # agent 2
bwt add fix/login-bug       # agent 3

# 3. After merging, clean up
bwt prune

# 4. Start the next iteration
bwt add feat/next-feature
```

Each worktree is a complete, independent checkout. Agents run
in parallel with zero interference.

## Shortcuts

| Command | Alias | Short flags |
|---------|-------|-------------|
| `clone` | `c` | — |
| `add` | `a` | `-n --new` |
| `list` | `l` | `-p --protected`, `-u --unprotected` |
| `remove` | `r` | `-f --force` |
| `prune` | `p` | `-d --dry-run`, `-y --yes`, `-k --keep-branches`, `-f --force` |
| `wipe` | `w` | — |
| `init` | `i` | `-n, --name`, `-a --auto` |
| `protect` | `pt` | — |
| `unprotect` | `up` | — |
| `link` | `lk` | `-s --sync` |
| `unlink` | `ul` | — |

## Technical details

- **Runtime**: Node.js 22.12+
- **Dependencies**: `commander`, `execa`, `@inquirer/prompts`
- **Distribution**: npm binary (`bwt`)
- **License**: MIT
