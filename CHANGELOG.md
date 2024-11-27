# Changelog

## [4.3.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v4.2.0...ctrl-q-v4.3.0) (2024-11-26)


### Features

* **qseow:** Add `--new-app-delete` option to `qseow field-scramble` command ([996df4f](https://github.com/ptarmiganlabs/ctrl-q/commit/996df4fd3277c27066bf7f446f86a33fa3aba022))

## [4.2.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v4.1.0...ctrl-q-v4.2.0) (2024-11-26)


### Features

* **qseow:** Add publish and replace options to field scramble command ([8cbfe64](https://github.com/ptarmiganlabs/ctrl-q/commit/8cbfe640132627a197b8cc79b50e138c4fab6545)), closes [#522](https://github.com/ptarmiganlabs/ctrl-q/issues/522)


### Miscellaneous

* **deps:** Update dependencies ([1756166](https://github.com/ptarmiganlabs/ctrl-q/commit/175616641e03e18f69e9bb584370ea281001fd59))

## [4.1.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v4.0.0...ctrl-q-v4.1.0) (2024-11-19)


### Features

* **qseow:** Add new, default user activity bucket to `qseow user-activity-bucket-cp-create` command ([efaa81c](https://github.com/ptarmiganlabs/ctrl-q/commit/efaa81ce142ff2dc735be2becde107d33250481b)), closes [#546](https://github.com/ptarmiganlabs/ctrl-q/issues/546)
* **qseow:** Show app counter when exporting apps to QVF files ([ff90297](https://github.com/ptarmiganlabs/ctrl-q/commit/ff90297a8c4ceb0aeab3411e3a4db191b5ff8f2c))


### Bug Fixes

* **qseow:** Delete master dimension works again ([610b969](https://github.com/ptarmiganlabs/ctrl-q/commit/610b969f4e09b6660e8910537c3680f9279bbf1a)), closes [#537](https://github.com/ptarmiganlabs/ctrl-q/issues/537)
* **qseow:** Deleting proxy sessions works again, caused by regression in 4.0.0 ([2bb820e](https://github.com/ptarmiganlabs/ctrl-q/commit/2bb820ec7a012aa7380c6d61f6b12fdd336d251c)), closes [#539](https://github.com/ptarmiganlabs/ctrl-q/issues/539)
* **qseow:** Don't throw unwarranted errors when importing master dimensions ([c61409e](https://github.com/ptarmiganlabs/ctrl-q/commit/c61409ecde8f997f10e0e2beec359362229ccb8e)), closes [#542](https://github.com/ptarmiganlabs/ctrl-q/issues/542)
* **qseow:** Exporting apps to QVF files works again ([8b45d85](https://github.com/ptarmiganlabs/ctrl-q/commit/8b45d854da78905d56ab0067f3f2b33d9558fa01)), closes [#541](https://github.com/ptarmiganlabs/ctrl-q/issues/541)
* **qseow:** Getting proxy sessions works again, caused by regression in 4.0.0 ([c756c8f](https://github.com/ptarmiganlabs/ctrl-q/commit/c756c8f177d1e2f4cc3b6d1958093b91869fa9bf)), closes [#538](https://github.com/ptarmiganlabs/ctrl-q/issues/538)
* **qseow:** Implement missing --dry-run feature for `qseow user-activity-bucket-cp-create` command ([473dde3](https://github.com/ptarmiganlabs/ctrl-q/commit/473dde3334057ce17c58caba8db17c18afa3fc88)), closes [#543](https://github.com/ptarmiganlabs/ctrl-q/issues/543)
* **qseow:** Visualisation tasks in network diagram works again ([338152d](https://github.com/ptarmiganlabs/ctrl-q/commit/338152d5991778ce76da58f70e66116f6f59c099)), closes [#540](https://github.com/ptarmiganlabs/ctrl-q/issues/540)
* Version command works again ([af26171](https://github.com/ptarmiganlabs/ctrl-q/commit/af26171ce541ef75b964cbc721a00af13f4551d5)), closes [#536](https://github.com/ptarmiganlabs/ctrl-q/issues/536)


### Miscellaneous

* **deps:** update @qlik/api and eslint to latest versions ([38ae154](https://github.com/ptarmiganlabs/ctrl-q/commit/38ae15496bca28536d3d271dd74c198cdd3cb919))

## [4.0.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v4.0.0...ctrl-q-v4.0.0) (2024-11-15)


### ⚠ BREAKING CHANGES

* **QSEoW:** Add new command prefix for all client-managed related commands

### Features

* **qscloud:** Add connection test command ([61dd4d8](https://github.com/ptarmiganlabs/ctrl-q/commit/61dd4d8a33ddc5670921a82143a21dbf4bdf2dbf))
* **qseow:** Add command for creating  custom properties acting as user activity buckets ([f8cc30a](https://github.com/ptarmiganlabs/ctrl-q/commit/f8cc30a974ecaa4b906380371ad6a9043505c0a0)), closes [#154](https://github.com/ptarmiganlabs/ctrl-q/issues/154)
* **QSEoW:** Add new command prefix for all client-managed related commands ([06ab7ca](https://github.com/ptarmiganlabs/ctrl-q/commit/06ab7ca0bfa12027433a637c05e476d465b9a631)), closes [#519](https://github.com/ptarmiganlabs/ctrl-q/issues/519)


### Bug Fixes

* **unit-test:** Tests for setting task custom properties now work as intended ([779ee4e](https://github.com/ptarmiganlabs/ctrl-q/commit/779ee4e228882a388701f30cd0cc1fed82afeb1e))


### Miscellaneous

* **ci:** Update build process for Windows, macOS, and Linux to target Node.js 23 and improve executable handling ([ab191b6](https://github.com/ptarmiganlabs/ctrl-q/commit/ab191b69a954258e185f5627fbf2b92323392109))
* **ci:** Update CI workflow to target Node.js 23 and enhance binary signing and notarization process ([ce020ed](https://github.com/ptarmiganlabs/ctrl-q/commit/ce020ed11ecf1437687ea1d86862f68fee965ae8)), closes [#523](https://github.com/ptarmiganlabs/ctrl-q/issues/523)
* **deps:** Update dependencies ([b74df00](https://github.com/ptarmiganlabs/ctrl-q/commit/b74df004ae6321c96268992b19e7c37da3ea6001))
* **deps:** update dependencies to latest versions ([84ffc18](https://github.com/ptarmiganlabs/ctrl-q/commit/84ffc189d0249efac4728132574ae3ae29735674))
* **deps:** Upgrade dependencies ([99362ba](https://github.com/ptarmiganlabs/ctrl-q/commit/99362bab8e4b868cc7855ef600e828e01cc69959))
* **main:** release ctrl-q 4.0.0 ([77a514f](https://github.com/ptarmiganlabs/ctrl-q/commit/77a514f4c7fa749c95b1ae557b9a100828cda2b5))
* **test:** Add unit test for user activity custom property ([3131917](https://github.com/ptarmiganlabs/ctrl-q/commit/3131917b732b7216c8b988a9382f288690328c66))


### Refactoring

* More consistent handling of QRS calls ([c050445](https://github.com/ptarmiganlabs/ctrl-q/commit/c050445351de431d4872edda1ce3f5c62f7d6416))

## [4.0.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.18.1...ctrl-q-v4.0.0) (2024-11-15)


### ⚠ BREAKING CHANGES

* **QSEoW:** Add new command prefix for all client-managed related commands

### Features

* **qscloud:** Add connection test command ([61dd4d8](https://github.com/ptarmiganlabs/ctrl-q/commit/61dd4d8a33ddc5670921a82143a21dbf4bdf2dbf))
* **qseow:** Add command for creating  custom properties acting as user activity buckets ([f8cc30a](https://github.com/ptarmiganlabs/ctrl-q/commit/f8cc30a974ecaa4b906380371ad6a9043505c0a0)), closes [#154](https://github.com/ptarmiganlabs/ctrl-q/issues/154)
* **QSEoW:** Add new command prefix for all client-managed related commands ([06ab7ca](https://github.com/ptarmiganlabs/ctrl-q/commit/06ab7ca0bfa12027433a637c05e476d465b9a631)), closes [#519](https://github.com/ptarmiganlabs/ctrl-q/issues/519)


### Bug Fixes

* **unit-test:** Tests for setting task custom properties now work as intended ([779ee4e](https://github.com/ptarmiganlabs/ctrl-q/commit/779ee4e228882a388701f30cd0cc1fed82afeb1e))


### Miscellaneous

* **ci:** Update build process for Windows, macOS, and Linux to target Node.js 23 and improve executable handling ([ab191b6](https://github.com/ptarmiganlabs/ctrl-q/commit/ab191b69a954258e185f5627fbf2b92323392109))
* **ci:** Update CI workflow to target Node.js 23 and enhance binary signing and notarization process ([ce020ed](https://github.com/ptarmiganlabs/ctrl-q/commit/ce020ed11ecf1437687ea1d86862f68fee965ae8)), closes [#523](https://github.com/ptarmiganlabs/ctrl-q/issues/523)
* **deps:** Update dependencies ([b74df00](https://github.com/ptarmiganlabs/ctrl-q/commit/b74df004ae6321c96268992b19e7c37da3ea6001))
* **deps:** update dependencies to latest versions ([84ffc18](https://github.com/ptarmiganlabs/ctrl-q/commit/84ffc189d0249efac4728132574ae3ae29735674))
* **deps:** Upgrade dependencies ([99362ba](https://github.com/ptarmiganlabs/ctrl-q/commit/99362bab8e4b868cc7855ef600e828e01cc69959))
* **test:** Add unit test for user activity custom property ([3131917](https://github.com/ptarmiganlabs/ctrl-q/commit/3131917b732b7216c8b988a9382f288690328c66))


### Refactoring

* More consistent handling of QRS calls ([c050445](https://github.com/ptarmiganlabs/ctrl-q/commit/c050445351de431d4872edda1ce3f5c62f7d6416))

## [3.18.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.18.0...ctrl-q-v3.18.1) (2024-06-05)


### Miscellaneous

* **deps:** Upgrade dependencies ([e34bf27](https://github.com/ptarmiganlabs/ctrl-q/commit/e34bf271dce35f62ebe3ba4930535937db4ce709))
* Upgrade release-please to latest version ([3ed45f2](https://github.com/ptarmiganlabs/ctrl-q/commit/3ed45f210459e9f0590945c864bf1d39b58a61d9))

## [3.18.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.17.0...ctrl-q-v3.18.0) (2024-04-29)


### Features

* **app-export:** Add --app-published flag for exporting all published apps ([fbff348](https://github.com/ptarmiganlabs/ctrl-q/commit/fbff3483f2b880c5ee6e28c0e028cea91953aec4)), closes [#468](https://github.com/ptarmiganlabs/ctrl-q/issues/468)


### Miscellaneous

* **deps:** Update dependencies ([591196b](https://github.com/ptarmiganlabs/ctrl-q/commit/591196b966e05f44ec9f06e354883c8dd334d5c7))

## [3.17.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.16.0...ctrl-q-v3.17.0) (2024-04-22)


### Features

* **script-get:** Add option for (not) loading data when app is opened ([dc0640b](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0640b90606d8692d1eed6eb6c810f028ddc2ea)), closes [#459](https://github.com/ptarmiganlabs/ctrl-q/issues/459)
* **script-get:** Make it possible to get only the app script, w/o any log info ([cfdb900](https://github.com/ptarmiganlabs/ctrl-q/commit/cfdb900684e43bce9b721436014a85ce73398e9f)), closes [#460](https://github.com/ptarmiganlabs/ctrl-q/issues/460)


### Miscellaneous

* **deps:** Update dependencies ([bc90ea9](https://github.com/ptarmiganlabs/ctrl-q/commit/bc90ea9d8b51c6de67a318bc94217300ec0cad4f))
* Fix incorrect zip file names for release binaries ([86ba819](https://github.com/ptarmiganlabs/ctrl-q/commit/86ba819261eb0e24bbe190ea45442bf6d17450fa)), closes [#461](https://github.com/ptarmiganlabs/ctrl-q/issues/461)
* Revert to normal version numbering ([c4ccff5](https://github.com/ptarmiganlabs/ctrl-q/commit/c4ccff5837fb0ad406d7f75f21e6e9d08afa1075))

## [3.16.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.16.0...ctrl-q-v3.16.0) (2024-03-12)


### Features

* **sessions:** Add session-get and session-delete commands ([52947a7](https://github.com/ptarmiganlabs/ctrl-q/commit/52947a79ad989f5f1b2d18461b5ab135c301c3bf))


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Improve help texts for and sort available sub-commands in help texts. ([ec9f1ad](https://github.com/ptarmiganlabs/ctrl-q/commit/ec9f1ad4c8b218f8961761ba971a1f9ad91c7381)), closes [#431](https://github.com/ptarmiganlabs/ctrl-q/issues/431)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))
* **variable-delete:** Make it possible to delete variables from several apps in one go ([6897603](https://github.com/ptarmiganlabs/ctrl-q/commit/6897603f09582536b1ee5de755843c9266c88487))
* **variable-get:** Now possible to get variables from more than one app in a single Ctrl-Q execution ([6615afa](https://github.com/ptarmiganlabs/ctrl-q/commit/6615afa9edee6f42496a4bc3f35b1ba9a0abb8f6)), closes [#430](https://github.com/ptarmiganlabs/ctrl-q/issues/430)


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([423c2d4](https://github.com/ptarmiganlabs/ctrl-q/commit/423c2d45b7b18011aa6cfda78817b16fb24b8597))
* **main:** release ctrl-q 3.15.2 ([6dc9810](https://github.com/ptarmiganlabs/ctrl-q/commit/6dc9810996e34f523faa7190b44f9c2997804ce4))
* **main:** release ctrl-q 3.15.2 ([6f64c8b](https://github.com/ptarmiganlabs/ctrl-q/commit/6f64c8b95964798a3726e95edc880a0fa830876b))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))
* **main:** release ctrl-q 3.16.0 ([5cdab52](https://github.com/ptarmiganlabs/ctrl-q/commit/5cdab523177df04e0a8b69b6a3354cb4969131da))
* **main:** release ctrl-q 3.16.0 ([fcb01ea](https://github.com/ptarmiganlabs/ctrl-q/commit/fcb01eac0fdf9c6ed1555fa66991942862d6f344))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)
* **variable-get:** Add a bit more verbose logging about Sense and engine versions ([3bbcf91](https://github.com/ptarmiganlabs/ctrl-q/commit/3bbcf91c3c255317dbe3bc1fb4d042a0e3b4295b))

## [3.16.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.16.0...ctrl-q-v3.16.0) (2024-03-12)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Improve help texts for and sort available sub-commands in help texts. ([ec9f1ad](https://github.com/ptarmiganlabs/ctrl-q/commit/ec9f1ad4c8b218f8961761ba971a1f9ad91c7381)), closes [#431](https://github.com/ptarmiganlabs/ctrl-q/issues/431)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))
* **variable-delete:** Make it possible to delete variables from several apps in one go ([6897603](https://github.com/ptarmiganlabs/ctrl-q/commit/6897603f09582536b1ee5de755843c9266c88487))
* **variable-get:** Now possible to get variables from more than one app in a single Ctrl-Q execution ([6615afa](https://github.com/ptarmiganlabs/ctrl-q/commit/6615afa9edee6f42496a4bc3f35b1ba9a0abb8f6)), closes [#430](https://github.com/ptarmiganlabs/ctrl-q/issues/430)


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([423c2d4](https://github.com/ptarmiganlabs/ctrl-q/commit/423c2d45b7b18011aa6cfda78817b16fb24b8597))
* **main:** release ctrl-q 3.15.2 ([6dc9810](https://github.com/ptarmiganlabs/ctrl-q/commit/6dc9810996e34f523faa7190b44f9c2997804ce4))
* **main:** release ctrl-q 3.15.2 ([6f64c8b](https://github.com/ptarmiganlabs/ctrl-q/commit/6f64c8b95964798a3726e95edc880a0fa830876b))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))
* **main:** release ctrl-q 3.16.0 ([fcb01ea](https://github.com/ptarmiganlabs/ctrl-q/commit/fcb01eac0fdf9c6ed1555fa66991942862d6f344))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)
* **variable-get:** Add a bit more verbose logging about Sense and engine versions ([3bbcf91](https://github.com/ptarmiganlabs/ctrl-q/commit/3bbcf91c3c255317dbe3bc1fb4d042a0e3b4295b))

## [3.16.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.2...ctrl-q-v3.16.0) (2024-03-11)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Improve help texts for and sort available sub-commands in help texts. ([ec9f1ad](https://github.com/ptarmiganlabs/ctrl-q/commit/ec9f1ad4c8b218f8961761ba971a1f9ad91c7381)), closes [#431](https://github.com/ptarmiganlabs/ctrl-q/issues/431)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))
* **variable-get:** Now possible to get variables from more than one app in a single Ctrl-Q execution ([6615afa](https://github.com/ptarmiganlabs/ctrl-q/commit/6615afa9edee6f42496a4bc3f35b1ba9a0abb8f6)), closes [#430](https://github.com/ptarmiganlabs/ctrl-q/issues/430)


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([423c2d4](https://github.com/ptarmiganlabs/ctrl-q/commit/423c2d45b7b18011aa6cfda78817b16fb24b8597))
* **main:** release ctrl-q 3.15.2 ([6dc9810](https://github.com/ptarmiganlabs/ctrl-q/commit/6dc9810996e34f523faa7190b44f9c2997804ce4))
* **main:** release ctrl-q 3.15.2 ([6f64c8b](https://github.com/ptarmiganlabs/ctrl-q/commit/6f64c8b95964798a3726e95edc880a0fa830876b))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)
* **variable-get:** Add a bit more verbose logging about Sense and engine versions ([3bbcf91](https://github.com/ptarmiganlabs/ctrl-q/commit/3bbcf91c3c255317dbe3bc1fb4d042a0e3b4295b))

## [3.15.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.2...ctrl-q-v3.15.2) (2024-03-10)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Improve help texts for and sort available sub-commands in help texts. ([ec9f1ad](https://github.com/ptarmiganlabs/ctrl-q/commit/ec9f1ad4c8b218f8961761ba971a1f9ad91c7381)), closes [#431](https://github.com/ptarmiganlabs/ctrl-q/issues/431)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))
* **variable-get:** Now possible to get variables from more than one app in a single Ctrl-Q execution ([6615afa](https://github.com/ptarmiganlabs/ctrl-q/commit/6615afa9edee6f42496a4bc3f35b1ba9a0abb8f6)), closes [#430](https://github.com/ptarmiganlabs/ctrl-q/issues/430)


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([6dc9810](https://github.com/ptarmiganlabs/ctrl-q/commit/6dc9810996e34f523faa7190b44f9c2997804ce4))
* **main:** release ctrl-q 3.15.2 ([6f64c8b](https://github.com/ptarmiganlabs/ctrl-q/commit/6f64c8b95964798a3726e95edc880a0fa830876b))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)
* **variable-get:** Add a bit more verbose logging about Sense and engine versions ([3bbcf91](https://github.com/ptarmiganlabs/ctrl-q/commit/3bbcf91c3c255317dbe3bc1fb4d042a0e3b4295b))

## [3.15.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.2...ctrl-q-v3.15.2) (2024-03-08)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([6f64c8b](https://github.com/ptarmiganlabs/ctrl-q/commit/6f64c8b95964798a3726e95edc880a0fa830876b))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)

## [3.15.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.2...ctrl-q-v3.15.2) (2024-03-08)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([ccc038b](https://github.com/ptarmiganlabs/ctrl-q/commit/ccc038b589a03faa4b6015ed2d17876d4ad772f1))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)

## 3.15.2 (2024-03-08)


### Bug Fixes

* **app-upload:** More consistent logging during up/download of Sense apps ([32f6d70](https://github.com/ptarmiganlabs/ctrl-q/commit/32f6d70e9b6dba506fd1d2a3e8fe233ed59ee618))
* **certificates:** Handle --secure flag correctly, rejecting/allowing unauthorised certificates based on this flag. ([4634693](https://github.com/ptarmiganlabs/ctrl-q/commit/463469381ddd95f620ef45318552d915df7723e1)), closes [#416](https://github.com/ptarmiganlabs/ctrl-q/issues/416)
* Make error logging consistent across all of Ctrl-Q ([9b65770](https://github.com/ptarmiganlabs/ctrl-q/commit/9b65770e5edd2611be931420fc44839aecf9c237))
* **task-get:** More consistent logging when exporting task definitions to disk file ([8a4d9bb](https://github.com/ptarmiganlabs/ctrl-q/commit/8a4d9bb52cbea3ca732a5c9c6dce07dea7c7e035))
* **task-vis:** Add `--secure` command line option to task-vis command ([766725c](https://github.com/ptarmiganlabs/ctrl-q/commit/766725c02381962eb1931fc1f3a2a1c334a2008d))
* **task-vis:** Add more robust error handling ([dd7feac](https://github.com/ptarmiganlabs/ctrl-q/commit/dd7feac71408f1f7fbd21c4a50118f44238ff4d1))


### Miscellaneous

* Clean up source code formatting ([6baccc0](https://github.com/ptarmiganlabs/ctrl-q/commit/6baccc0197fe98d4cddfbd157305050ef620dfbb))
* **deps:** Upgrade app upload retry logic ([98b3a0d](https://github.com/ptarmiganlabs/ctrl-q/commit/98b3a0d28f5b26aa80acba837f41f3d6a49d7114))
* **main:** release ctrl-q 3.15.2 ([f12d7c5](https://github.com/ptarmiganlabs/ctrl-q/commit/f12d7c57f4ad6ef0b0ef28521ae17b6c5c5a53fa))


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)

## [3.15.0](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.14.0...v3.15.0) (2023-12-25)


### Features

* Add JWT auth option for all Ctrl-Q commands ([e1e9f3d](https://github.com/ptarmiganlabs/ctrl-q/commit/e1e9f3d5d0aa03d4c5fd137597c214f58204a1d9)), closes [#155](https://github.com/ptarmiganlabs/ctrl-q/issues/155)
* **help:** Add app version as part of help message ([443bf3f](https://github.com/ptarmiganlabs/ctrl-q/commit/443bf3fa78c902be2210f14d3f688d929bbc5ee7))
* **task-vis:** Visualise tasks in network view ([8c01cd3](https://github.com/ptarmiganlabs/ctrl-q/commit/8c01cd3733513982b07b9172c58c3c2c2de6eb5e)), closes [#366](https://github.com/ptarmiganlabs/ctrl-q/issues/366)
* **version:** New version command ([aa02c0e](https://github.com/ptarmiganlabs/ctrl-q/commit/aa02c0ebf16df55b5a69c8ef0004bb7143e60463))


### Bug Fixes

* **get-task:** Fix cyclic dependency issue in task trees ([8af8e94](https://github.com/ptarmiganlabs/ctrl-q/commit/8af8e94591cdc66150a3f3cb21398cc92934bc33)), closes [#291](https://github.com/ptarmiganlabs/ctrl-q/issues/291)
* Incorrect description of --port option ([a6bee97](https://github.com/ptarmiganlabs/ctrl-q/commit/a6bee9763756dc8003cb8d3b4f0e0d4a72c52fe7))
* **set-task-cp:** Respect --overwrite option when setting CPs for reload tasks ([95eabab](https://github.com/ptarmiganlabs/ctrl-q/commit/95eabab88b6f933ad5b8a6d4eb2b705f7bb173eb)), closes [#356](https://github.com/ptarmiganlabs/ctrl-q/issues/356)
* **task-vis:** Add favicons for task network view ([5cfb204](https://github.com/ptarmiganlabs/ctrl-q/commit/5cfb204d62fcad60eaed891f03d72f95dd0a5118))


### Miscellaneous

* Add unit tests for app-export command ([014096e](https://github.com/ptarmiganlabs/ctrl-q/commit/014096eb3e3d15905ae6b9b1063db3c4b519a1ae))
* Add unit tests for app-import command ([9b79bf1](https://github.com/ptarmiganlabs/ctrl-q/commit/9b79bf1b24139a402202e9e5ffb23eb4e59eaf37))
* Add unit tests for bookmark-get command ([4085282](https://github.com/ptarmiganlabs/ctrl-q/commit/4085282e2948da82188b73a82438f0cde16f554f))
* Add unit tests for script-get command ([855b714](https://github.com/ptarmiganlabs/ctrl-q/commit/855b714022ca56027f704f3007f3f3b3e5e5d86b))
* Add unit tests for task-custom-property-set command ([cacdbf4](https://github.com/ptarmiganlabs/ctrl-q/commit/cacdbf404d271008a3159794467bce6282f8bff3))
* Add unit tests for task-get command ([42fd155](https://github.com/ptarmiganlabs/ctrl-q/commit/42fd155a5a8eb6182c96d53bbb2b5308860719db))
* Add unit tests for task-import command ([be0ca72](https://github.com/ptarmiganlabs/ctrl-q/commit/be0ca72457848da861adf043fe55a12ad828d1dd))
* **deps:** Update dependencies ([f3e9be4](https://github.com/ptarmiganlabs/ctrl-q/commit/f3e9be46ad7d6d28bc4401bd613efb297a9379b5))

## [3.14.0](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.13.2...v3.14.0) (2023-11-19)

### Features

- **connection-test:** Add command to test connection to Sense server ([328886e](https://github.com/ptarmiganlabs/ctrl-q/commit/328886e9ec92a553a732ed6f7f0d17bacfd9b2dc)), closes [#328](https://github.com/ptarmiganlabs/ctrl-q/issues/328)
- **docs:** Move all documentation to ctrl-q.ptarmiganlabs.com ([e60dc31](https://github.com/ptarmiganlabs/ctrl-q/commit/e60dc31c27c889524e0e634ac03c6517285783d6))
- **task-get:** Simplify --table-details option ([2cbd470](https://github.com/ptarmiganlabs/ctrl-q/commit/2cbd4704213ba4a043662b462e980f7a47152553)), closes [#345](https://github.com/ptarmiganlabs/ctrl-q/issues/345)
- **task-get:** Sort tasks in task tree alphabetically using task name ([ca96d4c](https://github.com/ptarmiganlabs/ctrl-q/commit/ca96d4cb0648b71f437bfe457855e9adbc2f0a9d))
- **task-import:** Support external program tasks when importing tasks ([8060a1b](https://github.com/ptarmiganlabs/ctrl-q/commit/8060a1bda84a685ef150c8e46d8adb0d13cd3f46))

### Bug Fixes

- Fix broken CI badge in readme file ([57cfae9](https://github.com/ptarmiganlabs/ctrl-q/commit/57cfae9933fdc71f24172d488aae10a0ba6e924a))
- **task-get:** --table-details wo parameters now return all task details in table ([1a9a587](https://github.com/ptarmiganlabs/ctrl-q/commit/1a9a587a641eac2aa7328f39421218b3973c8f83)), closes [#332](https://github.com/ptarmiganlabs/ctrl-q/issues/332)
- **task-get:** --task-type option is now invalid for task trees ([1bddb6a](https://github.com/ptarmiganlabs/ctrl-q/commit/1bddb6a1dc685e50f6636a6192d49b59a8ed7837))
- **task-get:** Add better debug logging when showing task trees ([c66ab77](https://github.com/ptarmiganlabs/ctrl-q/commit/c66ab77fd88cfa2c3a336f10a040dc18a94c49c4))
- **task-get:** No more duplicate, top-level schema tasks in task tree, for a specfic task. ([d3fe908](https://github.com/ptarmiganlabs/ctrl-q/commit/d3fe9087758ed0476552f2bf2ef86bf77693d0b8)), closes [#333](https://github.com/ptarmiganlabs/ctrl-q/issues/333)
- **task-import:** Correctly handle upstream ext pgm tasks in reload task composite events ([53e076b](https://github.com/ptarmiganlabs/ctrl-q/commit/53e076b5742a2412cffb9176431b2476af996b75)), closes [#331](https://github.com/ptarmiganlabs/ctrl-q/issues/331)
- **task-import:** Importing tasks from CSV file no longer gives "premature close" ([e06f1a9](https://github.com/ptarmiganlabs/ctrl-q/commit/e06f1a9dc6499d93ddc192e720c46c1e3af2da7c)), closes [#323](https://github.com/ptarmiganlabs/ctrl-q/issues/323)

### Miscellaneous

- Add unit tests ([50bbae1](https://github.com/ptarmiganlabs/ctrl-q/commit/50bbae1548d59f27cc51f6bafff16483a8ee2c0c))
- **deps:** update actions/setup-node action to v4 ([aea1d71](https://github.com/ptarmiganlabs/ctrl-q/commit/aea1d713f2ed36ece503d1e3a11282d9bc269d17))
- **deps:** Update dependencies ([5351e29](https://github.com/ptarmiganlabs/ctrl-q/commit/5351e296bd373f43d7b58ccd6e430a199721398b))
- **deps:** Update dependencies to stay safe and secure ([568a25f](https://github.com/ptarmiganlabs/ctrl-q/commit/568a25fa6c7b34bdf430dc080e776fed2e261a74))

### Documentation

- Add more task import examples ([0ca7363](https://github.com/ptarmiganlabs/ctrl-q/commit/0ca7363038f635a0361cee95c1a8a1145e62be1a))

## [3.13.2](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.13.1...v3.13.2) (2023-10-06)

### Bug Fixes

- Handle relative config file paths ([72285e4](https://github.com/ptarmiganlabs/ctrl-q/commit/72285e4d6130f9ea1bdc96b25ada7491b265788f))
- **master-item-dim-get:** Get correct colors for drill-down dimensions ([f0fae78](https://github.com/ptarmiganlabs/ctrl-q/commit/f0fae780c4dff16ac993dfe1f41cb49edb4847a5)), closes [#314](https://github.com/ptarmiganlabs/ctrl-q/issues/314)
- **task-get:** Fix task tree bug when task is triggered by ext program task ([98584b7](https://github.com/ptarmiganlabs/ctrl-q/commit/98584b7e0bad97c73e5aaa1015625e2eae5f1aee))
- **task-get:** Include all tasks in task trees ([3fbc4d3](https://github.com/ptarmiganlabs/ctrl-q/commit/3fbc4d307179476e89068e5db2030b990e6603da)), closes [#308](https://github.com/ptarmiganlabs/ctrl-q/issues/308)
- **task-get:** Make "reload" and "ext-program" default for --task-type option ([9b13cce](https://github.com/ptarmiganlabs/ctrl-q/commit/9b13cce142ce07e8e56479f3dfa1b693f55e20da))
- **task-get:** Warn if --task-type is used in task tree view ([1fe4764](https://github.com/ptarmiganlabs/ctrl-q/commit/1fe47642bc8c1e7ac516110febb925e354f907b2)), closes [#319](https://github.com/ptarmiganlabs/ctrl-q/issues/319)

### Miscellaneous

- **deps:** Update dependencies to stay safe and secure ([ce0f7b4](https://github.com/ptarmiganlabs/ctrl-q/commit/ce0f7b42fe53b9bbeb7389345d537ffb0e2ef3a2))

## [3.13.1](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.13.1...v3.13.1) (2023-09-27)

### Miscellaneous

- Fix broken build flow post refactoring ([1c91e56](https://github.com/ptarmiganlabs/ctrl-q/commit/1c91e5651c0a408cf2527abae65763a8aa6bf09f))
- Fix broken Linux build ([7847a6d](https://github.com/ptarmiganlabs/ctrl-q/commit/7847a6def5dafa180361fce48d493d8be68058b7))
- **main:** release 3.13.1 ([3a42857](https://github.com/ptarmiganlabs/ctrl-q/commit/3a428572fbb2f364ab45fdcb8b26ae33aec84c80))
- Recover from build refactoring ([bd865b6](https://github.com/ptarmiganlabs/ctrl-q/commit/bd865b67c14787dbc8e1fed562f984d8a6a56e43))

## [3.13.1](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.13.0...v3.13.1) (2023-09-27)

### Miscellaneous

- Fix broken build flow post refactoring ([1c91e56](https://github.com/ptarmiganlabs/ctrl-q/commit/1c91e5651c0a408cf2527abae65763a8aa6bf09f))

## [3.13.0](https://github.com/ptarmiganlabs/ctrl-q/compare/v3.12.0...v3.13.0) (2023-09-26)

### Miscellaneous

- Add insiders build step in CI pipeline ([97e933f](https://github.com/ptarmiganlabs/ctrl-q/commit/97e933fb89aed09fbac285a2ba870b3010a02cf2)), closes [#303](https://github.com/ptarmiganlabs/ctrl-q/issues/303)
- **deps:** update actions/checkout action to v4 ([460fd6b](https://github.com/ptarmiganlabs/ctrl-q/commit/460fd6b00e205835ad26c584c6a786c68dde483f))
- **deps:** update crazy-max/ghaction-virustotal action to v4 ([49d4c23](https://github.com/ptarmiganlabs/ctrl-q/commit/49d4c23e8e308baf51920dc674b50050c2f38251))
- Fix version number after build refactoring ([5f4347c](https://github.com/ptarmiganlabs/ctrl-q/commit/5f4347c640c58f9a31d8399350af7cededf8b7da))

### Documentation

- **app-import:** Add description of publishing apps after import from QVF files ([072a14f](https://github.com/ptarmiganlabs/ctrl-q/commit/072a14fc36438cfc9d0a85e99bc251cf7fe92dd8)), closes [#302](https://github.com/ptarmiganlabs/ctrl-q/issues/302)
- **app-import:** Add link to app import Excel file columns ([28cd76a](https://github.com/ptarmiganlabs/ctrl-q/commit/28cd76ae51b5eb4992dfcff3f670655b456e15a5)), closes [#301](https://github.com/ptarmiganlabs/ctrl-q/issues/301)

## [3.4.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.0...ctrl-q-v3.4.1) (2023-02-08)

### Bug Fixes

- Incorrect version number in binaries ([a363490](https://github.com/ptarmiganlabs/ctrl-q/commit/a363490d3f85fa61db1ccb6ad4525dd887a6ae95))

## [3.4.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.3.0...ctrl-q-v3.4.0) (2023-02-07)

### Features

- Add task import limit paramater -- limit-import-count ([b878a29](https://github.com/ptarmiganlabs/ctrl-q/commit/b878a29e4f5ddf6f2f13453a98c0fe34ca188ea4))

## [3.3.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.2.0...ctrl-q-v3.3.0) (2023-01-27)

### Features

- Add command for listing/exporting info about reload tasks ([9c1e0c9](https://github.com/ptarmiganlabs/ctrl-q/commit/9c1e0c9b5aeb87f5e150819ac7cd3810f3d6bbed)), closes [#105](https://github.com/ptarmiganlabs/ctrl-q/issues/105)
- Log Ctrl-Q info to console on startup ([9dccc3c](https://github.com/ptarmiganlabs/ctrl-q/commit/9dccc3cc7de18fa8694c16c530b9e7c3c5584dd8)), closes [#110](https://github.com/ptarmiganlabs/ctrl-q/issues/110)
- New command for bulk import of reload tasks ([30bd69a](https://github.com/ptarmiganlabs/ctrl-q/commit/30bd69a69d8faff6271b83b6dc024b0cde27d767)), closes [#79](https://github.com/ptarmiganlabs/ctrl-q/issues/79)
- New command for updating reload task custom properties ([288672b](https://github.com/ptarmiganlabs/ctrl-q/commit/288672b2af635158b3a7590ad84899e56f83abc8)), closes [#106](https://github.com/ptarmiganlabs/ctrl-q/issues/106)

### Bug Fixes

- Incorrect owner shown for bookmarks, measures & dimensions ([b571619](https://github.com/ptarmiganlabs/ctrl-q/commit/b571619d8a858d511e13123173127e624e00b9cb)), closes [#121](https://github.com/ptarmiganlabs/ctrl-q/issues/121)
- Logging to console fails when importing master items from Excel file ([d81a36b](https://github.com/ptarmiganlabs/ctrl-q/commit/d81a36b079f88d344c251daf0e9780242eb364ae)), closes [#112](https://github.com/ptarmiganlabs/ctrl-q/issues/112)

### Miscellaneous

- **deps:** Update dependencies to stay safe and secure ([af88014](https://github.com/ptarmiganlabs/ctrl-q/commit/af88014e035d85403355a25f6a8e835e258ba847))
- **deps:** Update dependencies to stay secure and performant ([7881750](https://github.com/ptarmiganlabs/ctrl-q/commit/78817506c5d2bb49954ffc01a9b900d9c90d57fa))
- Update dependencies to stay safe and secure ([25d48c7](https://github.com/ptarmiganlabs/ctrl-q/commit/25d48c72122d1bca62d97bbfc99d3b498ee771e7))

## [3.2.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.2.0...ctrl-q-v3.2.0) (2022-10-16)

### Features

- Add signing of Windows binaries ([0f98464](https://github.com/ptarmiganlabs/ctrl-q/commit/0f984643335c88450974e73f0068b4bf8bd44b1a))
- Test enhanced virus scan as part of build process ([ed92bb4](https://github.com/ptarmiganlabs/ctrl-q/commit/ed92bb46c285c93fd08ad7eadb5f0e5846a83b08))

### Bug Fixes

- Find working solution for virus scanner. ([9e16e0a](https://github.com/ptarmiganlabs/ctrl-q/commit/9e16e0ae4f0193ad8ab152b6a84c8f541aa1e090))

### Documentation

- Update README wrt security ([fc29ead](https://github.com/ptarmiganlabs/ctrl-q/commit/fc29ead7fb1f8d1d6b3bf1398c52fa468d15f9be))

### Miscellaneous

- **main:** release ctrl-q 3.2.0 ([3b97671](https://github.com/ptarmiganlabs/ctrl-q/commit/3b97671615ccbe66a973337c716a0eb170e63d02))
- **main:** release ctrl-q 3.2.0 ([61b986a](https://github.com/ptarmiganlabs/ctrl-q/commit/61b986a7f024961bdcfad5f4909dfe377539993a))

## [3.2.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.2.0...ctrl-q-v3.2.0) (2022-10-16)

### Features

- Add signing of Windows binaries ([0f98464](https://github.com/ptarmiganlabs/ctrl-q/commit/0f984643335c88450974e73f0068b4bf8bd44b1a))
- Test enhanced virus scan as part of build process ([ed92bb4](https://github.com/ptarmiganlabs/ctrl-q/commit/ed92bb46c285c93fd08ad7eadb5f0e5846a83b08))

### Bug Fixes

- Find working solution for virus scanner. ([9e16e0a](https://github.com/ptarmiganlabs/ctrl-q/commit/9e16e0ae4f0193ad8ab152b6a84c8f541aa1e090))

### Documentation

- Update README wrt security ([fc29ead](https://github.com/ptarmiganlabs/ctrl-q/commit/fc29ead7fb1f8d1d6b3bf1398c52fa468d15f9be))

### Miscellaneous

- **main:** release ctrl-q 3.2.0 ([61b986a](https://github.com/ptarmiganlabs/ctrl-q/commit/61b986a7f024961bdcfad5f4909dfe377539993a))

## [3.2.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.1.3...ctrl-q-v3.2.0) (2022-10-16)

### Features

- Test enhanced virus scan as part of build process ([ed92bb4](https://github.com/ptarmiganlabs/ctrl-q/commit/ed92bb46c285c93fd08ad7eadb5f0e5846a83b08))

### Documentation

- Update README wrt security ([fc29ead](https://github.com/ptarmiganlabs/ctrl-q/commit/fc29ead7fb1f8d1d6b3bf1398c52fa468d15f9be))

## [3.1.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.1.2...ctrl-q-v3.1.3) (2022-10-14)

### Documentation

- Add animated demo of Ctrl-Q to README file ([3f555ac](https://github.com/ptarmiganlabs/ctrl-q/commit/3f555ac5aafc2f145ec9ff73d644d04f992cf520))

## [3.1.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.1.1...ctrl-q-v3.1.2) (2022-10-14)

### Bug Fixes

- Table headings now left aligned instead of centered ([5e6c591](https://github.com/ptarmiganlabs/ctrl-q/commit/5e6c5911866491d3f00742f3517b8096bc6f3a56)), closes [#89](https://github.com/ptarmiganlabs/ctrl-q/issues/89)

### Documentation

- Describe how animated captures of terminal sessions are done ([34e73c9](https://github.com/ptarmiganlabs/ctrl-q/commit/34e73c95b730f57ef8405bfb86b676c15238c2b5))

## [3.1.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.1.0...ctrl-q-v3.1.1) (2022-10-14)

### Bug Fixes

- Get rid of race condition causing commands to fail sometimes ([6a4b364](https://github.com/ptarmiganlabs/ctrl-q/commit/6a4b3643c721dd470324bc727a37644c039434d7))

## [3.1.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.0.1...ctrl-q-v3.1.0) (2022-10-14)

### Features

- Verify that files on disk exist before trying to open them + better error messages when files do not exist ([ff74012](https://github.com/ptarmiganlabs/ctrl-q/commit/ff740126fef06e726dd0453b1a12ed0ae52c0044)), closes [#81](https://github.com/ptarmiganlabs/ctrl-q/issues/81)

### Bug Fixes

- Don't warn for header row in Excel file when importing master items ([2ef9d0e](https://github.com/ptarmiganlabs/ctrl-q/commit/2ef9d0ee75391ac3b4aa2566993b1976070c0e67)), closes [#82](https://github.com/ptarmiganlabs/ctrl-q/issues/82)

### Documentation

- Fixing typos, adding logo ([39afc11](https://github.com/ptarmiganlabs/ctrl-q/commit/39afc115e1353604c0ab5f101ff087ff7560d876))
- Remove example files as they are already included in the README ([0743eeb](https://github.com/ptarmiganlabs/ctrl-q/commit/0743eeb47a02c03bbbbd70177d36442d377ac1bf))

### Refactoring

- General code cleanup and restructuring ([c43941e](https://github.com/ptarmiganlabs/ctrl-q/commit/c43941ee3a1a31ed1ef1fb60559e097c8c25e589))

### Miscellaneous

- **deps:** Updated dependencies ([55368ea](https://github.com/ptarmiganlabs/ctrl-q/commit/55368ea3e42abd5f6f9ea91c0792d8fe7928ea34))

## [3.0.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.0.0...ctrl-q-v3.0.1) (2022-10-13)

### Bug Fixes

- Fix broken Linux build ([7772733](https://github.com/ptarmiganlabs/ctrl-q/commit/77727336e7f5798c19e21cbb2651a2c7786460d6))

## [3.0.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v2.1.1...ctrl-q-v3.0.0) (2022-10-13)

### ⚠ BREAKING CHANGES

- First public release
- Refactor options when importing master items from Excel file
- Refactor all commands to be <entity>-<verb>
- Refactor parameter names for import-master-items-from-Excel command
- Change all commands to be <entity>-<verb>

### Features

- add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))
- Add delete-all option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add dry-run option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add option to limit how many master items are imported from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add option to select auth method to Sense server ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q/issues/31) [#30](https://github.com/ptarmiganlabs/ctrl-q/issues/30) [#29](https://github.com/ptarmiganlabs/ctrl-q/issues/29) [#32](https://github.com/ptarmiganlabs/ctrl-q/issues/32) [#38](https://github.com/ptarmiganlabs/ctrl-q/issues/38) [#39](https://github.com/ptarmiganlabs/ctrl-q/issues/39)
- Add option to select authentication method to Sense server ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q/issues/31)
- Add optional limit to how many master items are imported from Excel file ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))
- Add test data Excel file for master item import ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1)), closes [#45](https://github.com/ptarmiganlabs/ctrl-q/issues/45) [#47](https://github.com/ptarmiganlabs/ctrl-q/issues/47)
- Build Linux binary during CI process ([8f64529](https://github.com/ptarmiganlabs/ctrl-q/commit/8f645298232950b5bb98178bd3719072ffdd9009)), closes [#62](https://github.com/ptarmiganlabs/ctrl-q/issues/62)
- First public release ([24eb9cc](https://github.com/ptarmiganlabs/ctrl-q/commit/24eb9ccf9b6c0488e1c6b58884e612f3957204ef))
- Refactor all commands to be <entity>-<verb> ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Refactor options when importing master items from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))

### Bug Fixes

- **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
- Dry-run always used when used --delete-all ([fa0b7db](https://github.com/ptarmiganlabs/ctrl-q/commit/fa0b7dbca8716fe649ac79fa34cc760235470f1e)), closes [#51](https://github.com/ptarmiganlabs/ctrl-q/issues/51)
- move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))

### Documentation

- add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
- Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
- add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
- add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
- CI debug ([fa63993](https://github.com/ptarmiganlabs/ctrl-q/commit/fa6399360e9ba8606b698948c8bbabc8b62a9ff9))
- CI debug ([a8776dd](https://github.com/ptarmiganlabs/ctrl-q/commit/a8776ddc65c065aef6361af04285d73a9ce4cf1c))
- CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
- CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
- polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

### Miscellaneous

- add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
- **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
- **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
- **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
- **main:** release ctrl-q-cli 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q/commit/d82314821a5289a2939b302512b0814c42eb4b69))
- **main:** release ctrl-q-cli 1.1.0 ([129bddb](https://github.com/ptarmiganlabs/ctrl-q/commit/129bddbb34c4e7fefc383fc3e5f31025f38b0c6c))
- **main:** release ctrl-q-cli 1.2.0 ([70a1ca3](https://github.com/ptarmiganlabs/ctrl-q/commit/70a1ca3ac597cd021dd3eecbe55ce3d1baaa7355))
- **main:** release ctrl-q-cli 1.3.0 ([315a091](https://github.com/ptarmiganlabs/ctrl-q/commit/315a0915482317e5b4fcbfc29492db4716623300))
- **main:** release ctrl-q-cli 2.0.0 ([f56ec35](https://github.com/ptarmiganlabs/ctrl-q/commit/f56ec35cff717ec822d5687e43aded25f16a00c5))
- **main:** release ctrl-q-cli 2.1.0 ([31c6305](https://github.com/ptarmiganlabs/ctrl-q/commit/31c6305753ce2b7cf478eee30ab7b2ea8755549e))
- **main:** release ctrl-q-cli 2.1.1 ([d7ace48](https://github.com/ptarmiganlabs/ctrl-q/commit/d7ace487a45f75fcd6a64d2d352b9a4ca996b5ee))
- release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

### Refactoring

- Add better debug logging when importing master items ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1))
- Change all commands to be <entity>-<verb> ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#32](https://github.com/ptarmiganlabs/ctrl-q/issues/32)
- Name change to Ctrl-Q rather than Ctrl-Q CLI ([e4b3e6b](https://github.com/ptarmiganlabs/ctrl-q/commit/e4b3e6bfb86fbd7baa9b35a656b10ae56b2b0102))
- Refactor parameter names for import-master-items-from-Excel command ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))

### [2.1.1](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v2.1.0...ctrl-q-cli-v2.1.1) (2022-05-08)

### Bug Fixes

- Dry-run always used when used --delete-all ([fa0b7db](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/fa0b7dbca8716fe649ac79fa34cc760235470f1e)), closes [#51](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/51)

## [2.1.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v2.0.0...ctrl-q-v2.1.0) (2022-05-07)

### Features

- Add test data Excel file for master item import ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1)), closes [#45](https://github.com/ptarmiganlabs/ctrl-q/issues/45) [#47](https://github.com/ptarmiganlabs/ctrl-q/issues/47)

### Refactoring

- Add better debug logging when importing master items ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1))

## [2.0.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v1.3.0...ctrl-q-v2.0.0) (2022-05-07)

### ⚠ BREAKING CHANGES

- Refactor options when importing master items from Excel file
- Refactor all commands to be <entity>-<verb>
- Refactor parameter names for import-master-items-from-Excel command
- Change all commands to be <entity>-<verb>

### Features

- Add delete-all option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add dry-run option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add option to limit how many master items are imported from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Add option to select auth method to Sense server ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q/issues/31) [#30](https://github.com/ptarmiganlabs/ctrl-q/issues/30) [#29](https://github.com/ptarmiganlabs/ctrl-q/issues/29) [#32](https://github.com/ptarmiganlabs/ctrl-q/issues/32) [#38](https://github.com/ptarmiganlabs/ctrl-q/issues/38) [#39](https://github.com/ptarmiganlabs/ctrl-q/issues/39)
- Add option to select authentication method to Sense server ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q/issues/31)
- Add optional limit to how many master items are imported from Excel file ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))
- Refactor all commands to be <entity>-<verb> ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
- Refactor options when importing master items from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))

### Refactoring

- Change all commands to be <entity>-<verb> ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#32](https://github.com/ptarmiganlabs/ctrl-q/issues/32)
- Refactor parameter names for import-master-items-from-Excel command ([c426894](https://github.com/ptarmiganlabs/ctrl-q/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))

## [1.3.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v1.2.0...ctrl-q-v1.3.0) (2022-05-05)

### Features

- add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))

### Bug Fixes

- **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
- move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))

### Miscellaneous

- add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
- **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
- **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
- **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
- **main:** release ctrl-q 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q/commit/d82314821a5289a2939b302512b0814c42eb4b69))
- **main:** release ctrl-q 1.1.0 ([129bddb](https://github.com/ptarmiganlabs/ctrl-q/commit/129bddbb34c4e7fefc383fc3e5f31025f38b0c6c))
- **main:** release ctrl-q 1.2.0 ([70a1ca3](https://github.com/ptarmiganlabs/ctrl-q/commit/70a1ca3ac597cd021dd3eecbe55ce3d1baaa7355))
- release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

### Documentation

- add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
- Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
- add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
- add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
- CI debug ([fa63993](https://github.com/ptarmiganlabs/ctrl-q/commit/fa6399360e9ba8606b698948c8bbabc8b62a9ff9))
- CI debug ([a8776dd](https://github.com/ptarmiganlabs/ctrl-q/commit/a8776ddc65c065aef6361af04285d73a9ce4cf1c))
- CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
- CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
- polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## [1.2.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v1.1.0...ctrl-q-v1.2.0) (2022-05-05)

### Features

- add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))

### Bug Fixes

- **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
- move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))

### Miscellaneous

- add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
- **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
- **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
- **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
- **main:** release ctrl-q 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q/commit/d82314821a5289a2939b302512b0814c42eb4b69))
- **main:** release ctrl-q 1.1.0 ([129bddb](https://github.com/ptarmiganlabs/ctrl-q/commit/129bddbb34c4e7fefc383fc3e5f31025f38b0c6c))
- release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

### Documentation

- add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
- Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
- add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
- add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
- CI debug ([a8776dd](https://github.com/ptarmiganlabs/ctrl-q/commit/a8776ddc65c065aef6361af04285d73a9ce4cf1c))
- CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
- CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
- polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## [1.1.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v1.0.0...ctrl-q-v1.1.0) (2022-05-05)

### Features

- add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))

### Bug Fixes

- **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
- move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))

### Miscellaneous

- add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
- **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
- **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
- **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
- **main:** release ctrl-q 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q/commit/d82314821a5289a2939b302512b0814c42eb4b69))
- release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

### Documentation

- add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
- Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
- add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
- add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
- CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
- CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
- polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## 1.0.0 (2022-05-05)

### Features

- add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))

### Bug Fixes

- **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
- move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))

### Documentation

- add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
- Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
- add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
- add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
- polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

### Miscellaneous

- add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
- **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
- **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
- **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
- release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

## 1.0.0 (2021-07-07)

### Features

- add bookmark list command ([0c6b7c1](https://www.github.com/ptarmiganlabs/ctrl-q/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))

### Bug Fixes

- move package.json to project root ([b554f41](https://www.github.com/ptarmiganlabs/ctrl-q/commit/b554f414a241b588504bf53e103a6f55961160aa))
- move package.json to src folder ([1d0098b](https://www.github.com/ptarmiganlabs/ctrl-q/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
- upgraded dependencies ([e4581ec](https://www.github.com/ptarmiganlabs/ctrl-q/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))
