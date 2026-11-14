# vendor/

Third-party **library** files, committed so the game can be served and deployed as plain
static files with no build step and no CDN. Nothing else in this project is third-party:
every model, material, animation, effect and sound is written in code.

| Path | What |
|---|---|
| `three/three.module.js` | Three.js r187 ES module build (imports `./three.core.js`) |
| `three/three.core.js` | Three.js r187 core |
| `three/LICENSE` | MIT licence, kept as required |
| `manifest.json` | version + sha256 of every file, written by the sync script |

Refresh from the pinned devDependency (never hand-edit these files):

```bash
npm install && npm run vendor    # copy node_modules -> vendor/
npm run gate                     # includes a check that vendor/ still matches the pin
```

Pages import it through an import map: `"three": "/vendor/three/three.module.js"`.

If the build is ever minified or bundled for the Step 10 deploy, do it in a `dist/`
folder and leave `vendor/` as the readable source of truth.
