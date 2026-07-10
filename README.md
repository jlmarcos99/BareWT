# barewt (`bwt`)

CLI para trabajar con git worktrees usando el patrón de bare clone. Clona solo el repositorio (sin working directory) y permite crear worktrees por rama de forma simple.

## Instalación

```bash
npm install -g barewt
```

## Flujo de trabajo

El patrón es:

```
mi-proyecto.git/        ← bare clone (solo .git, sin archivos)
├── main/               ← worktree de la rama main
├── feature/login/      ← worktree de feature/login
└── fix/crash/          ← worktree de fix/crash
```

Cada rama vive en su propia carpeta. No hay `git stash`, no hay cambio de rama, cada worktree es independiente.

## Comandos

### `bwt clone <repo> [nombre]`

Hace un bare clone del repositorio.

```bash
bwt clone git@github.com:usuario/mi-proyecto.git
# crea: mi-proyecto.git/

bwt clone git@github.com:usuario/mi-proyecto.git trabajo
# crea: trabajo.git/
```

### `bwt add <rama>`

Crea un worktree para la rama especificada. Se ejecuta dentro de la carpeta del bare clone.

```bash
cd mi-proyecto.git
bwt add main
# crea: ../mi-proyecto/main/

bwt add feature/login
# crea: ../mi-proyecto/feature/login/

bwt add fix/crash --new
# crea la rama nueva y su worktree
```

### `bwt list`

Lista todos los worktrees activos del repositorio.

```bash
cd mi-proyecto.git
bwt list
```

```
  main          abc1234  ../mi-proyecto/main
  feature/login def5678  ../mi-proyecto/feature/login
```

### `bwt remove <rama>`

Elimina el worktree de una rama (no elimina la rama en sí).

```bash
cd mi-proyecto.git
bwt remove feature/login
```

## Opciones globales

| Flag | Descripción |
|------|-------------|
| `--version` | Muestra la versión |
| `--help` | Muestra ayuda |

## Posibles evolutivos (v2)

### `bwt init [url]`

Wizard interactivo de arranque de un proyecto nuevo. Convive con `bwt clone` (el camino rápido de un solo paso); `init` es el camino guiado que orquesta `clone`, `add` y `link`.

```
$ bwt init
? URL del repositorio › git@github.com:equipo/mi-proyecto.git
? Nombre de la carpeta › (mi-proyecto)
✔ Bare clone creado, ramas remotas obtenidas
? Rama principal detectada: main. ¿Crear su worktree? › (Y/n)
? ¿Worktrees de otras ramas? › (multiselect con las ramas remotas)
? ¿Rutas compartidas entre worktrees (no se suben al repo)? › openspec, .env, otra…
✔ mi-proyecto.git/  +  mi-proyecto/main/  +  link openspec
```

Comportamiento:

- El clone ocurre a mitad del wizard: el fetch permite ofrecer un multiselect de ramas reales en vez de un campo de texto a ciegas.
- La rama principal se detecta vía `HEAD` remoto (`main`/`master`).
- El paso de rutas compartidas delega en `bwt link` (symlinks + `info/exclude` + config local). No ejecuta herramientas de terceros (no lanza `openspec init` ni similares).
- Si la carpeta destino ya existe, aborta con error claro antes de clonar.
- Flags espejo para modo no interactivo: `bwt init <url> --name trabajo --branch main --link openspec --yes`. Con `--yes`, las preguntas sin flag toman su default; sin TTY y sin `--yes`, falla explicando qué falta.
- Cancelación a mitad (Ctrl+C tras el clone): el bare clone se conserva y se indica cómo continuar con los comandos atómicos. Un init interrumpido nunca deja un estado que `clone`/`add`/`link` no puedan completar.
- Prompts con `@inquirer/prompts`.

### `bwt prune`

Limpieza de worktrees huérfanos: aquellos cuya rama ya fue eliminada en origin (el `[gone]` de git), típicamente tras mergear un PR. Se ejecuta dentro del bare clone.

```
$ cd mi-proyecto.git
$ bwt prune
✔ fetch --prune ejecutado
Worktrees candidatos:
  feature/login   [rama eliminada en origin]   ../mi-proyecto/feature/login
  fix/crash       [rama eliminada en origin]   ../mi-proyecto/fix/crash  ⚠ cambios sin commitear
? ¿Eliminar feature/login? (Y/n)
✘ fix/crash omitido (working tree sucio, usa --force)
✔ 1 worktree y su rama local eliminados
```

Comportamiento:

- Empieza con `git fetch --prune` para detectar contra el estado real del remoto.
- Criterio de candidato: **upstream desaparecido**, no "rama mergeada" (la detección de merges falla con squash-merge; la desaparición del upstream es inequívoca y cubre también ese caso).
- Elimina el worktree **y la rama local** (las dos mitades del huérfano). `--keep-branches` para conservar las ramas.
- Nunca toca worktrees sucios (cambios sin commitear o commits sin respaldo remoto): los lista como omitidos y exige `--force`.
- Ignora por completo los worktrees de ramas nunca pusheadas: son trabajo en curso, para eso existe `bwt remove`.
- El worktree de la rama principal es intocable.
- Recoge también basura administrativa: `git worktree prune` para metadata de worktrees borrados a mano, y carpetas intermedias vacías (`feature/` tras eliminar `feature/login`).
- `--dry-run` muestra la lista sin tocar nada; `--yes` elimina sin confirmar uno a uno.

### `bwt link <ruta>`

Rutas compartidas entre worktrees: registra una carpeta o archivo que vive en la raíz del proyecto (fuera del repo) y que cada worktree ve mediante symlink. Pensado para artefactos personales que no deben subirse al repositorio: `openspec/`, `.env`, notas, caches.

```
mi-proyecto.git/          ← bare clone
mi-proyecto/
├── openspec/             ← real, único, compartido
├── main/
│   └── openspec → ../openspec
└── feature/login/
    └── openspec → ../../openspec
```

```bash
cd mi-proyecto.git
bwt link openspec
# registra la ruta en la config del bare clone
# y crea el symlink en los worktrees existentes

bwt link --sync
# recrea symlinks que falten (p. ej. tras un git clean)
```

Comportamiento:

- `bwt add` crea automáticamente los symlinks de todas las rutas registradas en cada worktree nuevo.
- La ruta se añade a `<bare>.git/info/exclude`, que aplica a todos los worktrees y **nunca se commitea**: no hay rastro ni en `.gitignore` ni en `git status`.
- La config se guarda en el bare clone (`git config --local`), por lo que es por proyecto y no viaja con el repositorio.

## Implementación técnica

- **Runtime**: Node.js 22.12+
- **CLI**: `commander`
- **Git**: `execa` llamando a git directamente
- **Distribución**: npm con campo `bin` en `package.json`

El bare clone equivale a:

```bash
git clone --bare <repo> <nombre>.git
cd <nombre>.git
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch --all
```

Y `bwt add <rama>` equivale a:

```bash
git worktree add ../<proyecto>/<rama> <rama>
```
