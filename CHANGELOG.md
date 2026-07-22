# ADTEC Code Changelog

All notable changes to ADTEC Code are documented in this file.

## 0.1.18

- Unified the VS Code extension and CLI release version.
- Added a single GitHub Release pipeline for the VSIX and all supported CLI platforms.
- Preserved existing release tags instead of moving them between commits.

## 0.1.1

- Fixed strict TypeScript declaration generation for dynamically resolved Moonshot model metadata.
- Added full VSIX and CLI build validation to the GitHub Actions QA gate.
- Added tag-triggered internal VSIX release packaging for ADTEC Code.

## 0.1.0

### Added

- Introduced the ADTEC Code brand for the Visual Studio Code extension.
- Added the official Advanced Digital Technology logo for the extension and Activity Bar.
- Added support for read-only Skills bundled inside the installed extension.
- Added the `adtec-test` bundled Skill for verifying VSIX Skill discovery and loading.

### Changed

- Updated extension names and localized VS Code labels to ADTEC Code.
- Added the ADTEC Code source repository to extension metadata and support links.
