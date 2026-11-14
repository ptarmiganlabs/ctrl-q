# Third-party notices

Ctrl-Q is MIT licensed. Third-party code that is **vendored** in this repository (copied in as files, rather than
installed from npm) is listed below, together with its licence. These files are also embedded in the Ctrl-Q binaries.
The licence texts of each library are stored next to its vendored files, and the web page that uses the library serves
them.

## Apache ECharts 6.1.0

- Used by: `qseow task-gantt` (the Gantt chart web page)
- Files: `src/static/vendor/echarts/echarts.min.js` (the `dist/echarts.min.js` file of the
  [echarts 6.1.0](https://www.npmjs.com/package/echarts/v/6.1.0) npm package, unmodified)
- sha256: `b66b25aeb4df84e33199dc21694014d336d222cbd9deb0e5a7c14bd6aa0d0fd0`
- Licence: Apache License 2.0, see `src/static/vendor/echarts/LICENSE.txt` and `NOTICE.txt`
- Source: https://github.com/apache/echarts

The bundle includes code from:

| Component                                          | Licence      | Licence text                                    |
| -------------------------------------------------- | ------------ | ----------------------------------------------- |
| [ZRender](https://github.com/ecomfe/zrender) 6.1.0 | BSD-3-Clause | `src/static/vendor/echarts/LICENSE-zrender.txt` |
| [tslib](https://github.com/microsoft/tslib) 2.3.0  | 0BSD         | `src/static/vendor/echarts/LICENSE-tslib.txt`   |
| Parts of [d3](https://github.com/d3/d3)            | BSD-3-Clause | `src/static/vendor/echarts/LICENSE-d3.txt`      |

## vis-network 9.1.9

- Used by: `qseow task-vis` (the task network web page)
- Files: `src/static/vendor/vis-network/vis-network.min.js` and `vis-network.min.css` (the `dist/vis-network.min.js`
  and `dist/dist/vis-network.min.css` files of the [vis-network 9.1.9](https://www.npmjs.com/package/vis-network/v/9.1.9)
  npm package, unmodified)
- sha256: `f6ee3a6560dd2bc7fce0b08149a30f2111e78255c5bb677e02c6517acc770379` (vis-network.min.js),
  `2e82d445ad5878ea881652470ce632601f8f55f1b99e6ebecdff8614600e6d0e` (vis-network.min.css)
- Licence: Apache License 2.0 or MIT, at your option, see `src/static/vendor/vis-network/LICENSE-APACHE-2.0.txt` and
  `LICENSE-MIT.txt`
- Source: https://github.com/visjs/vis-network

The bundle includes code from:

| Component                                                       | Licence                   | Licence text                                         |
| --------------------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| [vis-data](https://github.com/visjs/vis-data) 7.1.7             | Apache-2.0 OR MIT         | `LICENSE-APACHE-2.0.txt` and `LICENSE-MIT.txt` above |
| [vis-util](https://github.com/visjs/vis-util) 5.0.5             | Apache-2.0 OR MIT, as MIT | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [keycharm](https://github.com/AlexDM0/keycharm) 0.4.0           | Apache-2.0 OR MIT, as MIT | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [@egjs/hammerjs](https://github.com/naver/hammer.js) 2.0.17     | MIT                       | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [component-emitter](https://github.com/component/emitter) 1.3.0 | MIT                       | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [uuid](https://github.com/uuidjs/uuid) 9.0.1                    | MIT                       | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [core-js-pure](https://github.com/zloirock/core-js) 3.33.0      | MIT                       | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
| [@babel/runtime-corejs3](https://github.com/babel/babel) 7.x    | MIT                       | `src/static/vendor/vis-network/LICENSE-bundled.txt`  |
