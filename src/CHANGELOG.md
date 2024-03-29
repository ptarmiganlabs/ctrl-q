# Changelog

## [3.15.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.1...ctrl-q-v3.15.2) (2024-03-08)


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


### Refactoring

* Migrate from CJS to ESM ([23deb10](https://github.com/ptarmiganlabs/ctrl-q/commit/23deb1066cfb2f461b7cf9bb952670e2b60b1750)), closes [#400](https://github.com/ptarmiganlabs/ctrl-q/issues/400)

## [3.15.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.1...ctrl-q-v3.15.1) (2024-02-19)


### Miscellaneous

* **deps:** Update app dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* **deps:** Update build pipeline dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* **main:** release ctrl-q 3.15.1 ([a772047](https://github.com/ptarmiganlabs/ctrl-q/commit/a77204729e9024eae76e2e554946f057cbef8395))
* **main:** release ctrl-q 3.15.1 ([73174bb](https://github.com/ptarmiganlabs/ctrl-q/commit/73174bb40ace51166f6dc75ad273bebbc319250d))
* release-please debugging ([34eba8f](https://github.com/ptarmiganlabs/ctrl-q/commit/34eba8fa27ea4372e8d6d3ffcd3b11fa13d81982))
* **win:** Switch to new signing solution for Windows binaries ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))

## [3.15.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.15.1...ctrl-q-v3.15.1) (2024-02-18)


### Miscellaneous

* **deps:** Update app dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* **deps:** Update build pipeline dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* **main:** release ctrl-q 3.15.1 ([73174bb](https://github.com/ptarmiganlabs/ctrl-q/commit/73174bb40ace51166f6dc75ad273bebbc319250d))
* release-please debugging ([34eba8f](https://github.com/ptarmiganlabs/ctrl-q/commit/34eba8fa27ea4372e8d6d3ffcd3b11fa13d81982))
* **win:** Switch to new signing solution for Windows binaries ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))

## 3.15.1 (2024-02-18)


### Miscellaneous

* **deps:** Update app dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* **deps:** Update build pipeline dependencies ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))
* release-please debugging ([34eba8f](https://github.com/ptarmiganlabs/ctrl-q/commit/34eba8fa27ea4372e8d6d3ffcd3b11fa13d81982))
* **win:** Switch to new signing solution for Windows binaries ([d66d7e6](https://github.com/ptarmiganlabs/ctrl-q/commit/d66d7e6875b566572b5710e3b2c916195396f28c))

## [3.12.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.11.0...ctrl-q-v3.12.0) (2023-08-22)


### Features

* **app-import:** Add more options for publishing apps ([a548642](https://github.com/ptarmiganlabs/ctrl-q/commit/a5486427c1cb4317fcb971c1bc55e5ba3dc071a1)), closes [#234](https://github.com/ptarmiganlabs/ctrl-q/issues/234)
* **task-import:** Better progress logging when importing tasks from Excel file ([c2f721b](https://github.com/ptarmiganlabs/ctrl-q/commit/c2f721b60b3f69edebdab4e93b679524649607c6))


### Bug Fixes

* **app-import:** Make app import more robust on QSEoW 2023-May and onward ([642e7df](https://github.com/ptarmiganlabs/ctrl-q/commit/642e7df2ceba59ebd8383f883da6af03902e0058))
* **task-get:** Properly handle ext prg task triggering reload task ([ad9fbae](https://github.com/ptarmiganlabs/ctrl-q/commit/ad9fbae488181b5928a44d58ca3bcb80c3491a87)), closes [#288](https://github.com/ptarmiganlabs/ctrl-q/issues/288)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([32714b7](https://github.com/ptarmiganlabs/ctrl-q/commit/32714b724a7efa2314ff6976ba54ce9e88ae1949))


### Refactoring

* **task-get:** Improved logging and error checking. ([ad9fbae](https://github.com/ptarmiganlabs/ctrl-q/commit/ad9fbae488181b5928a44d58ca3bcb80c3491a87))

## [3.11.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.10.0...ctrl-q-v3.11.0) (2023-06-05)


### Features

* **master-item-dim-delete:** Add counter showing how many master dimensions have been deleted so far ([b081f2a](https://github.com/ptarmiganlabs/ctrl-q/commit/b081f2ac9b27728ea9a0f0464483bca2e3603836))
* **master-item-import:** Add --dry-run option ([5bbd08a](https://github.com/ptarmiganlabs/ctrl-q/commit/5bbd08ae25c88c174992eb9c35ce2c788415dd9e)), closes [#270](https://github.com/ptarmiganlabs/ctrl-q/issues/270)
* **master-item-import:** Add option for delay between master item imports ([b618d12](https://github.com/ptarmiganlabs/ctrl-q/commit/b618d12ce16a9db56a4245fd7c6949ecf0f0d7c4))
* **master-item-import:** Add support for importing drill-down dimensions ([cc0a36f](https://github.com/ptarmiganlabs/ctrl-q/commit/cc0a36fd3ad9ffdc77bfc988e592d5700e33cec0)), closes [#272](https://github.com/ptarmiganlabs/ctrl-q/issues/272)
* **master-item-import:** Show counter showing how many master items have been imported so far ([0dff114](https://github.com/ptarmiganlabs/ctrl-q/commit/0dff114160cfed7c1e7a677cfbbdde7032bc4cab))
* **master-item-import:** Show info showing how many master items were imported in total ([0dff114](https://github.com/ptarmiganlabs/ctrl-q/commit/0dff114160cfed7c1e7a677cfbbdde7032bc4cab))
* **master-item-measure-delete:** Add counter showing how many master measures have been deleted so far ([15768d5](https://github.com/ptarmiganlabs/ctrl-q/commit/15768d5d1376896b2680f41c1d511831006fa7bf))


### Bug Fixes

* Respect user dir/id passed as options when calling Qlik repository APIs ([6689847](https://github.com/ptarmiganlabs/ctrl-q/commit/6689847d2b5668c47b6c0c0d2cf6fe518ffeb963)), closes [#269](https://github.com/ptarmiganlabs/ctrl-q/issues/269)


### Refactoring

* **master-item-import:** Make master item import more robust ([4d76c3d](https://github.com/ptarmiganlabs/ctrl-q/commit/4d76c3d962258ff2ec2eb2fe62ed03f51df60cc6)), closes [#271](https://github.com/ptarmiganlabs/ctrl-q/issues/271)

## [3.10.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.9.1...ctrl-q-v3.10.0) (2023-05-25)


### Features

* **task-get:** Include ext prg tasks in task trees and tables ([69d0946](https://github.com/ptarmiganlabs/ctrl-q/commit/69d094614bc0cf813d777f2750021d845df8c89a)), closes [#250](https://github.com/ptarmiganlabs/ctrl-q/issues/250)


### Bug Fixes

* **master-item-dim-get:** Fixed typo in command description ([3705ff0](https://github.com/ptarmiganlabs/ctrl-q/commit/3705ff0f336dfd45e3ac429d5625b8064b9e4373)), closes [#258](https://github.com/ptarmiganlabs/ctrl-q/issues/258)

## [3.9.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.9.0...ctrl-q-v3.9.1) (2023-05-12)


### Bug Fixes

* **variable-delete:** Keep track of system vs script created variables ([366cc14](https://github.com/ptarmiganlabs/ctrl-q/commit/366cc14bfb1e2033340a0cf352b384c2650cc3a0)), closes [#259](https://github.com/ptarmiganlabs/ctrl-q/issues/259)

## [3.9.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.9.0...ctrl-q-v3.9.0) (2023-05-10)


### Features

* Include color info when importing master dimensions from Excel file ([268e136](https://github.com/ptarmiganlabs/ctrl-q/commit/268e13645e8e1e9a1571134a0b4d13da8cdfb1a7)), closes [#238](https://github.com/ptarmiganlabs/ctrl-q/issues/238)
* **master-item-dim-get:** Show per-value coloring data in table and JSON output for master dimensions ([8f49ab5](https://github.com/ptarmiganlabs/ctrl-q/commit/8f49ab57a62ae7672f037f82d212d93f8ac53db9)), closes [#240](https://github.com/ptarmiganlabs/ctrl-q/issues/240)
* **master-item-import:** Include color info when importing master measures from Excel file ([d5aa579](https://github.com/ptarmiganlabs/ctrl-q/commit/d5aa5797c828f130d122e12a89b749e33503f035)), closes [#245](https://github.com/ptarmiganlabs/ctrl-q/issues/245)
* **master-item-measure-get:** Add full color info in table output for master measures ([42ea7a1](https://github.com/ptarmiganlabs/ctrl-q/commit/42ea7a10af89095cf1076481d0cacecda6391e4c)), closes [#244](https://github.com/ptarmiganlabs/ctrl-q/issues/244)
* **variable-delete:** Add new command for deleting in-app variables ([7b43ac4](https://github.com/ptarmiganlabs/ctrl-q/commit/7b43ac4948508fdaba88a25581fd7dac35681b3d)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)
* **variable-get:** Add new command for listing in-app variables ([33c5811](https://github.com/ptarmiganlabs/ctrl-q/commit/33c58110464b75cee343e821a59690c8063a2666)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)


### Bug Fixes

* **task-get:** A task tree including ext program tasks caused failure ([16e0496](https://github.com/ptarmiganlabs/ctrl-q/commit/16e049624d177e640453348d385ddcdd7320e8c6))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([d42281f](https://github.com/ptarmiganlabs/ctrl-q/commit/d42281fa4b5ab403a179c24e8e0d2b2154ac8a9d))
* **main:** release ctrl-q 3.9.0 ([dc5974e](https://github.com/ptarmiganlabs/ctrl-q/commit/dc5974e22adb43f3582b4f8daefdddff256b77b0))
* **main:** release ctrl-q 3.9.0 ([305d6ec](https://github.com/ptarmiganlabs/ctrl-q/commit/305d6ec31b307eda206ab29c9e1f94057990d448))
* **main:** release ctrl-q 3.9.0 ([dec7209](https://github.com/ptarmiganlabs/ctrl-q/commit/dec720915f66e713b01291295ee3e29c3d97cabd))

## [3.9.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.9.0...ctrl-q-v3.9.0) (2023-05-10)


### Features

* Include color info when importing master dimensions from Excel file ([268e136](https://github.com/ptarmiganlabs/ctrl-q/commit/268e13645e8e1e9a1571134a0b4d13da8cdfb1a7)), closes [#238](https://github.com/ptarmiganlabs/ctrl-q/issues/238)
* **master-item-dim-get:** Show per-value coloring data in table and JSON output for master dimensions ([8f49ab5](https://github.com/ptarmiganlabs/ctrl-q/commit/8f49ab57a62ae7672f037f82d212d93f8ac53db9)), closes [#240](https://github.com/ptarmiganlabs/ctrl-q/issues/240)
* **master-item-import:** Include color info when importing master measures from Excel file ([d5aa579](https://github.com/ptarmiganlabs/ctrl-q/commit/d5aa5797c828f130d122e12a89b749e33503f035)), closes [#245](https://github.com/ptarmiganlabs/ctrl-q/issues/245)
* **master-item-measure-get:** Add full color info in table output for master measures ([42ea7a1](https://github.com/ptarmiganlabs/ctrl-q/commit/42ea7a10af89095cf1076481d0cacecda6391e4c)), closes [#244](https://github.com/ptarmiganlabs/ctrl-q/issues/244)
* **variable-delete:** Add new command for deleting in-app variables ([7b43ac4](https://github.com/ptarmiganlabs/ctrl-q/commit/7b43ac4948508fdaba88a25581fd7dac35681b3d)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)
* **variable-get:** Add new command for listing in-app variables ([33c5811](https://github.com/ptarmiganlabs/ctrl-q/commit/33c58110464b75cee343e821a59690c8063a2666)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)


### Bug Fixes

* **task-get:** A task tree including ext program tasks caused failure ([16e0496](https://github.com/ptarmiganlabs/ctrl-q/commit/16e049624d177e640453348d385ddcdd7320e8c6))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([d42281f](https://github.com/ptarmiganlabs/ctrl-q/commit/d42281fa4b5ab403a179c24e8e0d2b2154ac8a9d))
* **main:** release ctrl-q 3.9.0 ([305d6ec](https://github.com/ptarmiganlabs/ctrl-q/commit/305d6ec31b307eda206ab29c9e1f94057990d448))
* **main:** release ctrl-q 3.9.0 ([dec7209](https://github.com/ptarmiganlabs/ctrl-q/commit/dec720915f66e713b01291295ee3e29c3d97cabd))

## [3.9.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.9.0...ctrl-q-v3.9.0) (2023-05-10)


### Features

* Include color info when importing master dimensions from Excel file ([268e136](https://github.com/ptarmiganlabs/ctrl-q/commit/268e13645e8e1e9a1571134a0b4d13da8cdfb1a7)), closes [#238](https://github.com/ptarmiganlabs/ctrl-q/issues/238)
* **master-item-dim-get:** Show per-value coloring data in table and JSON output for master dimensions ([8f49ab5](https://github.com/ptarmiganlabs/ctrl-q/commit/8f49ab57a62ae7672f037f82d212d93f8ac53db9)), closes [#240](https://github.com/ptarmiganlabs/ctrl-q/issues/240)
* **master-item-import:** Include color info when importing master measures from Excel file ([d5aa579](https://github.com/ptarmiganlabs/ctrl-q/commit/d5aa5797c828f130d122e12a89b749e33503f035)), closes [#245](https://github.com/ptarmiganlabs/ctrl-q/issues/245)
* **master-item-measure-get:** Add full color info in table output for master measures ([42ea7a1](https://github.com/ptarmiganlabs/ctrl-q/commit/42ea7a10af89095cf1076481d0cacecda6391e4c)), closes [#244](https://github.com/ptarmiganlabs/ctrl-q/issues/244)
* **variable-delete:** Add new command for deleting in-app variables ([7b43ac4](https://github.com/ptarmiganlabs/ctrl-q/commit/7b43ac4948508fdaba88a25581fd7dac35681b3d)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)
* **variable-get:** Add new command for listing in-app variables ([33c5811](https://github.com/ptarmiganlabs/ctrl-q/commit/33c58110464b75cee343e821a59690c8063a2666)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)


### Bug Fixes

* **task-get:** A task tree including ext program tasks caused failure ([16e0496](https://github.com/ptarmiganlabs/ctrl-q/commit/16e049624d177e640453348d385ddcdd7320e8c6))


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([d42281f](https://github.com/ptarmiganlabs/ctrl-q/commit/d42281fa4b5ab403a179c24e8e0d2b2154ac8a9d))
* **main:** release ctrl-q 3.9.0 ([dec7209](https://github.com/ptarmiganlabs/ctrl-q/commit/dec720915f66e713b01291295ee3e29c3d97cabd))

## [3.9.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.8.3...ctrl-q-v3.9.0) (2023-05-09)


### Features

* Include color info when importing master dimensions from Excel file ([268e136](https://github.com/ptarmiganlabs/ctrl-q/commit/268e13645e8e1e9a1571134a0b4d13da8cdfb1a7)), closes [#238](https://github.com/ptarmiganlabs/ctrl-q/issues/238)
* **master-item-dim-get:** Show per-value coloring data in table and JSON output for master dimensions ([8f49ab5](https://github.com/ptarmiganlabs/ctrl-q/commit/8f49ab57a62ae7672f037f82d212d93f8ac53db9)), closes [#240](https://github.com/ptarmiganlabs/ctrl-q/issues/240)
* **master-item-import:** Include color info when importing master measures from Excel file ([d5aa579](https://github.com/ptarmiganlabs/ctrl-q/commit/d5aa5797c828f130d122e12a89b749e33503f035)), closes [#245](https://github.com/ptarmiganlabs/ctrl-q/issues/245)
* **master-item-measure-get:** Add full color info in table output for master measures ([42ea7a1](https://github.com/ptarmiganlabs/ctrl-q/commit/42ea7a10af89095cf1076481d0cacecda6391e4c)), closes [#244](https://github.com/ptarmiganlabs/ctrl-q/issues/244)
* **variable-delete:** Add new command for deleting in-app variables ([7b43ac4](https://github.com/ptarmiganlabs/ctrl-q/commit/7b43ac4948508fdaba88a25581fd7dac35681b3d)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)
* **variable-get:** Add new command for listing in-app variables ([33c5811](https://github.com/ptarmiganlabs/ctrl-q/commit/33c58110464b75cee343e821a59690c8063a2666)), closes [#237](https://github.com/ptarmiganlabs/ctrl-q/issues/237)

## [3.8.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.8.2...ctrl-q-v3.8.3) (2023-03-31)


### Bug Fixes

* Add missing .qvf extension to file names in Excel file created by app-export ([23bb188](https://github.com/ptarmiganlabs/ctrl-q/commit/23bb188abc3d0e793cd34d09311597b747765cad)), closes [#231](https://github.com/ptarmiganlabs/ctrl-q/issues/231)

## [3.8.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.8.1...ctrl-q-v3.8.2) (2023-03-31)


### Bug Fixes

* Incorrect QVF file name written to Excel file when using app-export command with --metadata-file-create option ([a2cf04e](https://github.com/ptarmiganlabs/ctrl-q/commit/a2cf04e9bdf1822a4699973f8c4f16ddc27ec78a)), closes [#228](https://github.com/ptarmiganlabs/ctrl-q/issues/228)

## [3.8.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.8.0...ctrl-q-v3.8.1) (2023-03-31)


### Bug Fixes

* --task-tag parameter does not work with task-get command ([2201f36](https://github.com/ptarmiganlabs/ctrl-q/commit/2201f36d22807466bbd546dcea48d023aac3316e)), closes [#225](https://github.com/ptarmiganlabs/ctrl-q/issues/225)
* Improve dry-run messages ([8cd25bc](https://github.com/ptarmiganlabs/ctrl-q/commit/8cd25bc7fb13e0a1e829c0a06066f3fa105e4207)), closes [#196](https://github.com/ptarmiganlabs/ctrl-q/issues/196)

## [3.8.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.8.0...ctrl-q-v3.8.0) (2023-03-30)


### Documentation

* Update wrt 3.8.0 ([344b07e](https://github.com/ptarmiganlabs/ctrl-q/commit/344b07e9c6f122d4cfd36ee3d07e2b09300a0b3a))

## [3.8.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.1...ctrl-q-v3.8.0) (2023-03-30)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)


### Miscellaneous

* **main:** release ctrl-q 3.7.0 ([7757108](https://github.com/ptarmiganlabs/ctrl-q/commit/7757108f92443948569b2b38c8efe4ed1a802311))
* **main:** release ctrl-q 3.7.0 ([effd0c6](https://github.com/ptarmiganlabs/ctrl-q/commit/effd0c6f43c657e6fee9187eaab2ab5c00f2bc2e))
* **main:** release ctrl-q 3.7.0 ([ebae75d](https://github.com/ptarmiganlabs/ctrl-q/commit/ebae75d0f31b6ea454e10fed503e85d561aec267))
* **main:** release ctrl-q 3.7.0 ([f285caf](https://github.com/ptarmiganlabs/ctrl-q/commit/f285cafa158fac87ceb51b7451db8ab38ff495a3))
* **main:** release ctrl-q 3.7.0 ([2c4bc21](https://github.com/ptarmiganlabs/ctrl-q/commit/2c4bc218a25cfa800dadac161c4b36e491b96473))
* **main:** release ctrl-q 3.7.1 ([1335dde](https://github.com/ptarmiganlabs/ctrl-q/commit/1335dde2de22dbcdd167de6faec41107b14cf536))
* Tesrt cases for app export ([c2fef5b](https://github.com/ptarmiganlabs/ctrl-q/commit/c2fef5bf37b49fd01f844067edbb11f3c945fbd1))

## [3.7.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.0...ctrl-q-v3.7.1) (2023-03-29)


### Miscellaneous

* Tesrt cases for app export ([c2fef5b](https://github.com/ptarmiganlabs/ctrl-q/commit/c2fef5bf37b49fd01f844067edbb11f3c945fbd1))

## [3.7.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.0...ctrl-q-v3.7.0) (2023-03-24)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)


### Miscellaneous

* **main:** release ctrl-q 3.7.0 ([effd0c6](https://github.com/ptarmiganlabs/ctrl-q/commit/effd0c6f43c657e6fee9187eaab2ab5c00f2bc2e))
* **main:** release ctrl-q 3.7.0 ([ebae75d](https://github.com/ptarmiganlabs/ctrl-q/commit/ebae75d0f31b6ea454e10fed503e85d561aec267))
* **main:** release ctrl-q 3.7.0 ([f285caf](https://github.com/ptarmiganlabs/ctrl-q/commit/f285cafa158fac87ceb51b7451db8ab38ff495a3))
* **main:** release ctrl-q 3.7.0 ([2c4bc21](https://github.com/ptarmiganlabs/ctrl-q/commit/2c4bc218a25cfa800dadac161c4b36e491b96473))

## [3.7.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.0...ctrl-q-v3.7.0) (2023-03-23)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)


### Miscellaneous

* **main:** release ctrl-q 3.7.0 ([ebae75d](https://github.com/ptarmiganlabs/ctrl-q/commit/ebae75d0f31b6ea454e10fed503e85d561aec267))
* **main:** release ctrl-q 3.7.0 ([f285caf](https://github.com/ptarmiganlabs/ctrl-q/commit/f285cafa158fac87ceb51b7451db8ab38ff495a3))
* **main:** release ctrl-q 3.7.0 ([2c4bc21](https://github.com/ptarmiganlabs/ctrl-q/commit/2c4bc218a25cfa800dadac161c4b36e491b96473))

## [3.7.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.0...ctrl-q-v3.7.0) (2023-03-23)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)


### Miscellaneous

* **main:** release ctrl-q 3.7.0 ([f285caf](https://github.com/ptarmiganlabs/ctrl-q/commit/f285cafa158fac87ceb51b7451db8ab38ff495a3))
* **main:** release ctrl-q 3.7.0 ([2c4bc21](https://github.com/ptarmiganlabs/ctrl-q/commit/2c4bc218a25cfa800dadac161c4b36e491b96473))

## [3.7.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.7.0...ctrl-q-v3.7.0) (2023-03-23)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)


### Miscellaneous

* **main:** release ctrl-q 3.7.0 ([2c4bc21](https://github.com/ptarmiganlabs/ctrl-q/commit/2c4bc218a25cfa800dadac161c4b36e491b96473))

## [3.7.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.6.1...ctrl-q-v3.7.0) (2023-03-22)


### Features

* Add optional delay after each QVF file upload to Sense ([6395408](https://github.com/ptarmiganlabs/ctrl-q/commit/6395408e25e1684f15675c0a254abae350bb8f60)), closes [#198](https://github.com/ptarmiganlabs/ctrl-q/issues/198)
* Add unit tests for script-get and task-get commands ([cca29b8](https://github.com/ptarmiganlabs/ctrl-q/commit/cca29b825f784af118359eb6dc6d3f2474797712)), closes [#207](https://github.com/ptarmiganlabs/ctrl-q/issues/207)
* Load Sense tags and custom properties on startup rather than at each QRS call ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f))
* Publish apps as part of import-from-qvf workflow ([7745258](https://github.com/ptarmiganlabs/ctrl-q/commit/7745258ce8359b7033bc8e7cab7da03e5b59239f)), closes [#189](https://github.com/ptarmiganlabs/ctrl-q/issues/189)
* Retry app upload when QRS rate limit kicks in ([bfda57b](https://github.com/ptarmiganlabs/ctrl-q/commit/bfda57bf94c5053f65997d7603aaab733ed6b40f)), closes [#197](https://github.com/ptarmiganlabs/ctrl-q/issues/197) [#199](https://github.com/ptarmiganlabs/ctrl-q/issues/199)
* Set owner of apps imported from QVFs ([c306243](https://github.com/ptarmiganlabs/ctrl-q/commit/c3062437ec5eabc6f393918e1bdece3775c9f2a5)), closes [#190](https://github.com/ptarmiganlabs/ctrl-q/issues/190)


### Refactoring

* Change build process to be compatible with latest network libraries ([b40b71a](https://github.com/ptarmiganlabs/ctrl-q/commit/b40b71a1d9ebb46ae2e688bc5db133fda7be8638)), closes [#205](https://github.com/ptarmiganlabs/ctrl-q/issues/205)

## [3.6.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.6.0...ctrl-q-v3.6.1) (2023-03-10)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([c9b240c](https://github.com/ptarmiganlabs/ctrl-q/commit/c9b240c5f35aa4c9dc4a5fdc8fe190c40359bb5d))

## [3.6.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.6.0...ctrl-q-v3.6.0) (2023-03-08)


### Features

* Bulk import of QVF files/apps ([0f24541](https://github.com/ptarmiganlabs/ctrl-q/commit/0f245419691ff87014b6c4766ed5983e2b584760)), closes [#179](https://github.com/ptarmiganlabs/ctrl-q/issues/179)
* Optional import of QVF files/apps as part of importing reload tasks ([d8eb3db](https://github.com/ptarmiganlabs/ctrl-q/commit/d8eb3dbb65898576a27d1ec2eed0fa1201023f28)), closes [#180](https://github.com/ptarmiganlabs/ctrl-q/issues/180)


### Miscellaneous

* **main:** release ctrl-q 3.6.0 ([447ccec](https://github.com/ptarmiganlabs/ctrl-q/commit/447ccec21e58211c81d4762d2580165d0853adde))
* **main:** release ctrl-q 3.6.0 ([7cd27af](https://github.com/ptarmiganlabs/ctrl-q/commit/7cd27afd42772e9348f53e51462741c9278e243f))
* **main:** release ctrl-q 3.6.0 ([2be2be1](https://github.com/ptarmiganlabs/ctrl-q/commit/2be2be197558496e20e9bcc6c86607e454447268))

## [3.6.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.6.0...ctrl-q-v3.6.0) (2023-02-23)


### Features

* Bulk import of QVF files/apps ([0f24541](https://github.com/ptarmiganlabs/ctrl-q/commit/0f245419691ff87014b6c4766ed5983e2b584760)), closes [#179](https://github.com/ptarmiganlabs/ctrl-q/issues/179)
* Optional import of QVF files/apps as part of importing reload tasks ([d8eb3db](https://github.com/ptarmiganlabs/ctrl-q/commit/d8eb3dbb65898576a27d1ec2eed0fa1201023f28)), closes [#180](https://github.com/ptarmiganlabs/ctrl-q/issues/180)


### Miscellaneous

* **main:** release ctrl-q 3.6.0 ([7cd27af](https://github.com/ptarmiganlabs/ctrl-q/commit/7cd27afd42772e9348f53e51462741c9278e243f))
* **main:** release ctrl-q 3.6.0 ([2be2be1](https://github.com/ptarmiganlabs/ctrl-q/commit/2be2be197558496e20e9bcc6c86607e454447268))

## [3.6.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.6.0...ctrl-q-v3.6.0) (2023-02-22)


### Features

* Bulk import of QVF files/apps ([0f24541](https://github.com/ptarmiganlabs/ctrl-q/commit/0f245419691ff87014b6c4766ed5983e2b584760)), closes [#179](https://github.com/ptarmiganlabs/ctrl-q/issues/179)
* Optional import of QVF files/apps as part of importing reload tasks ([d8eb3db](https://github.com/ptarmiganlabs/ctrl-q/commit/d8eb3dbb65898576a27d1ec2eed0fa1201023f28)), closes [#180](https://github.com/ptarmiganlabs/ctrl-q/issues/180)


### Miscellaneous

* **main:** release ctrl-q 3.6.0 ([2be2be1](https://github.com/ptarmiganlabs/ctrl-q/commit/2be2be197558496e20e9bcc6c86607e454447268))

## [3.6.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.5.1...ctrl-q-v3.6.0) (2023-02-22)


### Features

* Bulk import of QVF files/apps ([0f24541](https://github.com/ptarmiganlabs/ctrl-q/commit/0f245419691ff87014b6c4766ed5983e2b584760)), closes [#179](https://github.com/ptarmiganlabs/ctrl-q/issues/179)
* Optional import of QVF files/apps as part of importing reload tasks ([d8eb3db](https://github.com/ptarmiganlabs/ctrl-q/commit/d8eb3dbb65898576a27d1ec2eed0fa1201023f28)), closes [#180](https://github.com/ptarmiganlabs/ctrl-q/issues/180)

## [3.5.1](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.5.0...ctrl-q-v3.5.1) (2023-02-16)


### Bug Fixes

* --dry-run for setting task custom properties no longer crash Ctrl-Q ([c9ead9d](https://github.com/ptarmiganlabs/ctrl-q/commit/c9ead9da905969b6555138b1a7832dcdeb39dae5)), closes [#176](https://github.com/ptarmiganlabs/ctrl-q/issues/176)

## [3.5.0](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.3...ctrl-q-v3.5.0) (2023-02-14)


### Features

* Add support for using tags to select which tasks should be retrieved from Sense ([e1652cc](https://github.com/ptarmiganlabs/ctrl-q/commit/e1652cc366d2fcf81a0b5ec1f939d630bcf0536c)), closes [#168](https://github.com/ptarmiganlabs/ctrl-q/issues/168)
* Better valid options checking for get-task command ([93a817f](https://github.com/ptarmiganlabs/ctrl-q/commit/93a817fcddbe504f8b71b889577cfcf0520f979c)), closes [#171](https://github.com/ptarmiganlabs/ctrl-q/issues/171)


### Bug Fixes

* In get-task command, only allow task ID and tag filtering for table output ([353aabe](https://github.com/ptarmiganlabs/ctrl-q/commit/353aabe3a9be66326b02c40ec7bae386e63535e4)), closes [#170](https://github.com/ptarmiganlabs/ctrl-q/issues/170)

## [3.4.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.3...ctrl-q-v3.4.3) (2023-02-13)


### Bug Fixes

* Improved handling of invalid schema and composite events returned from Sense APIs ([bebedda](https://github.com/ptarmiganlabs/ctrl-q/commit/bebedda46a7b4a85c62d12144591a5732596c91b))


### Miscellaneous

* **main:** release ctrl-q 3.4.3 ([2281de8](https://github.com/ptarmiganlabs/ctrl-q/commit/2281de84cf774264ba007455dbd99339a7bfbe3c))
* **main:** release ctrl-q 3.4.3 ([4588130](https://github.com/ptarmiganlabs/ctrl-q/commit/458813043f92987ee9531e0d0479b52ac0b1c5af))
* **main:** release ctrl-q 3.4.3 ([5c25145](https://github.com/ptarmiganlabs/ctrl-q/commit/5c251457c088613d7eab5610982c956cc6322abf))

## [3.4.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.3...ctrl-q-v3.4.3) (2023-02-13)


### Bug Fixes

* Improved handling of invalid schema and composite events returned from Sense APIs ([bebedda](https://github.com/ptarmiganlabs/ctrl-q/commit/bebedda46a7b4a85c62d12144591a5732596c91b))


### Miscellaneous

* **main:** release ctrl-q 3.4.3 ([4588130](https://github.com/ptarmiganlabs/ctrl-q/commit/458813043f92987ee9531e0d0479b52ac0b1c5af))
* **main:** release ctrl-q 3.4.3 ([5c25145](https://github.com/ptarmiganlabs/ctrl-q/commit/5c251457c088613d7eab5610982c956cc6322abf))

## [3.4.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.3...ctrl-q-v3.4.3) (2023-02-13)


### Bug Fixes

* Improved handling of invalid schema and composite events returned from Sense APIs ([bebedda](https://github.com/ptarmiganlabs/ctrl-q/commit/bebedda46a7b4a85c62d12144591a5732596c91b))


### Miscellaneous

* **main:** release ctrl-q 3.4.3 ([5c25145](https://github.com/ptarmiganlabs/ctrl-q/commit/5c251457c088613d7eab5610982c956cc6322abf))

## [3.4.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.2...ctrl-q-v3.4.3) (2023-02-13)


### Bug Fixes

* Improved handling of invalid schema and composite events returned from Sense APIs ([bebedda](https://github.com/ptarmiganlabs/ctrl-q/commit/bebedda46a7b4a85c62d12144591a5732596c91b))

## [3.4.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.2...ctrl-q-v3.4.2) (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Fix broken CI ([7f8c4f7](https://github.com/ptarmiganlabs/ctrl-q/commit/7f8c4f78d19cc1622e4e67e84489d1c4ae5a3eee))
* Fix build config ([b579991](https://github.com/ptarmiganlabs/ctrl-q/commit/b579991e56424094e55c8176af2f9e82412efff1))
* Fix build process ([b04ed23](https://github.com/ptarmiganlabs/ctrl-q/commit/b04ed23590880c9459ce88367d00ae90a80a80c5))
* Fix CI (finally??) ([89d63c7](https://github.com/ptarmiganlabs/ctrl-q/commit/89d63c71165913786b784ab6bef874431633b8c7))
* **main:** release ctrl-q 3.4.2 ([b1bc836](https://github.com/ptarmiganlabs/ctrl-q/commit/b1bc8361e4c6483620c14d37631030a0bd0b100c))
* **main:** release ctrl-q 3.4.2 ([62a2b07](https://github.com/ptarmiganlabs/ctrl-q/commit/62a2b076a1297e20d6c1857252a30017e8d6b7ec))
* **main:** release ctrl-q 3.4.2 ([8bdae53](https://github.com/ptarmiganlabs/ctrl-q/commit/8bdae53f583466e1ec1f6b93cd0a106ae3566d2b))
* **main:** release ctrl-q 3.4.2 ([357ab6c](https://github.com/ptarmiganlabs/ctrl-q/commit/357ab6c01d1ec5c8e982ce9b56221c6dd6848ebc))
* **main:** release ctrl-q 3.4.3 ([959d998](https://github.com/ptarmiganlabs/ctrl-q/commit/959d998e8e37bd4f2f562ab6b3b797de2d4d39f7))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))
* Tweak build process config ([3dbf188](https://github.com/ptarmiganlabs/ctrl-q/commit/3dbf1883422d7d9867a635574dfe8881adfb9c03))

## [3.4.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.2...ctrl-q-v3.4.2) (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Fix broken CI ([7f8c4f7](https://github.com/ptarmiganlabs/ctrl-q/commit/7f8c4f78d19cc1622e4e67e84489d1c4ae5a3eee))
* Fix build config ([b579991](https://github.com/ptarmiganlabs/ctrl-q/commit/b579991e56424094e55c8176af2f9e82412efff1))
* Fix build process ([b04ed23](https://github.com/ptarmiganlabs/ctrl-q/commit/b04ed23590880c9459ce88367d00ae90a80a80c5))
* **main:** release ctrl-q 3.4.2 ([62a2b07](https://github.com/ptarmiganlabs/ctrl-q/commit/62a2b076a1297e20d6c1857252a30017e8d6b7ec))
* **main:** release ctrl-q 3.4.2 ([8bdae53](https://github.com/ptarmiganlabs/ctrl-q/commit/8bdae53f583466e1ec1f6b93cd0a106ae3566d2b))
* **main:** release ctrl-q 3.4.2 ([357ab6c](https://github.com/ptarmiganlabs/ctrl-q/commit/357ab6c01d1ec5c8e982ce9b56221c6dd6848ebc))
* **main:** release ctrl-q 3.4.3 ([959d998](https://github.com/ptarmiganlabs/ctrl-q/commit/959d998e8e37bd4f2f562ab6b3b797de2d4d39f7))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))
* Tweak build process config ([3dbf188](https://github.com/ptarmiganlabs/ctrl-q/commit/3dbf1883422d7d9867a635574dfe8881adfb9c03))

## [3.4.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.3...ctrl-q-v3.4.2) (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Fix broken CI ([7f8c4f7](https://github.com/ptarmiganlabs/ctrl-q/commit/7f8c4f78d19cc1622e4e67e84489d1c4ae5a3eee))
* Fix build config ([b579991](https://github.com/ptarmiganlabs/ctrl-q/commit/b579991e56424094e55c8176af2f9e82412efff1))
* **main:** release ctrl-q 3.4.2 ([8bdae53](https://github.com/ptarmiganlabs/ctrl-q/commit/8bdae53f583466e1ec1f6b93cd0a106ae3566d2b))
* **main:** release ctrl-q 3.4.2 ([357ab6c](https://github.com/ptarmiganlabs/ctrl-q/commit/357ab6c01d1ec5c8e982ce9b56221c6dd6848ebc))
* **main:** release ctrl-q 3.4.3 ([959d998](https://github.com/ptarmiganlabs/ctrl-q/commit/959d998e8e37bd4f2f562ab6b3b797de2d4d39f7))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))
* Tweak build process config ([3dbf188](https://github.com/ptarmiganlabs/ctrl-q/commit/3dbf1883422d7d9867a635574dfe8881adfb9c03))

## [3.4.3](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.2...ctrl-q-v3.4.3) (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Fix build config ([b579991](https://github.com/ptarmiganlabs/ctrl-q/commit/b579991e56424094e55c8176af2f9e82412efff1))
* **main:** release ctrl-q 3.4.2 ([8bdae53](https://github.com/ptarmiganlabs/ctrl-q/commit/8bdae53f583466e1ec1f6b93cd0a106ae3566d2b))
* **main:** release ctrl-q 3.4.2 ([357ab6c](https://github.com/ptarmiganlabs/ctrl-q/commit/357ab6c01d1ec5c8e982ce9b56221c6dd6848ebc))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))
* Tweak build process config ([3dbf188](https://github.com/ptarmiganlabs/ctrl-q/commit/3dbf1883422d7d9867a635574dfe8881adfb9c03))

## [3.4.2](https://github.com/ptarmiganlabs/ctrl-q/compare/ctrl-q-v3.4.2...ctrl-q-v3.4.2) (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Fix build config ([b579991](https://github.com/ptarmiganlabs/ctrl-q/commit/b579991e56424094e55c8176af2f9e82412efff1))
* **main:** release ctrl-q 3.4.2 ([357ab6c](https://github.com/ptarmiganlabs/ctrl-q/commit/357ab6c01d1ec5c8e982ce9b56221c6dd6848ebc))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))

## 3.4.2 (2023-02-10)


### Bug Fixes

* Add correct help text for task-custom-property-set command's --overwrite option ([af48975](https://github.com/ptarmiganlabs/ctrl-q/commit/af489757895cd251365f417ce02761489902978d)), closes [#132](https://github.com/ptarmiganlabs/ctrl-q/issues/132)
* Correctly create task chains when importing tasks ([dc0d33f](https://github.com/ptarmiganlabs/ctrl-q/commit/dc0d33f1f585c5e899c13c482fc815a2431f23a9)), closes [#136](https://github.com/ptarmiganlabs/ctrl-q/issues/136)


### Miscellaneous

* **deps:** Update dependencies to stay safe and secure ([badeb15](https://github.com/ptarmiganlabs/ctrl-q/commit/badeb153179dfd84514aefd62ccd07ce35494e2f))
* Testing new release-please config, 3 ([708569c](https://github.com/ptarmiganlabs/ctrl-q/commit/708569cc9dff3c8b8e48f2ce7426c7258359e143))
* Testing new release-please config, 4 ([31dcf2f](https://github.com/ptarmiganlabs/ctrl-q/commit/31dcf2f7838951fb8bcd24514fbb4560d02d51e5))
