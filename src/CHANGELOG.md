# Changelog

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
