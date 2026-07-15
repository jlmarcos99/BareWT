---
"barewt": patch
---

Fix `EPERM` errors from `bwt link` on Windows: directories are now linked as junctions (no privileges required), and file symlinks fall back to hard links when symlink creation is not permitted.
