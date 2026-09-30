# Dependency licence report

Generated 2026-09-30 on branch `release/public-beta` (cut from `feat/exports` 5be3505) with:

```
pnpm licenses list --prod --json   # what ships
pnpm licenses list --json          # everything, including build and test tools
```

Regenerate before launch and after every integration merge: other branches (usage, AI input,
images, chart import, 3D, other families) add dependencies such as `delaunator`, `three` and
`read-excel-file` that are not on this branch.

The list was produced on Windows, so native packages appear as their `win32-x64` builds. On
Vercel the Linux builds are used instead (`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`,
`lightningcss-linux-x64-gnu`); their licences are the same as the Windows builds named below.

## Summary

| | Packages | Not permissive |
|---|---|---|
| Production (ships to users) | 131 | 3, all acceptable, see below |
| Development only (never deployed) | 321 | 4, all acceptable, see below |

Permissive means MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, CC0-1.0 or
BlueOak-1.0.0. No GPL or AGPL licence is present. Nothing requires the app's own source to be
published.

## Flagged licences

| Package | Where | Licence | Finding |
|---|---|---|---|
| `@img/sharp-win32-x64` (on Vercel `@img/sharp-libvips-linux-x64`) | production, via `sharp` | Apache-2.0 AND LGPL-3.0-or-later | The prebuilt libvips binary is LGPL. It is dynamically loaded and unmodified, which LGPL allows in closed-source software. Keep it unmodified; do not statically link or patch libvips. Acceptable. |
| `caniuse-lite` | production, via `next` (build-time browser data) | CC-BY-4.0 | A data licence that asks for attribution. Used only at build time; no data is shown to users. Acceptable. |
| `geist` and `apps/web/assets/fonts/Geist-Regular.ttf` | production, fonts | SIL Open Font License 1.1 | Fonts may be embedded and bundled, including in exported PDFs. The font may not be sold on its own. `Geist-LICENSE.txt` is kept beside the file. Acceptable. |
| `lightningcss`, `lightningcss-win32-x64-msvc` | development, via Tailwind | MPL-2.0 | File-level copyleft applies only to changes made to its own files. Build tool, not shipped. Acceptable. |
| `axe-core` | development, via lint rules | MPL-2.0 | As above. Not shipped. Acceptable. |
| `argparse` | development | Python-2.0 | Permissive in practice. Not shipped. Acceptable. |

## Security advisories (`pnpm audit --prod`)

`pnpm audit --prod` (pnpm 10.20.0) failed on 2026-09-30: its endpoint
`/-/npm/v1/security/audits` timed out three times from this machine. The same check was run
against the npm registry's bulk advisory endpoint
(`POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`) with every production
package and version from `pnpm list -r --prod --depth Infinity --json`:

| Checked | Packages with a matching advisory |
|---|---|
| 164 production package names (all resolved versions) | 0 |

The endpoint was confirmed to answer correctly by asking it about `next@14.0.0`, which returned
the known high-severity cache-poisoning advisory. Owed: run `pnpm audit --prod` again from CI
before launch and after integration, since other branches add dependencies.

## Production dependencies

