# AE Local Toolkit V1 Development Plan

## Product Direction

AE Local Toolkit is an offline After Effects extension for AE 2020 and newer. V1 focuses on three local-first modules:

- Project Organizer
- Expression Manager
- Changelog and Settings

The extension should stay quiet during normal work. It only asks for confirmation before important operations such as overwriting existing expressions or removing expressions.

## V1 Scope

### Project Organizer

Preset folders:

| Folder | Match rules |
| --- | --- |
| Comp | `CompItem` |
| Image | `JPEG`, `JPG`, `PNG`, `TIFF`, `GIF`, `BMP`, `SWF`, `EXR`, `WEBP` |
| Video | `AVI`, `MP4`, `MOV`, `MPEG2`, `MKV`, `M4V`, `WEBM` |
| Audio | `MP3`, `WAV`, `AIFF`, `AAC`, `FLAC` |
| PSD | `PSD`, `PSB` |
| Live2D | `CAE` |
| 3D | `OBJ`, `FBX`, `GLTF` |
| Solids | `SolidSource` |
| Footage | fallback for unmatched footage |

V1 behavior:

- Create missing target folders.
- Move all non-folder project items to the root first, then classify them.
- Skip folders during classification.
- Do not rename items.
- Do not delete footage.
- Remove empty folders after organizing.
- Return a short summary.

### Expression Manager

V1 behavior:

- Apply custom expression text to all selected properties.
- Apply a selected saved expression to all selected properties.
- Remove expressions from selected properties.
- Confirm before overwriting existing expressions.
- Confirm before removing expressions.
- Skip unsupported properties.
- Wrap batch operations in AE undo groups.
- Keep the expression library local.

Library behavior:

- Built-in expressions are shipped with the extension.
- User expressions are stored locally.
- Users can create, edit, delete, favorite, and search expressions.
- No network access is used.

### Script Launcher Integration (v0.2.1)

### Technical Notes

- AEScriptsBox.jsx (rd_ScriptLauncher 2.5) was fully refactored from ~495 lines to ~120 lines before integration.
- The launcher host logic (scanScripts, launchScript) was initially in a separate module (host/modules/launcher.jsx)
  but was inlined into host/index.jsx to avoid $.evalFile scope uncertainty and UTF-8 BOM parsing issues in ExtendScript.
- Path encoding for evalScript: sName is encoded via encodeURI() on the client (producing pure ASCII),
  then decoded via decodeURI() on the host before 
ew File().
- Double-click uses direct ondblclick DOM property binding (not event delegation)
  to work around CEP event bubbling quirks.
- Favorites and folder path persisted via localStorage.
- PNG icon detection uses File(fsName.replace(...)).exists on the host; the icon path is returned as a
  ile:/// URL for direct use in <img> tags within the CEP panel.

### Key Files Changed

- host/index.jsx — inlined launcher module, added AELT_selectScriptFolder, AELT_scanScripts, AELT_launchScript
- client/index.html — added scripts tab and view
- client/app.js — added script scanning, rendering, search, favorites, filter toggle
- client/styles.css — added script list items, icon display, favorites filter toggle styles

## Changelog


V1 behavior:

- Show local changelog entries.
- Show current version.
- Keep future update notes local.

## Architecture

```text
AeLocalToolkit/
  CSXS/
    manifest.xml
  client/
    index.html
    styles.css
    app.js
  data/
    changelog.json
    default-expressions.json
    organizer-rules.json
  host/
    index.jsx
    modules/
      organizer.jsx
      expressions.jsx
      storage.jsx
  docs/
    install.md
```

## Development Milestones

| Phase | Tasks | Status |
| --- | --- | --- |
| 1. Planning | Confirm AE 2020+ target, offline behavior, organizer rules, expression scope | Done |
| 2. Scaffold | Create CEP folder structure, manifest, panel UI, host JSX entry | Done |
| 3. Organizer | Port and clean existing organizer logic, return summary data | Done (v0.1.2) |
| 4. Expressions | Build batch add/remove JSX APIs and local expression library UI | Done (v0.1.2) |
| 5. Changelog | Add local changelog view | Done (v0.1.2) |
| 6. Settings | Add quiet mode, expression library import/export, rule config placeholder | Done (v0.1.3) |
| 7. Verification | Test in AE 2020+ and prepare install notes | Done (v0.1.3) |
| 8. Script Launcher | Port script scanning/launching from AEScriptsBox.jsx, add search/favorites | Done (v0.2.1) |

## Notes From Existing JSX

The previous script already contains useful logic:

- Preset `folderConfig`.
- Creating folders before classification.
- Moving items to the root before sorting.
- Avoiding `forEach` for better ExtendScript compatibility.
- Batch expression overwrite checks.
- Batch expression removal with undo support.

The new version will preserve those ideas while moving UI and data into a maintainable panel structure.

