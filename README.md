# Comment Copier

Copy unique accept/reject comments for grading, straight from a system-tray app.

## Prerequisites

- **Node.js** (includes npm) — download from https://nodejs.org

## First-time setup

1. Open a terminal in this folder.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Run the app:

   ```sh
   npm start
   ```

   (On Windows PowerShell, `npm.cmd start` also works.)

   The app starts in the system tray. Click the tray icon to open the popup.

## Building the installer

`npm run build` builds all three Windows variants in one pass, each named so they're easy to tell apart:

- `Comment Copier Setup {version} x64.exe` — 64-bit installer
- `Comment Copier Setup {version} arm64.exe` — ARM64 installer
- `Comment Copier {version} Portable.exe` — portable, no install needed (x64)

```sh
npm run build
```

On Windows, the build output is written to `%TEMP%\comment-copier-build` to avoid file-locking issues in the repository folder.

If the build fails due to code-signing certificate lookup (Windows), disable signing-certificate auto-discovery first:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run build
```

To build just one variant instead of all three:

```sh
npm run build:x64
npm run build:arm64
npm run build:portable
```

With signing-certificate auto-discovery disabled (Windows), prefix any of the above with:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
```

### Portable ARM64 build

The `build:portable` script only targets x64 by default. To also produce an ARM64 portable build:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win portable --arm64
```

## Building for macOS

macOS builds must be done on a **Mac** with Xcode installed. From the project folder:

```sh
npx electron-builder --mac
```

Targets: DMG, ZIP, and PKG (set via `--mac dmg pkg zip`). Code signing/notarization need an Apple Developer account; to skip signing for testing:

```sh
npx electron-builder --mac --publish never
```

## Building for Linux

Linux packages are best built on a **Linux** machine (or in CI). From the project folder:

```sh
npx electron-builder --linux
```

This produces an AppImage and a `deb`. To pick targets and arch:

```sh
npx electron-builder --linux --x64 --arm64 appimage deb
```

Other targets: `rpm`, `snap`, `flatpak`, `pacman`, `tar.gz`. Snap builds require `snapcraft` installed.

## Cross-platform builds (CI)

To build installers for all platforms without owning each OS, use a CI service (e.g. GitHub Actions) with a matrix for `windows-latest`, `macos-latest`, and `ubuntu-latest` runners, running the matching electron-builder command above.

Windows installers are written to `%TEMP%\comment-copier-build` (see above for the exact filenames).

## Sharing the software

- For most users, share `%TEMP%\comment-copier-build\Comment Copier Setup {version} x64.exe`. They run it, install, and the app appears in the system tray.
- If you'd rather give a single **portable** .exe (no install needed), share `%TEMP%\comment-copier-build\Comment Copier {version} Portable.exe` instead.
- Other files in `%TEMP%\comment-copier-build` (e.g. `win-unpacked`, `.blockmap`) are build artifacts and don't need to be shared.

## Project structure

| Path               | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `main.js`          | Electron main process (tray, window, IPC)     |
| `popup.html`       | Popup UI                                      |
| `popup.css`        | Popup styling                                 |
| `popup.js`         | Popup logic                                   |
| `popup-preload.js` | Secure IPC bridge (`contextBridge`)           |
| `build/`           | App/tray icons                                |

## Notes

- Comments, prompt, and sheet data are stored in the app's data folder
  (shown in the **Details** section of the **info** popup in the app).
- Use the **Reset app data** button in the app to clear all saved data.
- **Paste** (Student Details tab) imports a copied Excel range straight from the
  clipboard — select cells in Excel, Ctrl+C, then click Paste. No file picker
  needed. Use **Paste box** instead if you'd rather paste into a text box first
  (useful when clipboard access isn't available, or to tweak the data before
  importing).