| Package | Version | Licence | Flag |
|---|---|---|---|
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | REVIEW |
| caniuse-lite | 1.0.30001812 | CC-BY-4.0 | REVIEW |
| geist | 1.7.2 | SIL OPEN FONT LICENSE | REVIEW |
| @babel/code-frame | 7.29.7 | MIT |  |
| @babel/compat-data | 7.29.7 | MIT |  |
| @babel/core | 7.29.7 | MIT |  |
| @babel/generator | 7.29.8 | MIT |  |
| @babel/helper-compilation-targets | 7.29.7 | MIT |  |
| @babel/helper-globals | 7.29.7 | MIT |  |
| @babel/helper-module-imports | 7.29.7 | MIT |  |
| @babel/helper-module-transforms | 7.29.7 | MIT |  |
| @babel/helper-string-parser | 7.29.7 | MIT |  |
| @babel/helper-validator-identifier | 7.29.7 | MIT |  |
| @babel/helper-validator-option | 7.29.7 | MIT |  |
| @babel/helpers | 7.29.7 | MIT |  |
| @babel/parser | 7.29.9 | MIT |  |
| @babel/runtime | 7.29.7 | MIT |  |
| @babel/template | 7.29.7 | MIT |  |
| @babel/traverse | 7.29.8 | MIT |  |
| @babel/types | 7.29.8 | MIT |  |
| @img/colour | 1.1.0 | MIT |  |
| @jridgewell/gen-mapping | 0.3.13 | MIT |  |
| @jridgewell/remapping | 2.3.5 | MIT |  |
| @jridgewell/resolve-uri | 3.1.2 | MIT |  |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |  |
| @jridgewell/trace-mapping | 0.3.31 | MIT |  |
| @next/env | 16.3.6 | MIT |  |
| @next/swc-win32-x64-msvc | 16.3.6 | MIT |  |
| @noble/ciphers | 1.3.0 | MIT |  |
| @noble/hashes | 1.8.0 | MIT |  |
| @playwright/test | 1.63.0 | Apache-2.0 |  |
| @react-pdf/fns | 3.1.3 | MIT |  |
| @react-pdf/font | 4.1.2 | MIT |  |
| @react-pdf/hyphenate | 0.1.0 | MIT |  |
| @react-pdf/image | 3.1.2 | MIT |  |
| @react-pdf/layout | 5.2.0 | MIT |  |
| @react-pdf/paginate | 1.0.1 | MIT |  |
| @react-pdf/primitives | 4.4.0 | MIT |  |
| @react-pdf/reconciler | 2.0.0 | MIT |  |
| @react-pdf/render | 4.7.0 | MIT |  |
| @react-pdf/renderer | 4.9.0 | MIT |  |
| @react-pdf/stylesheet | 6.3.2 | MIT |  |
| @react-pdf/svg | 1.1.1 | MIT |  |
| @react-pdf/textkit | 7.0.1 | MIT |  |
| @react-pdf/types | 2.14.0 | MIT |  |
| @supabase/auth-js | 2.117.2 | MIT |  |
| @supabase/functions-js | 2.117.2 | MIT |  |
| @supabase/phoenix | 0.4.5 | MIT |  |
| @supabase/postgrest-js | 2.117.2 | MIT |  |
| @supabase/realtime-js | 2.117.2 | MIT |  |
| @supabase/ssr | 0.12.7 | MIT |  |
| @supabase/storage-js | 2.117.2 | MIT |  |
| @supabase/supabase-js | 2.117.2 | MIT |  |
| @swc/helpers | 0.5.23 | Apache-2.0 |  |
| @types/node | 24.19.0 | MIT |  |
| abs-svg-path | 0.1.1 | MIT |  |
| base64-js | 0.0.8, 1.5.1 | MIT |  |
| baseline-browser-mapping | 2.11.26 | Apache-2.0 |  |
| bidi-js | 1.1.0 | MIT |  |
| brotli | 1.3.3 | MIT |  |
| browserslist | 4.29.1 | MIT |  |
| client-only | 0.0.1 | MIT |  |
| clone | 2.1.2 | MIT |  |
| color-name | 2.1.1 | MIT |  |
| color-string | 2.1.4 | MIT |  |
| convert-source-map | 2.0.0 | MIT |  |
| cookie | 1.1.1 | MIT |  |
| debug | 4.4.3 | MIT |  |
| detect-libc | 2.1.2 | Apache-2.0 |  |
| dfa | 1.2.0 | MIT |  |
| electron-to-chromium | 1.5.439 | ISC |  |
| emoji-regex-xs | 1.0.0 | MIT |  |
| escalade | 3.2.0 | MIT |  |
| events | 3.3.0 | MIT |  |
| fast-deep-equal | 3.1.3 | MIT |  |
| fflate | 0.8.3 | MIT |  |
| fontkit | 2.0.4 | MIT |  |
| gensync | 1.0.0-beta.2 | MIT |  |
| hsl-to-hex | 1.0.0 | MIT |  |
| hsl-to-rgb-for-reals | 1.1.1 | ISC |  |
| hyphen | 1.6.6 | ISC |  |
| iceberg-js | 0.8.1 | MIT |  |
| inherits | 2.0.4 | ISC |  |
| is-url | 1.2.4 | MIT |  |
| jay-peg | 1.1.1 | MIT |  |
| js-tokens | 4.0.0 | MIT |  |
| jsesc | 3.1.0 | MIT |  |
| json5 | 2.2.3 | MIT |  |
| linebreak | 1.1.0 | MIT |  |
| loose-envify | 1.4.0 | MIT |  |
| lru-cache | 5.1.1 | ISC |  |
| media-engine | 2.0.0 | MIT |  |
| ms | 2.1.3 | MIT |  |
| nanoid | 3.3.19 | MIT |  |
| next | 16.3.6 | MIT |  |
| node-releases | 2.0.57 | MIT |  |
| normalize-svg-path | 1.1.0 | MIT |  |
| object-assign | 4.1.1 | MIT |  |
| pako | 0.2.9 | MIT |  |
| parse-svg-path | 0.1.2 | MIT |  |
| pdfkit | 0.20.1 | MIT |  |
| picocolors | 1.1.1 | ISC |  |
| playwright | 1.63.0 | Apache-2.0 |  |
| playwright-core | 1.63.0 | Apache-2.0 |  |
| png-js | 2.0.0 | MIT |  |
| postcss | 8.5.23 | MIT |  |
| postcss-value-parser | 4.2.0 | MIT |  |
| prop-types | 15.8.1 | MIT |  |
| queue | 6.0.2 | MIT |  |
| react | 19.2.8 | MIT |  |
| react-dom | 19.2.8 | MIT |  |
| react-is | 16.13.1 | MIT |  |
| require-from-string | 2.0.2 | MIT |  |
| restructure | 3.0.2 | MIT |  |
| scheduler | 0.25.0-rc-603e6108-20241029, 0.27.0 | MIT |  |
| semver | 6.3.1, 7.8.5 | ISC |  |
| server-only | 0.0.1 | MIT |  |
| sharp | 0.35.5 | Apache-2.0 |  |
| source-map-js | 1.2.1 | BSD-3-Clause |  |
| styled-jsx | 5.1.6 | MIT |  |
| svg-arc-to-cubic-bezier | 3.2.0 | ISC |  |
| tiny-inflate | 1.0.3 | MIT |  |
| tslib | 2.8.1 | 0BSD |  |
| undici-types | 7.24.6 | MIT |  |
| unicode-properties | 1.4.1 | MIT |  |
| unicode-trie | 2.0.0 | MIT |  |
| update-browserslist-db | 1.3.3 | MIT |  |
| write-excel-file | 4.1.1 | MIT |  |
| yallist | 3.1.1 | ISC |  |
| yoga-layout | 3.2.1 | MIT |  |
| zod | 4.6.5 | MIT |  |