## Script Launcher Integration (v0.2.1)

### Technical Notes

- AEScriptsBox.jsx (rd_ScriptLauncher 2.5) was fully refactored from ~495 lines to ~120 lines before integration.
- The launcher host logic (scanScripts, launchScript) was initially in a separate module (host/modules/launcher.jsx)
  but was inlined into host/index.jsx to avoid $.evalFile scope uncertainty and UTF-8 BOM parsing issues in ExtendScript.
- Path encoding for evalScript: sName is encoded via encodeURI() on the client (producing pure ASCII),
  then decoded via decodeURI() on the host before 
ew File().
- Double-click uses direct ondblclick DOM property binding (not event delegation)
  to work around CEP event bubbling quirks.
- Favorites and folder path persisted via localStorage.
- PNG icon detection uses File(fsName.replace(...)).exists on the host; the icon path is returned as a
  ile:/// URL for direct use in <img> tags within the CEP panel.

### Key Files Changed

- host/index.jsx — inlined launcher module, added AELT_selectScriptFolder, AELT_scanScripts, AELT_launchScript
- client/index.html — added scripts tab and view
- client/app.js — added script scanning, rendering, search, favorites, filter toggle
- client/styles.css — added script list items, icon display, favorites filter toggle styles

## Changelog


### v0.2.1 (2026-07-05)

- **Feature**: Script launcher — browse and run AE scripts from the panel.
- **Feature**: Favorite scripts — star markers persist across sessions.
- **Feature**: Favorites filter toggle — show only favorited scripts.
- **Feature**: Script search — real-time filtering by name or path.
- **Feature**: PNG icon display — shows script-associated icons when available.
- **Refactor**: AEScriptsBox.jsx fully rewritten (495 → 120 lines).
- **Bug fix**: Chinese script names correctly displayed (was URL-encoded in ExtendScript File.name).
- **Bug fix**: Double-click launching not working (CEP evalScript Unicode encoding + event delegation issues).
- **Bug fix**: Icon overlapping with text in script list layout.
- **Bug fix**: Script list scrollbar affecting entire view; now limited to script area only.

### v0.1.2 (2026-06-23)

- **Bug fix**: Editing the default scheme no longer auto-creates a new scheme ID.
- **Bug fix**: A new ID is only generated when saving the default scheme; the original preset stays pristine.
- **Bug fix**: Switching back to the default scheme restores the original preset rules from the built-in fallback.
- **Feature**: Toast notification system — success/error messages slide in from the top and auto-dismiss after 1 second.
- **Feature**: Changelog modal — click the version number in the top bar to view update history.
- **Feature**: Expression manager — preset list changed from buttons to a `<select>` dropdown for a more compact UI.
- **Feature**: Organizer UI compact layout — rule items now use a header row with a Unicode delete icon (✖), checkbox toggles for file type and AE type controls, side-by-side layout for the two criteria columns, and internal scrolling (3-rule default height).
- **Bug fix**: Added error toast notifications for preset deletion, duplicate type validation, expression errors, and storage failures.

### v0.2.0 (2026-06-22)

- Project organizer multi-scheme management.
- Scheme save/delete as local JSON files.
- Folder rules support nested paths.
- Duplicate extension and AE type validation on save.

### v0.1.1 (2026-06-22)

- Built-in data fallback for CEP JSON load failures.
- Fixed custom expression display after data load failure.
- Debug page storage test button.
- Expression save/delete storage logging.

### v0.1.0 (2026-06-22)

- Initial project structure.
- Preset organizer rules.
- Expression manager first-pass planning.
- Changelog data structure.

## Next Development Tasks

1. ~~Install the panel into AE and verify CEP loading.~~ (v0.1.3 已测试)
2. ~~Test project organizing on a copied AE project.~~ (v0.1.3 已测试)
3. ~~Test expression apply/remove on transform, effect, text, and shape properties.~~ (v0.1.3 已测试)
4. ~~Add expression edit flow for saved user expressions.~~ (v0.1.3 已完成)
5. Add import/export for the local expression library. (推迟)
6. ~~Add a settings view for quiet mode and future custom organizer rules.~~ (v0.1.3 已完成)
7. ~~Host module splitting.~~ (v0.1.3 已完成)
8. ~~Script launcher module.~~ (v0.2.1 已完成)
9. 修复: 表达式下拉选择框在自定义表达式过多时过长。 (待办)

### v0.1.3 (2026-06-23)

- **Feature**: Settings view with quiet mode toggle.
- **Feature**: Expression edit flow — update saved custom expressions.
- **Refactor**: Host module splitting — organizer and expressions logic moved to host/modules/.
- **Bug fix**: Modifying default organizer scheme now creates a new scheme entry while preserving the original default.
- **Bug fix**: Expression "Update Expression" button visibility based on selection.
