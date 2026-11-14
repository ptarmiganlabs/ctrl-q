# Third-party notices

Ctrl-Q is MIT licensed. Third-party code that is **vendored** in this repository (copied in as files, rather than
installed from npm) is listed below, together with its licence. These files are also embedded in the Ctrl-Q binaries.
The ECharts licence texts are stored next to the vendored file, and the task-gantt page serves them.

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
- Files: `src/static/vis-network.min.js`
- Licence: Apache License 2.0 or MIT, at your option
- Source: https://github.com/visjs/vis-network
