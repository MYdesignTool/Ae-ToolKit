# Architecture Notes

## Local-Only Principle

The panel does not call remote APIs. V1 data lives in:

- Shipped JSON files under `data/`
- Browser `localStorage` for user-created expressions
- AE project state through host JSX calls

## Runtime Layers

| Layer | Path | Purpose |
| --- | --- | --- |
| CEP manifest | `CSXS/manifest.xml` | Registers the AE panel |
| Panel UI | `client/` | Renders the interface and stores user expressions |
| AE host script | `host/index.jsx` | Runs ExtendScript inside After Effects |
| Data | `data/` | Stores default rules, default expressions, changelog |
| Docs | `docs/` | Install and architecture notes |

## Host API

The panel calls these global JSX functions:

- `AELT_organizeProject()`
- `AELT_getSelectedPropertySummary()`
- `AELT_applyExpression(expression, overwriteExisting)`
- `AELT_removeExpressions()`

Each function returns a JSON string with a short result summary.

## Extension Points

V1 keeps host logic in `host/index.jsx` to avoid CEP and ExtendScript include path issues during early testing. After the panel is stable in AE, modules can be split again with a build step or a proven include loader.

Future modules should follow this pattern:

1. Add JSX logic to `host/index.jsx` or bundle it into that file.
2. Expose one small `AELT_*` function.
3. Call it from `client/app.js`.
4. Show raw returns in the Debug panel while testing.
5. Store default data in `data/` if needed.
