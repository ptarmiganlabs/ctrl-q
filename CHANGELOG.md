# Changelog

### [2.1.1](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v2.1.0...ctrl-q-cli-v2.1.1) (2022-05-08)


### Bug Fixes

* Dry-run always used when used --delete-all ([fa0b7db](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/fa0b7dbca8716fe649ac79fa34cc760235470f1e)), closes [#51](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/51)

## [2.1.0](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v2.0.0...ctrl-q-cli-v2.1.0) (2022-05-07)


### Features

* Add test data Excel file for master item import ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1)), closes [#45](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/45) [#47](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/47)


### Refactoring

* Add better debug logging when importing master items ([74ecd00](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/74ecd00a541c6e1fd50e0c94525bdbc32b98c6c1))

## [2.0.0](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v1.3.0...ctrl-q-cli-v2.0.0) (2022-05-07)


### ⚠ BREAKING CHANGES

* Refactor options when importing master items from Excel file
* Refactor all commands to be <entity>-<verb>
* Refactor parameter names for import-master-items-from-Excel command
* Change all commands to be <entity>-<verb>

### Features

* Add delete-all option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
* Add dry-run option to master item delete commands ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
* Add option to limit how many master items are imported from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
* Add option to select auth method to Sense server ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/31) [#30](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/30) [#29](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/29) [#32](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/32) [#38](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/38) [#39](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/39)
* Add option to select authentication method to Sense server ([c426894](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#31](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/31)
* Add optional limit to how many master items are imported from Excel file ([c426894](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))
* Refactor all commands to be <entity>-<verb> ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))
* Refactor options when importing master items from Excel file ([d0719cc](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d0719cc8b3dcc9aef46fc1d61749948edabe6230))


### Refactoring

* Change all commands to be <entity>-<verb> ([c426894](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9)), closes [#32](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/32)
* Refactor parameter names for import-master-items-from-Excel command ([c426894](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c42689442a7262e4186c04f5b9c2a8c0e3755ed9))

## [1.3.0](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v1.2.0...ctrl-q-cli-v1.3.0) (2022-05-05)


### Features

* add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))


### Bug Fixes

* **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
* move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/b554f414a241b588504bf53e103a6f55961160aa))
* move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
* upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))


### Miscellaneous

* add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
* **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
* **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
* **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
* **main:** release ctrl-q-cli 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d82314821a5289a2939b302512b0814c42eb4b69))
* **main:** release ctrl-q-cli 1.1.0 ([129bddb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/129bddbb34c4e7fefc383fc3e5f31025f38b0c6c))
* **main:** release ctrl-q-cli 1.2.0 ([70a1ca3](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/70a1ca3ac597cd021dd3eecbe55ce3d1baaa7355))
* release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))


### Documentation

* add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
* Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
* add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
* add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
* CI debug ([fa63993](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/fa6399360e9ba8606b698948c8bbabc8b62a9ff9))
* CI debug ([a8776dd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a8776ddc65c065aef6361af04285d73a9ce4cf1c))
* CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
* CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
* polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## [1.2.0](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v1.1.0...ctrl-q-cli-v1.2.0) (2022-05-05)


### Features

* add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))


### Bug Fixes

* **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
* move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/b554f414a241b588504bf53e103a6f55961160aa))
* move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
* upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))


### Miscellaneous

* add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
* **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
* **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
* **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
* **main:** release ctrl-q-cli 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d82314821a5289a2939b302512b0814c42eb4b69))
* **main:** release ctrl-q-cli 1.1.0 ([129bddb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/129bddbb34c4e7fefc383fc3e5f31025f38b0c6c))
* release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))


### Documentation

* add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
* Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
* add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
* add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
* CI debug ([a8776dd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a8776ddc65c065aef6361af04285d73a9ce4cf1c))
* CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
* CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
* polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## [1.1.0](https://github.com/ptarmiganlabs/ctrl-q-cli/compare/ctrl-q-cli-v1.0.0...ctrl-q-cli-v1.1.0) (2022-05-05)


### Features

* add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))


### Bug Fixes

* **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
* move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/b554f414a241b588504bf53e103a6f55961160aa))
* move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
* upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))


### Miscellaneous

* add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
* **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
* **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
* **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
* **main:** release ctrl-q-cli 1.0.0 ([d823148](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d82314821a5289a2939b302512b0814c42eb4b69))
* release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))


### Documentation

* add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
* Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
* add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
* add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
* CI debug ([d3d5642](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/d3d56429033fc0e950e4c4add975946cccb6a5e4))
* CI test ([bcf76f4](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/bcf76f40b6b2037989efe60c2d6d732f091807d1))
* polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))

## 1.0.0 (2022-05-05)


### Features

* add bookmark list command ([0c6b7c1](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))


### Bug Fixes

* **deps:** update dependency node-xlsx to ^0.17.0 ([a622226](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/a6222266c4e2751788686ab2a8d9eb9cf08e67f7))
* move package.json to project root ([b554f41](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/b554f414a241b588504bf53e103a6f55961160aa))
* move package.json to src folder ([1d0098b](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
* upgraded dependencies ([e4581ec](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))


### Documentation

* add bookmarks docs ([60210bd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/60210bd0a799e1eab0ac102c4a2830af857ce8ce))
* Add get measre sample ([8ba7154](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/8ba715495e8e62e4c2dcbe8e2a5e9659158084ab))
* add jsdoc comments ([f1c2d0f](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/f1c2d0f10efb67c9b74dbd0979b811b3769e54dd))
* add sample output for dimensions ([7650169](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/76501698bccb6824bec2a1498660a27f9f79f4fd))
* polish examples ([3f9c298](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/3f9c298abf5836d2bfd0ed86e884c3a6bb4efd6c))


### Miscellaneous

* add release-please action ([ba39e8d](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/ba39e8df80729a33545dc07fbc9001e56dfd8c1c))
* **deps:** Update dependencies ([c2a9fbd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/c2a9fbd04fad4c11eb1c93570af2db467ac41ccd))
* **deps:** update googlecloudplatform/release-please-action action to v2.34.0 ([4a8d1fd](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/4a8d1fd544ac1babc34396b34d47a6238d7aaa9c))
* **deps:** update googlecloudplatform/release-please-action action to v2.35.0 ([7d0a1eb](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/7d0a1eb9d21bb925ddd6e2183622bbd0b473b10f))
* release 1.0.0 ([#2](https://github.com/ptarmiganlabs/ctrl-q-cli/issues/2)) ([1268ed2](https://github.com/ptarmiganlabs/ctrl-q-cli/commit/1268ed2e9cb375431bc1ef54231e7f70f490447b))

## 1.0.0 (2021-07-07)


### Features

* add bookmark list command ([0c6b7c1](https://www.github.com/ptarmiganlabs/ctrl-q-cli/commit/0c6b7c1e2664a627bf9febcab7009b0500d705a6))


### Bug Fixes

* move package.json to project root ([b554f41](https://www.github.com/ptarmiganlabs/ctrl-q-cli/commit/b554f414a241b588504bf53e103a6f55961160aa))
* move package.json to src folder ([1d0098b](https://www.github.com/ptarmiganlabs/ctrl-q-cli/commit/1d0098b8b8b42e348c2c066ea6580bbb976520e3))
* upgraded dependencies ([e4581ec](https://www.github.com/ptarmiganlabs/ctrl-q-cli/commit/e4581ec3f2ffe9737d7444d0f1a23f06003d16d3))
