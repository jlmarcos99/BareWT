# barewt (`bwt`)

[English](README.md)

CLI para trabajar con git worktrees usando el patrón de bare clone. Clona una vez, trabaja en múltiples ramas simultáneamente — cada una en su propia carpeta. Sin cambiar de rama, sin stashing.

**Diseñado para agentes de IA.** barewt da a cada sesión de IA su propio worktree limpio con contexto independiente, compartido a través de rutas enlazadas como `openspec/`. Tu agente de IA crea worktrees, tú cambias entre ellos, y `bwt prune` limpia después de mergear los PRs.

## Instalación

```bash
npm install -g barewt
```

## Flujo de trabajo

```
proyecto/
├── .git/               ← bare clone (solo el repo, sin working tree)
├── main/               ← worktree de main
├── feature/login/      ← worktree de feature/login
└── fix/crash/          ← worktree de fix/crash
```

Cada rama vive en su propia carpeta junto a `.git/`. Cada worktree es independiente.

## Árbol de comandos

```
bwt
├── init [url]             i    -n, --name <dir>   -a, --auto
│     -a, --auto: totalmente automático. Clona el repo, crea un worktree
│     para la rama por defecto y la protege — sin hacer preguntas.
│
├── clone <repo> [name]    c
│     Crea un bare clone dentro de <name>/.git
│
├── add <branch>           a    -n, --new
│     Crea un worktree para una rama. --new crea la rama primero.
│
├── list                   l    -p, --protected   -u, --unprotected
│     Lista worktrees. --protected / --unprotected filtran por estado.
│
├── remove <branch>        r    -f, --force
│     Elimina un worktree (conserva la rama). --force ignora cambios.
│
├── prune                  p    -d, --dry-run   -y, --yes   -k, --keep-branches   -f, --force
│     Elimina worktrees cuya rama upstream fue borrada en origin.
│     --dry-run muestra qué pasaría. --keep-branches conserva ramas locales.
│     --force elimina incluso worktrees sucios.
│
├── wipe                   w
│     Selector interactivo con checkbox para eliminar worktrees.
│     Las ramas protegidas no aparecen.
│
├── protect <branch>       pt
│     Marca una rama como protegida (sobrevive a prune y wipe).
│
├── unprotect <branch>     up
│     Quita la protección a una rama.
│
├── link [ruta]            lk   -s, --sync
│     Comparte una carpeta/archivo de la raíz en todos los worktrees vía symlinks.
│     Sin argumentos, lista las rutas registradas. -s, --sync recrea symlinks perdidos.
│
└── unlink <ruta>          ul
      Elimina un symlink compartido de todos los worktrees y lo desregistra.
```

## Comandos

### `bwt init [url]` (alias `i`)

Wizard interactivo para arrancar un proyecto desde cero.

```
$ bwt init
? Repository URL › git@github.com:equipo/repo.git
? Project folder name › (repo)
Cloned into repo/.git

Las ramas protegidas nunca se borran con prune ni wipe.
? Protect a branch (name, or Enter to finish) › develop

Created worktree for develop
Created worktree for main
? Add another worktree (name, or Enter to finish) › (Enter)

Summary:
  Worktrees: develop, main
  Protected: develop, main

Ready! cd repo/.git to get started
```

### `bwt clone <repo> [nombre]` (alias `c`)

Crea un bare clone dentro de una carpeta `.git`.

```bash
bwt clone git@github.com:usuario/repo.git
# crea: repo/.git/

bwt clone git@github.com:usuario/repo.git mi-proyecto
# crea: mi-proyecto/.git/
```

### `bwt add <rama>` (alias `a`)

Crea un worktree para una rama. Se ejecuta dentro de `.git/`.

```bash
cd repo/.git
bwt add main                    # → ../main/
bwt add feature/login           # → ../feature/login/
bwt add fix/crash -n --new      # crea la rama antes del worktree
```

### `bwt list` (alias `l`)

Lista todos los worktrees activos.

```bash
cd repo/.git
bwt list
#   main          abc1234  ../main
#   feature/login def5678  ../feature/login

bwt list -p --protected     # solo worktrees protegidos
bwt list -u --unprotected   # solo worktrees no protegidos
```

### `bwt remove <rama>` (alias `r`)

Elimina un worktree (no borra la rama).

```bash
bwt remove feature/login
bwt remove fix/crash -f --force   # fuerza borrado aunque tenga cambios
```

### `bwt prune` (alias `p`)

Elimina worktrees huérfanos cuyas ramas fueron borradas en origin (tras mergear un PR).

```bash
bwt prune                         # elimina worktrees [gone] + ramas locales
bwt prune -d --dry-run            # muestra qué pasaría sin hacer nada
bwt prune -k --keep-branches      # elimina solo los worktrees
bwt prune -f --force              # incluso worktrees con cambios
```