## Development-only dependencies

| Package | Version | Licence | Flag |
|---|---|---|---|
| argparse | 2.0.1 | Python-2.0 | REVIEW |
| axe-core | 4.13.0 | MPL-2.0 | REVIEW |
| lightningcss | 1.32.0, 1.33.0 | MPL-2.0 | REVIEW |
| lightningcss-win32-x64-msvc | 1.32.0, 1.33.0 | MPL-2.0 | REVIEW |
| @alloc/quick-lru | 5.3.0 | MIT |  |
| @bcoe/v8-coverage | 1.0.2 | MIT |  |
| @ecies/ciphers | 0.2.6 | MIT |  |
| @esbuild/win32-x64 | 0.28.2 | MIT |  |
| @eslint-community/eslint-utils | 4.9.1, 4.10.1 | MIT |  |
| @eslint-community/regexpp | 4.12.2 | MIT |  |
| @eslint/config-array | 0.21.2 | Apache-2.0 |  |
| @eslint/config-helpers | 0.4.2 | Apache-2.0 |  |
| @eslint/core | 0.17.0 | Apache-2.0 |  |
| @eslint/eslintrc | 3.3.7 | MIT |  |
| @eslint/js | 9.39.5 | MIT |  |
| @eslint/object-schema | 2.1.7 | Apache-2.0 |  |
| @eslint/plugin-kit | 0.4.1 | Apache-2.0 |  |
| @humanfs/core | 0.19.2 | Apache-2.0 |  |
| @humanfs/node | 0.16.8 | Apache-2.0 |  |
| @humanfs/types | 0.15.0 | Apache-2.0 |  |
| @humanwhocodes/module-importer | 1.0.1 | Apache-2.0 |  |
| @humanwhocodes/retry | 0.4.3 | Apache-2.0 |  |
| @napi-rs/canvas | 1.0.9 | MIT |  |
| @napi-rs/canvas-win32-x64-msvc | 1.0.9 | MIT |  |
| @next/eslint-plugin-next | 16.3.6 | MIT |  |
| @noble/curves | 1.9.7 | MIT |  |
| @nodelib/fs.scandir | 2.1.5 | MIT |  |
| @nodelib/fs.stat | 2.0.5 | MIT |  |
| @nodelib/fs.walk | 1.2.8 | MIT |  |
| @nolyfill/is-core-module | 1.0.39 | MIT |  |
| @oxc-project/types | 0.151.0 | MIT |  |
| @rolldown/binding-win32-x64-msvc | 1.2.11 | MIT |  |
| @rolldown/pluginutils | 1.0.1 | MIT |  |
| @rtsao/scc | 1.1.0 | MIT |  |
| @supabase/cli-windows-x64 | 2.118.0 | MIT |  |
| @tailwindcss/node | 4.3.3 | MIT |  |
| @tailwindcss/oxide | 4.3.3 | MIT |  |
| @tailwindcss/oxide-win32-x64-msvc | 4.3.3 | MIT |  |
| @tailwindcss/postcss | 4.3.3 | MIT |  |
| @types/chai | 5.2.3 | MIT |  |
| @types/deep-eql | 4.0.2 | MIT |  |
| @types/estree | 1.0.9 | MIT |  |
| @types/json-schema | 7.0.15 | MIT |  |
| @types/json5 | 0.0.29 | MIT |  |
| @types/react | 19.3.0 | MIT |  |
| @types/react-dom | 19.3.0 | MIT |  |
| @typescript-eslint/eslint-plugin | 8.70.1 | MIT |  |
| @typescript-eslint/parser | 8.70.1 | MIT |  |
| @typescript-eslint/project-service | 8.70.1 | MIT |  |
| @typescript-eslint/scope-manager | 8.70.1 | MIT |  |
| @typescript-eslint/tsconfig-utils | 8.70.1 | MIT |  |
| @typescript-eslint/type-utils | 8.70.1 | MIT |  |
| @typescript-eslint/types | 8.70.1 | MIT |  |
| @typescript-eslint/typescript-estree | 8.70.1 | MIT |  |
| @typescript-eslint/utils | 8.70.1 | MIT |  |
| @typescript-eslint/visitor-keys | 8.70.1 | MIT |  |
| @unrs/resolver-binding-win32-x64-msvc | 1.12.2 | MIT |  |
| @vitest/coverage-v8 | 5.0.2 | MIT |  |
| @vitest/istanbul-lib-coverage | 1.0.1 | MIT |  |
| @vitest/istanbul-lib-report | 1.0.1 | MIT |  |
| @vitest/mocker | 5.0.2 | MIT |  |
| @vitest/spy | 5.0.2 | MIT |  |
| acorn | 8.18.0 | MIT |  |
| acorn-jsx | 5.3.2 | MIT |  |
| ajv | 6.15.0 | MIT |  |
| ansi-styles | 4.3.0 | MIT |  |
| aria-query | 5.3.2 | Apache-2.0 |  |
| array-buffer-byte-length | 1.0.2 | MIT |  |
| array-includes | 3.2.0 | MIT |  |
| array.prototype.findlast | 1.2.5 | MIT |  |
| array.prototype.findlastindex | 1.2.6 | MIT |  |
| array.prototype.flat | 1.3.3 | MIT |  |
| array.prototype.flatmap | 1.3.3 | MIT |  |
| array.prototype.tosorted | 1.1.4 | MIT |  |
| arraybuffer.prototype.slice | 1.0.4 | MIT |  |
| assertion-error | 2.0.1 | MIT |  |
| ast-types-flow | 0.0.8 | MIT |  |
| ast-v8-to-istanbul | 1.0.7 | MIT |  |
| async-function | 1.0.0 | MIT |  |
| available-typed-arrays | 1.0.7 | MIT |  |
| axobject-query | 4.1.0 | Apache-2.0 |  |
| balanced-match | 1.0.2, 4.0.4 | MIT |  |
| brace-expansion | 1.1.21, 5.0.12 | MIT |  |
| braces | 3.0.3 | MIT |  |
| call-bind | 1.0.9 | MIT |  |
| call-bind-apply-helpers | 1.0.2 | MIT |  |
| call-bound | 1.0.4 | MIT |  |
| callsites | 3.1.0 | MIT |  |
| chai | 6.2.2 | MIT |  |
| chalk | 4.1.2 | MIT |  |
| color-convert | 2.0.1 | MIT |  |
| concat-map | 0.0.1 | MIT |  |
| cross-spawn | 7.0.6 | MIT |  |
| csstype | 3.2.3 | MIT |  |
| damerau-levenshtein | 1.0.8 | BSD-2-Clause |  |
| data-view-buffer | 1.0.2 | MIT |  |
| data-view-byte-length | 1.0.2 | MIT |  |
| data-view-byte-offset | 1.0.1 | MIT |  |
| deep-is | 0.1.4 | MIT |  |
| define-data-property | 1.1.4 | MIT |  |
| define-properties | 1.2.1 | MIT |  |
| doctrine | 2.1.0 | Apache-2.0 |  |
| dunder-proto | 1.0.1 | MIT |  |
| eciesjs | 0.5.0 | MIT |  |
| emoji-regex | 9.2.2 | MIT |  |
| enhanced-resolve | 5.25.1 | MIT |  |
| es-abstract | 1.24.2 | MIT |  |
| es-abstract-get | 1.0.0 | MIT |  |
| es-define-property | 1.0.1 | MIT |  |
| es-errors | 1.3.0 | MIT |  |
| es-iterator-helpers | 1.4.0 | MIT |  |
| es-module-lexer | 2.3.2 | MIT |  |
| es-object-atoms | 1.1.2 | MIT |  |
| es-set-tostringtag | 2.1.0 | MIT |  |
| es-shim-unscopables | 1.1.0 | MIT |  |
| es-to-primitive | 1.3.4 | MIT |  |
| esbuild | 0.28.2 | MIT |  |
| escape-string-regexp | 4.0.0 | MIT |  |
| eslint | 9.39.5 | MIT |  |
| eslint-config-next | 16.3.6 | MIT |  |
| eslint-import-resolver-node | 0.3.10 | MIT |  |
| eslint-import-resolver-typescript | 3.10.1 | ISC |  |
| eslint-module-utils | 2.14.0 | MIT |  |
| eslint-plugin-import | 2.32.0 | MIT |  |
| eslint-plugin-jsx-a11y | 6.10.2 | MIT |  |
| eslint-plugin-react | 7.37.5 | MIT |  |
| eslint-plugin-react-hooks | 7.1.1 | MIT |  |
| eslint-scope | 8.4.0 | BSD-2-Clause |  |
| eslint-visitor-keys | 3.4.3, 4.2.1, 5.0.1 | Apache-2.0 |  |
| espree | 10.4.0 | BSD-2-Clause |  |
| esquery | 1.7.0 | BSD-3-Clause |  |
| esrecurse | 4.3.0 | BSD-2-Clause |  |
| estraverse | 5.3.0 | BSD-2-Clause |  |
| estree-walker | 3.0.3 | MIT |  |
| esutils | 2.0.3 | BSD-2-Clause |  |
| expect-type | 1.4.0 | Apache-2.0 |  |
| fast-check | 4.10.2 | MIT |  |
| fast-glob | 3.3.1 | MIT |  |
| fast-json-stable-stringify | 2.1.0 | MIT |  |
| fast-levenshtein | 2.0.6 | MIT |  |
| fastq | 1.20.3 | ISC |  |
| fdir | 6.5.0 | MIT |  |
| file-entry-cache | 8.0.0 | MIT |  |
| fill-range | 7.1.1 | MIT |  |
| find-up | 5.0.0 | MIT |  |
| flat-cache | 4.0.1 | MIT |  |
| flatted | 3.4.4 | ISC |  |
| for-each | 0.3.5 | MIT |  |
| function-bind | 1.1.2 | MIT |  |
| function.prototype.name | 1.2.0 | MIT |  |
| functions-have-names | 1.2.3 | MIT |  |
| generator-function | 2.0.1 | MIT |  |
| get-intrinsic | 1.3.0 | MIT |  |
| get-proto | 1.0.1 | MIT |  |
| get-symbol-description | 1.1.0 | MIT |  |
| get-tsconfig | 4.14.3 | MIT |  |
| glob-parent | 5.1.2, 6.0.2 | ISC |  |
| globals | 14.0.0, 16.4.0 | MIT |  |
| globalthis | 1.0.4 | MIT |  |
| gopd | 1.2.0 | MIT |  |
| graceful-fs | 4.2.11 | ISC |  |
| has-bigints | 1.1.0 | MIT |  |
| has-flag | 4.0.0 | MIT |  |
| has-property-descriptors | 1.0.2 | MIT |  |
| has-proto | 1.2.0 | MIT |  |
| has-symbols | 1.1.0 | MIT |  |
| has-tostringtag | 1.0.2 | MIT |  |
| hasown | 2.0.4 | MIT |  |
| hermes-estree | 0.25.1 | MIT |  |
| hermes-parser | 0.25.1 | MIT |  |
| ignore | 5.3.2, 7.0.10 | MIT |  |
| import-fresh | 3.3.1 | MIT |  |
| imurmurhash | 0.1.4 | MIT |  |
| internal-slot | 1.1.0 | MIT |  |
| is-array-buffer | 3.0.5 | MIT |  |
| is-async-function | 2.1.1 | MIT |  |
| is-bigint | 1.1.0 | MIT |  |
| is-boolean-object | 1.2.2 | MIT |  |
| is-bun-module | 2.0.0 | MIT |  |
| is-callable | 1.2.7 | MIT |  |
| is-core-module | 2.17.0 | MIT |  |
| is-data-view | 1.0.2 | MIT |  |
| is-date-object | 1.1.0 | MIT |  |
| is-document.all | 1.0.0 | MIT |  |
| is-extglob | 2.1.1 | MIT |  |
| is-finalizationregistry | 1.1.1 | MIT |  |
| is-generator-function | 1.1.2 | MIT |  |
| is-glob | 4.0.3 | MIT |  |
| is-map | 2.0.3 | MIT |  |
| is-negative-zero | 2.0.3 | MIT |  |
| is-number | 7.0.0 | MIT |  |
| is-number-object | 1.1.1 | MIT |  |
| is-regex | 1.2.1 | MIT |  |
| is-set | 2.0.3 | MIT |  |
| is-shared-array-buffer | 1.0.4 | MIT |  |
| is-string | 1.1.1 | MIT |  |
| is-symbol | 1.1.1 | MIT |  |
| is-typed-array | 1.1.15 | MIT |  |
| is-weakmap | 2.0.2 | MIT |  |
| is-weakref | 1.1.1 | MIT |  |
| is-weakset | 2.0.4 | MIT |  |
| isarray | 2.0.5 | MIT |  |
| isexe | 2.0.0 | ISC |  |
| iterator.prototype | 1.1.5 | MIT |  |
| jiti | 2.7.0 | MIT |  |
| jose | 6.2.12 | MIT |  |
| js-yaml | 4.3.2 | MIT |  |
| json-buffer | 3.0.1 | MIT |  |
| json-schema-traverse | 0.4.1 | MIT |  |
| json-stable-stringify-without-jsonify | 1.0.1 | MIT |  |
| jsx-ast-utils | 3.3.5 | MIT |  |
| keyv | 4.5.4 | MIT |  |
| language-subtag-registry | 0.3.23 | CC0-1.0 |  |
| language-tags | 1.0.9 | MIT |  |
| levn | 0.4.1 | MIT |  |
| locate-path | 6.0.0 | MIT |  |
| lodash.merge | 4.6.2 | MIT |  |
| magic-string | 0.30.21, 1.4.2 | MIT |  |
| magicast | 0.5.5 | MIT |  |
| math-intrinsics | 1.1.0 | MIT |  |
| merge2 | 1.4.1 | MIT |  |
| micromatch | 4.0.8 | MIT |  |
| minimatch | 3.1.5 | ISC |  |
| minimatch | 10.2.6 | BlueOak-1.0.0 |  |
| minimist | 1.2.8 | MIT |  |
| napi-postinstall | 0.3.4 | MIT |  |
| natural-compare | 1.4.0 | MIT |  |
| node-exports-info | 1.6.2 | MIT |  |
| node-int64 | 0.4.0 | MIT |  |
| object-inspect | 1.13.4 | MIT |  |
| object-keys | 1.1.1 | MIT |  |
| object.assign | 4.1.7 | MIT |  |
| object.entries | 1.1.9 | MIT |  |
| object.fromentries | 2.0.8 | MIT |  |
| object.groupby | 1.0.3 | MIT |  |
| object.values | 1.2.1 | MIT |  |
| obug | 2.2.1 | MIT |  |
| optionator | 0.9.4 | MIT |  |
| own-keys | 1.0.2 | MIT |  |
| p-limit | 3.1.0 | MIT |  |
| p-locate | 5.0.0 | MIT |  |
| parent-module | 1.0.1 | MIT |  |
| path-exists | 4.0.0 | MIT |  |
| path-key | 3.1.1 | MIT |  |
| path-parse | 1.0.7 | MIT |  |
| pdfjs-dist | 6.3.289 | Apache-2.0 |  |
| picomatch | 2.3.2, 4.0.7 | MIT |  |
| possible-typed-array-names | 1.1.0 | MIT |  |
| prelude-ls | 1.2.1 | MIT |  |
| punycode | 2.3.1 | MIT |  |
| pure-rand | 8.4.2 | MIT |  |
| queue-microtask | 1.2.3 | MIT |  |
| read-excel-file | 9.3.10 | MIT |  |
| reflect.getprototypeof | 1.0.10 | MIT |  |
| regexp.prototype.flags | 1.5.4 | MIT |  |
| resolve | 2.0.0-next.7 | MIT |  |
| resolve-from | 4.0.0 | MIT |  |
| resolve-pkg-maps | 1.0.0 | MIT |  |
| reusify | 1.1.0 | MIT |  |
| rolldown | 1.2.11 | MIT |  |
| run-parallel | 1.2.0 | MIT |  |
| safe-array-concat | 1.1.4 | MIT |  |
| safe-push-apply | 1.0.0 | MIT |  |
| safe-regex-test | 1.1.0 | MIT |  |
| saxen | 11.2.0 | MIT |  |
| set-function-length | 1.2.2 | MIT |  |
| set-function-name | 2.0.2 | MIT |  |
| set-proto | 1.0.0 | MIT |  |
| shebang-command | 2.0.0 | MIT |  |
| shebang-regex | 3.0.0 | MIT |  |
| side-channel | 1.1.1 | MIT |  |
| side-channel-list | 1.0.1 | MIT |  |
| side-channel-map | 1.0.1 | MIT |  |
| side-channel-weakmap | 1.0.2 | MIT |  |
| stable-hash | 0.0.5 | MIT |  |
| std-env | 4.2.0 | MIT |  |
| stop-iteration-iterator | 1.1.0 | MIT |  |
| string.prototype.includes | 2.0.1 | MIT |  |
| string.prototype.matchall | 4.1.0 | MIT |  |
| string.prototype.repeat | 1.0.0 | MIT |  |
| string.prototype.trim | 1.2.11 | MIT |  |
| string.prototype.trimend | 1.0.10 | MIT |  |
| string.prototype.trimstart | 1.0.8 | MIT |  |
| strip-bom | 3.0.0 | MIT |  |
| strip-json-comments | 3.1.1 | MIT |  |
| supabase | 2.118.0 | MIT |  |
| supports-color | 7.2.0 | MIT |  |
| supports-preserve-symlinks-flag | 1.0.0 | MIT |  |
| tailwindcss | 4.3.3 | MIT |  |
| tapable | 2.3.3 | MIT |  |
| tinybench | 6.2.0 | MIT |  |
| tinyexec | 1.3.1 | MIT |  |
| tinyglobby | 0.2.17 | MIT |  |
| tinyrainbow | 3.1.1 | MIT |  |
| to-regex-range | 5.0.1 | MIT |  |
| ts-api-utils | 2.5.0 | MIT |  |
| tsconfig-paths | 3.15.0 | MIT |  |
| tsx | 4.23.15 | MIT |  |
| type-check | 0.4.0 | MIT |  |
| typed-array-buffer | 1.0.3 | MIT |  |
| typed-array-byte-length | 1.0.3 | MIT |  |
| typed-array-byte-offset | 1.0.5 | MIT |  |
| typed-array-length | 1.0.8 | MIT |  |
| typescript | 5.9.3 | Apache-2.0 |  |
| typescript-eslint | 8.70.1 | MIT |  |
| unbox-primitive | 1.1.0 | MIT |  |
| unrs-resolver | 1.12.2 | MIT |  |
| unzipper-esm | 0.13.3 | MIT |  |
| uri-js | 4.4.1 | BSD-2-Clause |  |
| vite | 8.3.1 | MIT |  |
| vitest | 5.0.2 | MIT |  |
| which | 2.0.2 | ISC |  |
| which-boxed-primitive | 1.1.1 | MIT |  |
| which-builtin-type | 1.2.1 | MIT |  |
| which-collection | 1.0.2 | MIT |  |
| which-typed-array | 1.1.24 | MIT |  |
| why-is-node-running | 3.2.2 | MIT |  |
| word-wrap | 1.2.5 | MIT |  |
| worker-f | 0.1.20 | MIT |  |
| yocto-queue | 0.1.0 | MIT |  |
| zod-validation-error | 4.0.2 | MIT |  |
