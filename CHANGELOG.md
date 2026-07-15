# barewt

## 0.1.1

### Patch Changes

- f522ee4: Fix `EPERM` errors from `bwt link` on Windows: directories are now linked as junctions (no privileges required), and file symlinks fall back to hard links when symlink creation is not permitted.

## 0.1.0

### Minor Changes

- a1db914: First release of barewt, a CLI for managing git worktrees with the bare clone pattern.

  Includes the `bwt` command with:

  - `init` — interactive wizard to set up a new project
  - `clone` — create a bare clone of a repository
  - `add` — add a worktree for a branch, or create a new branch from an origin
  - `list` — list all active worktrees
  - `remove` — remove a worktree (keeps the branch)
  - `wipe` — interactively select and remove worktrees
  - `prune` — remove orphan worktrees whose branches were deleted on origin
  - `link` / `unlink` — share paths across worktrees via symlinks
  - `protect` / `unprotect` — shield branches from prune/wipe

  All commands have short aliases (`c`, `a`, `l`, `r`, ...).