Las ramas protegidas (ver `bwt protect`) nunca se eliminan.

### `bwt wipe` (alias `w`)

Selector interactivo para eliminar worktrees manualmente.

```
$ bwt wipe
Select worktrees to remove ›
  ◯ feature/login
  ◯ develop
```

Las ramas protegidas no aparecen en la lista.

### `bwt protect <rama>` / `bwt unprotect <rama>` (alias `pt` / `up`)

Marca o quita una rama como protegida. Las ramas protegidas sobreviven a `prune` y `wipe`.

```bash
bwt protect develop
bwt unprotect develop
```

### `bwt link [ruta]` (alias `lk`)

Comparte una carpeta o archivo entre todos los worktrees mediante symlinks. Sin argumentos, lista las rutas registradas.

```
proyecto/
├── .git/
├── openspec/             ← real, compartido entre todos los worktrees
├── main/
│   └── openspec → ../openspec
└── feature/login/
    └── openspec → ../../openspec
```

```bash
bwt link                      # lista las rutas enlazadas
bwt link openspec             # crea symlinks en todos los worktrees
bwt link --sync               # recrea symlinks que falten
```

Cada `bwt add` crea automáticamente los symlinks en los worktrees nuevos.

### `bwt unlink <ruta>` (alias `ul`)

Elimina el symlink de todos los worktrees y quita la ruta de la configuración.

```bash
bwt unlink openspec          # elimina symlinks y entrada de config
```

## Orquestación multiagente

barewt está diseñado para flujos de trabajo con agentes de IA en paralelo
usando Spec-Driven Development (SDD). Cada agente tiene su propio worktree
con una rama aislada, pero todos comparten un contexto global mediante
rutas enlazadas.

```
                   ┌──────────────────────┐
                   │   proyecto/.opencode/  │  ← estado global, tareas, specs SDD
                   │   proyecto/openspec/   │  ← specs compartidas (ruta enlazada)
                   └──────┬───────────────┘
                          │ symlink compartido
          ┌───────────────┼───────────────┐
          │               │               │
     ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
     │  main/  │    │ feat/A/ │    │ feat/B/ │
     │ agente 0│    │ agente 1│    │ agente 2│
     └─────────┘    └─────────┘    └─────────┘
```

### Por qué funciona

- **Contexto global.** Las rutas enlazadas (`.opencode/`, `openspec/`,
  `.cursor/rules`) dan a cada agente la misma vista de tareas, specs
  y reglas del proyecto — sin importar en qué rama estén.
- **Trabajo aislado.** Cada agente opera en su propio worktree con
  su propia rama. Nunca hay conflictos ni se pisan entre sí.
- **Listo para SDD.** `bwt link openspec` comparte las specs con todo
  el equipo. Propón en un worktree, revisa en otro, aplica en paralelo.
- **Ciclo limpio.** Mergea el PR → `bwt prune` elimina el worktree
  y la rama. Empieza la siguiente iteración desde un estado limpio.

### Uso

```bash
# 1. Configurar el proyecto con contexto compartido
bwt init git@github.com:equipo/proyecto.git
cd proyecto/.git
bwt link openspec           # specs SDD visibles para todos los agentes
bwt link .opencode          # tareas y estado de opencode
bwt link .cursor/rules      # reglas de IA para todos los agentes

# 2. Lanzar agentes en paralelo
bwt add feat/payment-api    # agente 1
bwt add feat/auth-refactor  # agente 2
bwt add fix/login-bug       # agente 3

# 3. Después de mergear, limpiar
bwt prune

# 4. Empezar la siguiente iteración
bwt add feat/next-feature
```

Cada worktree es un checkout completo e independiente. Los agentes
se ejecutan en paralelo sin interferencias.

## Atajos

| Comando | Alias | Flags cortos |
|---------|-------|-------------|
| `clone` | `c` | — |
| `add` | `a` | `-n --new` |
| `list` | `l` | `-p --protected`, `-u --unprotected` |
| `remove` | `r` | `-f --force` |
| `prune` | `p` | `-d --dry-run`, `-y --yes`, `-k --keep-branches`, `-f --force` |
| `wipe`  | `w` | — |
| `init`  | `i` | `-n, --name`, `-a --auto` |
| `protect` | `pt` | — |
| `unprotect` | `up` | — |
| `link` | `lk` | `-s --sync` |
| `unlink` | `ul` | — |

## Detalles técnicos

- **Runtime**: Node.js 22.12+
- **Dependencias**: `commander`, `execa`, `@inquirer/prompts`
- **Distribución**: binario npm (`bwt`)
- **Licencia**: MIT
