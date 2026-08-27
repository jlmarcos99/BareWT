---
"barewt": minor
---

Fix `wipe` leaving folders behind and aborting on the first failure (now double `--force`, cleans leftovers, and asks to skip or cancel per failure). `add` now fetches origin and fast-forwards the new worktree so it is not created stale. Fix broken symlinks for nested linked paths. `link`/`unlink` now manage `permission.external_directory` entries in the project `opencode.json` so opencode stops asking to read linked content.
