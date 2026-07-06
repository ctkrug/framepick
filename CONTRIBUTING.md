# Contributing to Framepick

Thanks for taking a look. Framepick is a small, dependency-light, client-side app — the barrier
to contributing is low.

## Setup

```bash
git clone https://github.com/ctkrug/framepick.git
cd framepick
npm test            # pure-logic suite (node --test), no browser needed
npm run serve       # static server on http://localhost:8000
```

WebCodecs is required to run the app in the browser (recent Chrome/Edge/Safari).

## Ground rules

- **Keep the two layers separate.** Correctness logic goes in `src/lib/` as pure, framework-free
  functions with tests. `src/` is thin browser glue over that core. See `docs/ARCHITECTURE.md`.
- **Add a test with every `src/lib/` change.** The pure layer must stay fully covered.
- **Follow the design system.** UI work matches `docs/DESIGN.md` — tokens, type, themed control
  states, responsive at 390/768/1440. No unstyled native controls.
- **Work the backlog.** Pick a story in `docs/BACKLOG.md` and satisfy its acceptance criteria.
- **Commits:** conventional-commit subjects (`feat(scope): …`) with a short body explaining the
  why for non-trivial changes. One atomic change per commit.

## Before you open a PR

- `npm test` is green.
- The linked story's acceptance criteria pass.
- No secrets committed; no `Co-Authored-By`/AI-mention trailers.
