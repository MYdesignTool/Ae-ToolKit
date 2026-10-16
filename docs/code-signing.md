# Code signing policy

## Current status

AE Local Toolkit is preparing an application for free open-source code signing through [SignPath Foundation](https://signpath.org/). Approval and signing integration are pending. The current Windows installer is **unsigned**; a successful CI build is not a code signature. No signed installer is offered yet.

If approved, free code signing will be provided by SignPath.io, with a certificate issued to SignPath Foundation. This page and the download page will be updated when that service is active.

## Source, builds, and release approval

- Source repository: [MYdesignTool/Ae-ToolKit](https://github.com/MYdesignTool/Ae-ToolKit).
- License: [GNU GPL v3](../extension/License.md).
- Maintainer, reviewer, and release approver: [MYdesignTool](https://github.com/MYdesignTool).
- Public builds: [Build Windows installer](https://github.com/MYdesignTool/Ae-ToolKit/actions/workflows/build-windows.yml).

The workflow runs on GitHub-hosted Windows runners, checks release metadata, runs unit tests and installer migration tests, and builds the installer from the checked-out source. Uploaded unsigned artifacts include SHA-256 checksums and the exact source commit/run URL. It does not upload or replace GitHub Release assets.

Production signing will require a separate, explicit approval by the maintainer for each release. SignPath credentials and project settings will be configured only after acceptance. Changes to source, build scripts, or workflow configuration must be reviewed before signing. Maintainers with signing access must enable multi-factor authentication on both GitHub and SignPath.

Authenticode signing of the Windows installer is separate from Adobe CEP extension signing. It does not itself make an unsigned CEP bundle load without Adobe's development-mode setting.

## Privacy

AE Local Toolkit's built-in panel and host modules do not contain analytics or telemetry. Settings, favorites, expressions, and organizer presets are stored locally. They are not uploaded to the maintainer or SignPath.

Opening the release website or running a third-party script is an explicit user action. The website, GitHub, and user-selected scripts may have their own network behavior and privacy policies. Code signing submits build artifacts and provenance to the signing provider; it does not submit installed users' settings or projects.
