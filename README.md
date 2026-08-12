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

Create a Windows installer (NSIS):

```sh
npm run build
```

If the build fails due to code-signing certificate lookup (Windows), disable signing-certificate auto-discovery first:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm.cmd run build
```

Create a portable (single .exe) build:

```sh
npm run build:portable
```

With signing-certificate auto-discovery disabled (Windows):

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm.cmd run build:portable
```

## Building for ARM64

Build an arm64 installer without changing the config:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win --arm64
```

Arm64 portable build:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win portable --arm64
```

To always build both x64 and arm64 with `npm run build`, change `arch` in `package.json` (under `build.win.target`) to:

```json
"arch": ["x64", "arm64"]
```

## Building for macOS

macOS builds must be done on a **Mac** with Xcode installed. From the project folder:

```sh
npm run dist -- --mac
```

Or directly:

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


Installers are written to the `dist/` folder.

## Sharing the software

- To share the app, you only need the **installer** — `dist/Comment Copier Setup 1.9.3.exe`. End users run it, install, and the app appears in the system tray.
- If you'd rather give a single **portable** .exe (no install needed), run `npm run build:portable` and share that one instead.
- Other files in `dist/` (e.g. `win-unpacked`, `.blockmap`) are build artifacts and don't need to be shared.

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
