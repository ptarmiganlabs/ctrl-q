<p align="center"><img src="docs/ctrl-q_2.png"><p>

<h1 align="center">Ctrl-Q makes life easier for Qlik Sense admins and developers.<br><br>

It is a cross platform, command line tool for interacting with client-managed Qlik Sense Enterprise on Windows.</h2>

<p align="center">
<img src="./docs/terminal_captures/ctrl-q_demo_1.gif" width="800">
</p>
<br>
<h2 align="center">Ctrl-Q is designed to be easily extensible if/when additional features are needed.<br>
It is open source with a permissive MIT license.<br>
</h2>
<p align="center">
<a href="https://github.com/ptarmiganlabs/ctrl-q"><img src="https://img.shields.io/badge/Source---" alt="Source"></a>
<a href="https://github.com/ptarmiganlabs/ctrl-q/actions/workflows/release-please.yml"><img src="https://github.com/ptarmiganlabs/ctrl-q/actions/workflows/release-please.yml/badge.svg" alt="Continuous Integration"></a>
<a href="https://github.com/ptarmiganlabs/ctrl-q/releases"><img src="https://img.shields.io/github/downloads/ptarmiganlabs/ctrl-q/total.svg?label=downloads" /></a>
<img src="https://hits.dwyl.com/ptarmiganlabs/ctrl-q.svg" />
</p>
<br>
<br>


The focus of Ctrl-Q is on slightly more complex use cases that are not handled out of the box by other tools such as [Qlik's official Qlik CLI tool](https://qlik.dev/libraries-and-tools/qlik-cli) or Adam Haydon's [Qlik CLI Windows](https://github.com/ahaydon/Qlik-Cli-Windows) tool.  
Both are exceptional tools and extremely useful, but especially when it comes to interactions with the Qlik Sense engine they fall a bit short.

Ctrl-Q also tries to fill niches that are not covered by the various members of the Butler family of open source SenseOps tools.

The Butler tools each focus on a specific feature (or features in the case of [the original Butler tool](https://github.com/ptarmiganlabs/butler)) and goes fairly deep in those areas.  
For example, [Butler SOS](https://github.com/ptarmiganlabs/butler-sos) focus on getting real-time metrics and events out of Sense and into a wide range of target databases and monitoring tools.  
[Butler Sheet Icons](https://github.com/ptarmiganlabs/butler-sheet-icons) creates sheet thumbnails for Sense apps - but offers lots of flexibility and power around that use case.

Ctrl-Q instead focus on specific, high-value uses cases that tend to be very time consuming and/or error prone to do manually.  

Automated creation of master items is an example.  
Manually creating hundreds of master items can take hours or days.  
Having the definitions in an Excel file and then using Ctrl-Q shorten that time to minutes - at least once that Excel file has been created.  
A bonus is that the process can be included in CI/CD pipelines, with increased reusability and app quality as a result.

Maybe Qlik's CLI tool will evolve to include more of these use cases and engine-focused features too - great if so.  
Until then Ctrl-Q can hopefully make life a bit easier for Sense developers and admins out there.

Enjoy!

# Contents

- [Contents](#contents)
- [Getting started](#getting-started)
- [Logging](#logging)
- [Security](#security)
  - [Virus scanning](#virus-scanning)
    - [Positive scan vs false positives](#positive-scan-vs-false-positives)
  - [Signed binaries](#signed-binaries)
- [Colors & formatting: Windows vs Windows Server vs macOS/Linux](#colors--formatting-windows-vs-windows-server-vs-macoslinux)
  - [All OSs: plain text](#all-oss-plain-text)
  - [Windows 10 using Windows Terminal](#windows-10-using-windows-terminal)
  - [macOS and Linux](#macos-and-linux)
- [Commands](#commands)
  - [Bookmarks](#bookmarks)
    - [List bookmarks](#list-bookmarks)
  - [Measures](#measures)
    - [List measures](#list-measures)
    - [Delete measures](#delete-measures)
  - [Dimensions](#dimensions)
    - [List dimensions](#list-dimensions)
    - [Delete dimensions](#delete-dimensions)
  - [Tasks](#tasks)
    - [List tasks as tree](#list-tasks-as-tree)
      - [Tree icons](#tree-icons)
      - [Text color](#text-color)
      - [Task tree details](#task-tree-details)
      - [Save tree to disk file](#save-tree-to-disk-file)
    - [List tasks as table](#list-tasks-as-table)
      - [Task table details](#task-table-details)
      - [Save task table to disk file](#save-task-table-to-disk-file)
  - [Custom properties](#custom-properties)
    - [Set custom property of reload task](#set-custom-property-of-reload-task)
  - [Import](#import)
    - [Import master items from Excel file](#import-master-items-from-excel-file)
  - [Scramble](#scramble)
  - [Get script](#get-script)

# Getting started

There is no need to install Ctrl-Q. Just download and run.  
The GitHub [release page](https://github.com/ptarmiganlabs/ctrl-q/releases) has ready-to-run binaries for Windows and macOS

The macOS binary is security scanned and signed by Apple, using their standard notarization process.  
This means you won't get those annoying unsigned-app-warnings when using the app on macOS.

# Logging

Logging is controlled by the --log-level option.

Valid values are (in order of increasing verbosity): error, warn, info, verbose, debug, silly.

Note: When using log level silly all websocket communication to/from the Sense server will be logged to the console. This means *lots* of log output.

# Security

Ctrl-Q is open source and you have access to all source code.  
It is **your own responsibility** to determine if Ctrl-Q is suitable for **your** use case.
The creators of Ctrl-Q, including Ptarmigan Labs, Göran Sander or any other contributor, can and must never be held liable to past or future security issues of Ctrl-Q.
If you have security concerns or ideas around Ctrl-Q, please get involved in the project and contribute to making it better!

    If you discover a serious bug with Ctrl-Q that may pose a security problem, please disclose it  
    confidentially to security@ptarmiganlabs.com first, so it can be assessed and hopefully fixed  
    prior to being exploited.  
    
    Please do not raise GitHub issues for serious security-related doubts or problems.

## Virus scanning

Every time a Ctrl-Q release is done the created binaries are sent to [VirusTotal](https://www.virustotal.com/) for scanning.  
VirusTotal acts as an aggregated virus scanner that sends the Ctrl-Q binaries to dozens of anti-virus scanners, including many of the major, established ones.  

Links to the VirusTotal scan report are included in each release notes, making it easy to check the status of each binary:

![VirusTotal scans as part of Ctrl-Q release notes](docs/virustotal_release_4.png "VirusTotal scans as part of Ctrl-Q release notes")

A VirusTotal scan that reports "no risks found" can look like this:

![VirusTotal scans with no risks found](docs/virustotal_scan_clear_4.png "VirusTotal scans with no risks found")

### Positive scan vs false positives

If one or more of the security vendors used by VirusTotal reports an issue you have to make a decision.  
Is it a real issue or a false positive?

You have to decide this yourself, but some general lines of thought can be:

    Is it a single vendor that reports the Ctrl-Q binary file to be a risk, or several vendors?
    If one vendor reports an issue and 60+ vendors don't, you might be looking at a false positive.

But again - at the end of the day it's **you** that must make that decision.

A scan where a single security vendor reports an issue can look like this:

![VirusTotal scans with one issue found](docs/virustotal_scan_1_issue_4.png "VirusTotal scans with one issue found")

## Signed binaries

The macOS executable binary is signed and notarized by Apple's standard process.  
A warning may still be shown first time the app is started. This is expected and normal.

The Windows executable binary is signed by "Ptarmigan Labs AB".


# Colors & formatting: Windows vs Windows Server vs macOS/Linux

Some of the Ctrl-Q commands use colors and emojis to better communicate the information retrieved from Qlik Sense.  
The task tree view is an example, but more commands may use colors in the future.

The use of colors in console/command line applications has been around since at least the 80s.  
MS-DOS supported it, as did early Windows versions.

Today this feature is quite fragmented.

Console applications using colors are natively supported on macOS and Linux.  
On Windows Server 2016 and earlier it's *very* hard to get this working, later versions may be easier.  
On Windows 10 and later it's possible to use Microsoft's excellent new command line shell, [Windows Terminal](https://github.com/microsoft/terminal).  
Highly recommended if you use a desktop Windows operating system!

Ctrl-Q tries to offer plain text visuals unless extra features, flare and color is enabled via command line parameters.

Some examples follow, showing different views of reload task trees.

## All OSs: plain text

The command for the most basic task tree is

```
ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen
```

![Qlik Sense task tree 1](docs/task-tree-no-color-1.png "Qlik Sense task tree with no colors or task details")

Add the `--tree-details` option and the result contains a lot more details for each task. Not very easy to read though.  
Note: the `task-get` command has lots of options, these are described in more detail in [List tasks as tree](#list-tasks-as-tree) section below.

```
ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen --tree-details
```

![Qlik Sense task tree 2](docs/task-tree-no-color-details-1.png "Qlik Sense task tree with task details but no colors")

## Windows 10 using Windows Terminal

Thanks to Windows Terminal handling text coloring and emojis we can add a couple of options:

- `--tree-icons` to get emojis showing the result from each task's last execution (success, fail etc)
- `--text-color yes` to get nicely colored text in the task tree

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen --tree-icons --text-color yes
```

![Qlik Sense task tree 3](docs/task-tree-color-1.png "Qlik Sense task tree with colors but no task details")

Adding `--task-details` gives us a tree that's a lot easier to read compared to previous, uncolored version.

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen --tree-icons --text-color yes --tree-details
```

![Qlik Sense task tree 4](docs/task-tree-color-details-1.png "Qlik Sense task tree with task details and colors")

## macOS and Linux

A task tree with colors on macOS and Linux versions of Ctrl-Q looks exactly like same as in Windows Terminal.  
The only difference is that you don't have to install a new command line shell.

# Commands

List available commands using the --help option:

```
C:\tools\ctrl-q>ctrl-q.exe
Usage: ctrl-q [options] [command]

Ctrl-Q is a command line utility for interacting with client-managed Qlik Sense Enterprise on Windows servers.
Among other things the tool manipulates master items and scrambles in-app data.

Options:
  -V, --version                         output the version number
  -h, --help                            display help for command

Commands:
  master-item-import [options]          create master items based on definitions in a file on disk
  master-item-measure-get [options]     get info about one or more master measures
  master-item-measure-delete [options]  delete master measure(s)
  master-item-dim-get [options]         get info about one or more master dimensions
  master-item-dim-delete [options]      delete master dimension(s)
  field-scramble [options]              scramble one or more fields in an app. A new app with the scrambled data is created.
  script-get [options]                  get script from Qlik Sense app
  bookmark-get [options]                get info about one or more bookmarks
  task-get [options]                    get info about one or more tasks
  task-custom-property-set [options]    update a custom property of one or more tasks
  help [command]                        display help for command
  
C:\tools\ctrl-q>
```

## Bookmarks

### List bookmarks

```
C:\tools\ctrl-q>ctrl-q.exe bookmark-get --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --output-format table --auth-user-dir LAB --auth-user-id goran
2022-11-01T06:36:05.720Z info: -----------------------------------------------------------
2022-11-01T06:36:05.722Z info: | Ctrl-Q
2022-11-01T06:36:05.738Z info: |
2022-11-01T06:36:05.739Z info: | Version      : 3.3.0
2022-11-01T06:36:05.740Z info: | Log level    : info
2022-11-01T06:36:05.741Z info: |
2022-11-01T06:36:05.743Z info: | Command      : bookmark-get
2022-11-01T06:36:05.744Z info: |              : get info about one or more bookmarks
2022-11-01T06:36:05.745Z info: |
2022-11-01T06:36:05.746Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T06:36:05.747Z info: |
2022-11-01T06:36:05.748Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T06:36:05.749Z info: ----------------------------------------------------------
2022-11-01T06:36:05.757Z info:
2022-11-01T06:36:05.774Z info: Get bookmarks
2022-11-01T06:36:06.155Z info: Bookmarks
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Bookmarks (1 bookmark(s) found in the app)                                                                                                                                                                                                                                                                         │
├──────────────────────────────────────┬──────────┬───────────┬─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬─────────────────────┤
│ Id                                   │ Type     │ Title     │ Description     │ Bookmark definition                                                                                  │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner               │
├──────────────────────────────────────┼──────────┼───────────┼─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┤
│ 81ec0c0d-c90c-431b-8c19-eff4048de404 │ bookmark │ Bookmark1 │ BM1 description │ {"qStateData":[{"qStateName":"$","qFieldItems":[{"qDef":{"qName":"Dim1","qType":"PRESENT"},"qSelectI │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-07-06T15:09:38.565Z │ 2021-07-06T15:09:38.565Z │ undefined\undefined │
│                                      │          │           │                 │ nfo":{"qRangeLo":"NaN","qRangeHi":"NaN","qNumberFormat":{"qType":"U","qnDec":10,"qUseThou":0},"qRang │          │           │                          │                          │                          │                     │
│                                      │          │           │                 │ eInfo":[],"qContinuousRangeInfo":[]},"qValues":[],"qExcludedValues":[]}]}],"qUtcModifyTime":44383.71 │          │           │                          │                          │                          │                     │
│                                      │          │           │                 │ 498842593,"qVariableItems":[],"qPatches":[]}                                                         │          │           │                          │                          │                          │                     │
└──────────────────────────────────────┴──────────┴───────────┴─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴─────────────────────┘

C:\tools\ctrl-q>
```

## Measures

### List measures

```
C:\tools\ctrl-q>ctrl-q.exe master-item-measure-get --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --output-format table --auth-user-dir LAB --auth-user-id goran
2022-11-01T07:16:12.715Z info: -----------------------------------------------------------
2022-11-01T07:16:12.717Z info: | Ctrl-Q
2022-11-01T07:16:12.733Z info: |
2022-11-01T07:16:12.734Z info: | Version      : 3.3.0
2022-11-01T07:16:12.735Z info: | Log level    : info
2022-11-01T07:16:12.736Z info: |
2022-11-01T07:16:12.738Z info: | Command      : master-item-measure-get
2022-11-01T07:16:12.739Z info: |              : get info about one or more master measures
2022-11-01T07:16:12.740Z info: |
2022-11-01T07:16:12.741Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T07:16:12.742Z info: |
2022-11-01T07:16:12.743Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T07:16:12.751Z info: ----------------------------------------------------------
2022-11-01T07:16:12.774Z info:
2022-11-01T07:16:12.779Z info: Get master measures
2022-11-01T07:16:13.164Z info:
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Measures (6 measure(s) found in the app)                                                                                                                                                                                                                                                                                                                                                          │
├──────────────────────────────────────┬─────────┬────────────────────────┬───────────────────────────────────────────────────┬──────────────────┬──────────────────┬──────────────────────┬───────────┬───────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬─────────────────────┬───────────┤
│ Id                                   │ Type    │ Title                  │ Description                                       │ Label            │ Label expression │ Definition           │ Coloring  │ Number format                         │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner               │ Tags      │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ 04bf8dc9-a354-41f5-ad57-cb445c725479 │ measure │ Revenue EUR            │ Revenue during selected time period.              │ ='Revenue'       │ ='Revenue'       │ Sum(Revenue)         │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ undefined\undefined │ Sales     │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ 57b1e128-014a-42e4-991e-ab2cc9124b7a │ measure │ Revenue EUR (LY)       │ Revenue during last year.                         │ ='Revenue LY'    │ ='Revenue LY'    │ Sum(Revenue_LY)      │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ undefined\undefined │ Sales, LY │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ 81f92d37-b201-4752-9314-33af74a57d94 │ measure │ No. of sold units (LY) │ Number of units sold last year.                   │ ='Sold units LY' │ ='Sold units LY' │ Sum(UnitsInOrder_LY) │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ undefined\undefined │ Sales, LY │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ bcbed8aa-f76f-40ee-ba23-ae8a9a58f7c5 │ measure │ No. of sold units      │ Number of units sold during selected time period. │ ='Sold units'    │ ='Sold units'    │ =Sum(UnitsInOrder)   │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ undefined\undefined │ Sales     │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ 2a14160f-2bc9-45d0-86da-3c3c50ab3216 │ measure │ Profit EUR (LY)        │ Profit during last year                           │ ='Profit LY'     │ ='Profit LY'     │ Sum(Profit_LY)       │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:30:45.026Z │ undefined\undefined │ Sales, LY │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼───────────┤
│ 86c518f1-39b9-4e74-9152-add4218464ef │ measure │ Profit EUR             │ Profit during selected time period.               │ ='Profit'        │ ='Profit'        │ Sum(Profit)          │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:30:45.026Z │ undefined\undefined │ Sales     │
└──────────────────────────────────────┴─────────┴────────────────────────┴───────────────────────────────────────────────────┴──────────────────┴──────────────────┴──────────────────────┴───────────┴───────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴─────────────────────┴───────────┘

C:\tools\ctrl-q>
```

### Delete measures

```
C:\tools\ctrl-q>ctrl-q.exe master-item-measure-delete --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --auth-user-dir LAB --auth-user-id goran --id-type id --master-item 57b1e128-014a-42e4-991e-ab2cc9124b7a bcbed8aa-f76f-40ee-ba23-ae8a9a58f7c5
2022-11-01T08:00:11.515Z info: -----------------------------------------------------------
2022-11-01T08:00:11.517Z info: | Ctrl-Q
2022-11-01T08:00:11.533Z info: |
2022-11-01T08:00:11.534Z info: | Version      : 3.3.0
2022-11-01T08:00:11.535Z info: | Log level    : info
2022-11-01T08:00:11.536Z info: |
2022-11-01T08:00:11.538Z info: | Command      : master-item-measure-delete
2022-11-01T08:00:11.539Z info: |              : delete master measure(s)
2022-11-01T08:00:11.540Z info: |
2022-11-01T08:00:11.541Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:00:11.542Z info: |
2022-11-01T08:00:11.543Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:00:11.544Z info: ----------------------------------------------------------
2022-11-01T08:00:11.545Z info:
2022-11-01T08:00:11.550Z info: Delete master measures
2022-11-01T08:00:11.944Z info: Deleted master item measure "Revenue EUR (LY)", id=57b1e128-014a-42e4-991e-ab2cc9124b7a in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
2022-11-01T08:00:11.945Z info: Deleted master item measure "No. of sold units", id=bcbed8aa-f76f-40ee-ba23-ae8a9a58f7c5 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"

C:\tools\ctrl-q>
```

## Dimensions

### List dimensions

```
C:\tools\ctrl-q>ctrl-q.exe master-item-dim-get --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --output-format table --auth-user-dir LAB --auth-user-id goran
2022-11-01T08:01:00.074Z info: -----------------------------------------------------------
2022-11-01T08:01:00.075Z info: | Ctrl-Q
2022-11-01T08:01:00.076Z info: |
2022-11-01T08:01:00.076Z info: | Version      : 3.3.0
2022-11-01T08:01:00.076Z info: | Log level    : info
2022-11-01T08:01:00.078Z info: |
2022-11-01T08:01:00.079Z info: | Command      : master-item-dim-get
2022-11-01T08:01:00.080Z info: |              : get info about one or more master dimensions
2022-11-01T08:01:00.081Z info: |
2022-11-01T08:01:00.082Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:01:00.083Z info: |
2022-11-01T08:01:00.084Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:01:00.104Z info: ----------------------------------------------------------
2022-11-01T08:01:00.105Z info:
2022-11-01T08:01:00.109Z info: Get master dimensions
2022-11-01T08:01:00.593Z info:
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dimensions (4 dimension(s) found in the app)                                                                                                                                                                                                                                                                                                                                                                                                               │
├──────────────────────────────────────┬───────────┬─────────────────┬────────────────────────────────┬───────────────────────────────┬────────────────────────┬──────────────────┬──────────────────┬─────────────┬───────────────────────────────────────────────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬─────────────────────┬────────────────┤
│ Id                                   │ Type      │ Title           │ Description (static)           │ Description (from expression) │ Description expression │ Label expression │ Definition count │ Definition  │ Coloring                                                                      │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner               │ Tags           │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼────────────────┤
│ 866fc972-76fb-49c4-bceb-2db959d1d59e │ dimension │ Country         │ Country where a unit was sold. │                               │                        │ ='Country'       │ 1                │ Country     │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-13T18:30:45.026Z │ undefined\undefined │ Geo            │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼────────────────┤
│ JDWuPK                               │ dimension │ Dimension 2-3-1 │ Description for 2-3-1          │                               │                        │                  │ 3                │ Dim2        │ {"changeHash":"0.5399463179200534","baseColor":{"color":"#ffffff","index":1}} │ H        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-07T02:31:02.093Z │ 2021-06-07T02:31:02.093Z │ undefined\undefined │ My awesome tag │
│                                      │           │                 │                                │                               │                        │                  │                  │ Dim3        │                                                                               │          │          │           │                          │                          │                          │                     │                │
│                                      │           │                 │                                │                               │                        │                  │                  │ Dim1        │                                                                               │          │          │           │                          │                          │                          │                     │                │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼────────────────┤
│ 0f42eeb1-4087-4f22-9d24-3822046248f6 │ dimension │ Salesperson     │ The person who sold the unit.  │                               │                        │ ='Salesperson'   │ 1                │ Salesperson │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:52:56.731Z │ undefined\undefined │ Staff, Sales   │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────┼────────────────┤
│ cd45177a-bbd2-45fb-8c7c-a31ebe3972b2 │ dimension │ Sales month     │ Date in which a unit was sold. │                               │                        │ ='Sales month'   │ 1                │ Month_Sales │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:52:56.731Z │ undefined\undefined │ Sales calendar │
└──────────────────────────────────────┴───────────┴─────────────────┴────────────────────────────────┴───────────────────────────────┴────────────────────────┴──────────────────┴──────────────────┴─────────────┴───────────────────────────────────────────────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴─────────────────────┴────────────────┘

C:\tools\ctrl-q>
```

### Delete dimensions

```
C:\tools\ctrl-q>ctrl-q.exe master-item-dim-delete --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --auth-user-dir LAB --auth-user-id goran --id-type id --master-item 0f42eeb1-4087-4f22-9d24-3822046248f6 cd45177a-bbd2-45fb-8c7c-a31ebe3972b2
2022-11-01T08:02:02.045Z info: -----------------------------------------------------------
2022-11-01T08:02:02.047Z info: | Ctrl-Q
2022-11-01T08:02:02.063Z info: |
2022-11-01T08:02:02.064Z info: | Version      : 3.3.0
2022-11-01T08:02:02.065Z info: | Log level    : info
2022-11-01T08:02:02.066Z info: |
2022-11-01T08:02:02.067Z info: | Command      : master-item-dim-delete
2022-11-01T08:02:02.068Z info: |              : delete master dimension(s)
2022-11-01T08:02:02.069Z info: |
2022-11-01T08:02:02.070Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:02:02.072Z info: |
2022-11-01T08:02:02.072Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:02:02.074Z info: ----------------------------------------------------------
2022-11-01T08:02:02.075Z info:
2022-11-01T08:02:02.079Z info: Delete master dimensions
2022-11-01T08:02:02.436Z info: Deleted master item dimension "Salesperson", id=0f42eeb1-4087-4f22-9d24-3822046248f6 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
2022-11-01T08:02:02.437Z info: Deleted master item dimension "Sales month", id=cd45177a-bbd2-45fb-8c7c-a31ebe3972b2 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"

C:\tools\ctrl-q>
```

## Tasks

### List tasks as tree

This command provides a hierarchical tree view of reload tasks, similar to what is available in QlikView.

The tree view can be enhanced with colours (see [above](#colors--formatting-windows-vs-windows-server-vs-macoslinux)) and task details.

There are quite a few customisation options available when creating a task tree. Note that some options are used when creating task tables, these are not applicable for task trees. Ctrl-Q will show an error when invalid combinations of options are used.

Here [Windows Terminal](https://github.com/microsoft/terminal) is used to run Ctrl-Q:

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get --help
Usage: ctrl-q task-get [options]

get info about one or more tasks

Options:
  --log-level <level>            log level (choices: "error", "warn", "info", "verbose", "debug", "silly", default: "info")
  --host <host>                  Qlik Sense server IP/FQDN
  --port <port>                  Qlik Sense repository service (QRS) port (default: "4242")
  --schema-version <string>      Qlik Sense engine schema version (default: "12.612.0")
  --virtual-proxy <prefix>       Qlik Sense virtual proxy prefix (default: "")
  --secure <true|false>          connection to Qlik Sense engine is via https (default: true)
  --auth-user-dir <directory>    user directory for user to connect with
  --auth-user-id <userid>        user ID for user to connect with
  -a, --auth-type <type>         authentication type (choices: "cert", default: "cert")
  --auth-cert-file <file>        Qlik Sense certificate file (exported from QMC) (default: "./cert/client.pem")
  --auth-cert-key-file <file>    Qlik Sense certificate key file (exported from QMC) (default: "./cert/client_key.pem")
  --auth-root-cert-file <file>   Qlik Sense root certificate file (exported from QMC) (default: "./cert/root.pem")
  --task-type <type>             type of tasks to list (choices: "reload", default: "reload")
  --task-id <ids...>             use task IDs to select which tasks to retrieve
  --output-format <format>       output format (choices: "table", "tree", default: "tree")
  --output-dest <dest>           where to send task info (choices: "screen", "file", default: "screen")
  --output-file-name <name>      file name to store task info in (default: "")
  --output-file-format <format>  file type/format (choices: "excel", "csv", "json", default: "excel")
  --output-file-overwrite        overwrite output file without asking
  --text-color <show>            use colored text in task views (choices: "yes", "no", default: "yes")
  --tree-icons                   display task status icons in tree view
  --tree-details [detail...]     display details for each task in tree view (choices: "taskid", "laststart", "laststop", "nextstart", "appname", "appstream", default: "")
  --table-details [detail...]    which aspects of tasks should be included in table view (choices: "common", "lastexecution", "tag", "customproperty", "schematrigger", "compositetrigger", "comptimeconstraint", "comprule", default: "")
  -h, --help                     display help for command
PS C:\tools\ctrl-q>
```

#### Tree icons

If `--tree-icons` is used when starting Ctrl-Q emojis will be used to indicate the last known state for each task.

The used emojis are

|   | Descriptions  |
|---|---|
| ⏰ | Shown at the top of the tree of scheduled tasks. All tasks below this node have a time-based scheduled. |
| ✅ | Finished successfully. |
| ❌ | Failed  |
| 🚫 | Skipped  |
| 🛑 | Aborted  |
| 💤 | Never started  |
| ❔ | Unknown  |

#### Text color

If `--text-color yes` is specified (`yes` is also the default value) colors will be used to make the created tree more readable.  
`--text-color no` will create a plain-text tree (no colors).

#### Task tree details

The `--tree-details` option makes it possible to switch on/off individual task details. This can be useful to make the task tree easier to read.  
The allowed values for this option are `taskid`, `laststart`, `laststop`, `nextstart`, `appname`, `appstream`.

Let's say we want a task tree with the app name and next start time for the task:

```
ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen --tree-icons --text-color yes --tree-details nextstart appname
```

![Qlik Sense task tree 5](docs/task-tree-color-details-2_65.png "Qlik Sense task tree with task details and colors")

#### Save tree to disk file

Under the hood the task tree is stored as a JSON structure.  
It's possible to save this JSON to disk:

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest file --tree-details appname --output-file-name tasktree.txt --output-file-format json
2022-11-02T06:52:13.285Z info: -----------------------------------------------------------
2022-11-02T06:52:13.285Z info: | Ctrl-Q
2022-11-02T06:52:13.285Z info: |
2022-11-02T06:52:13.285Z info: | Version      : 3.3.0
2022-11-02T06:52:13.285Z info: | Log level    : info
2022-11-02T06:52:13.285Z info: |
2022-11-02T06:52:13.285Z info: | Command      : task-get
2022-11-02T06:52:13.285Z info: |              : get info about one or more tasks
2022-11-02T06:52:13.285Z info: |
2022-11-02T06:52:13.285Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-02T06:52:13.285Z info: |
2022-11-02T06:52:13.285Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-02T06:52:13.285Z info: ----------------------------------------------------------
2022-11-02T06:52:13.285Z info:
2022-11-02T06:52:13.300Z info: Get tasks
2022-11-02T06:52:13.753Z info: GET TASK: # tasks: 55
2022-11-02T06:52:14.018Z info: GET SCHEMA EVENT: # events: 29
2022-11-02T06:52:14.316Z info: GET COMPOSITE EVENT: # events: 15
2022-11-02T06:52:14.331Z info: ✅ Writing task tree to disk file "tasktree.txt".
PS C:\tools\ctrl-q>
PS C:\tools\ctrl-q> dir

    Directory: C:\tools\ctrl-q


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----        01/11/2022     14:45                cert
-a----        12/10/2022     15:15           9906 ctrl-q-testdata.xlsx
-a----        01/11/2022     13:37      115021002 ctrl-q.exe
-a----        02/11/2022     07:52          17950 tasktree.txt

PS C:\tools\ctrl-q>
```

Running the same command again, when the destination file already exists, results in a question to overwrite the file:

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest file --tree-details appname --output-file-name tasktree.txt --output-file-format json
2022-11-02T07:36:43.464Z info: -----------------------------------------------------------
2022-11-02T07:36:43.464Z info: | Ctrl-Q
2022-11-02T07:36:43.464Z info: |
2022-11-02T07:36:43.464Z info: | Version      : 3.4.0
2022-11-02T07:36:43.464Z info: | Log level    : info
2022-11-02T07:36:43.464Z info: |
2022-11-02T07:36:43.464Z info: | Command      : task-get
2022-11-02T07:36:43.464Z info: |              : get info about one or more tasks
2022-11-02T07:36:43.464Z info: |
2022-11-02T07:36:43.464Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-02T07:36:43.464Z info: |
2022-11-02T07:36:43.464Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-02T07:36:43.480Z info: ----------------------------------------------------------
2022-11-02T07:36:43.480Z info:
2022-11-02T07:36:43.480Z info: Get tasks
2022-11-02T07:36:43.963Z info: GET TASK: # tasks: 55
2022-11-02T07:36:44.276Z info: GET SCHEMA EVENT: # events: 29
2022-11-02T07:36:44.620Z info: GET COMPOSITE EVENT: # events: 15
2022-11-02T07:36:44.636Z info:
                                  Destination file "tasktree.txt" exists. Do you want to overwrite it? (y/n) n
2022-11-02T07:36:48.999Z info:
2022-11-02T07:36:48.999Z info: ❌ Not overwriting existing output file. Exiting.
PS C:\tools\ctrl-q>
```

To forcibly overwrite the destination file the `--output-file-overwrite` option can be specified.

### List tasks as table

#### Task table details

The `--table-details` option makes it possible to switch on/off individual task details. This can be useful to make the task tree easier to read.  
The allowed values for this option are `taskid`, `laststart`, `laststop`, `nextstart`, `appname`, `appstream`.

Let's say we want a task tree with the app name and next start time for the task:

```
ctrl-q.exe task-get --auth-type cert --host 192.168.100.109 --auth-user-dir LAB --auth-user-id goran --output-format tree --output-dest screen --tree-icons --text-color yes --tree-details nextstart appname
```

![Qlik Sense task tree 5](docs/task-tree-color-details-2_65.png "Qlik Sense task tree with task details and colors")

#### Save task table to disk file


## Custom properties

### Set custom property of reload task

## Import

### Import master items from Excel file

This command imports dimensions and measures into master items in a Sense app.

First let's take a look at the command options:

```
C:\tools\ctrl-q>ctrl-q.exe master-item-import --help
Usage: ctrl-q master-item-import [options]

create master items based on definitions in a file on disk

Options:
  --log-level <level>                                log level (choices: "error", "warn", "info", "verbose", "debug", "silly", default: "info")
  --host <host>                                      Qlik Sense server IP/FQDN
  --port <port>                                      Qlik Sense server engine port (default: "4747")
  --schema-version <string>                          Qlik Sense engine schema version (default: "12.612.0")
  --app-id <id>                                      Qlik Sense app ID
  --virtual-proxy <prefix>                           Qlik Sense virtual proxy prefix (default: "")
  --secure <true|false>                              connection to Qlik Sense engine is via https (default: true)
  --auth-user-dir <directory>                        user directory for user to connect with
  --auth-user-id <userid>                            user ID for user to connect with
  -a, --auth-type <type>                             authentication type (choices: "cert", default: "cert")
  --auth-cert-file <file>                            Qlik Sense certificate file (exported from QMC) (default: "./cert/client.pem")
  --auth-cert-key-file <file>                        Qlik Sense certificate key file (exported from QMC) (default: "./cert/client_key.pem")
  --auth-root-cert-file <file>                       Qlik Sense root certificate file (exported from QMC) (default: "./cert/root.pem")
  -t, --file-type <type>                             source file type (choices: "excel", default: "excel")
  --file <filename>                                  file containing master item definitions
  --sheet <name>                                     name of Excel sheet where dim/measure flag column is found
  --col-ref-by <reftype>                             how to refer to columns in the source file. Options are by name or by position (zero based) (choices: "name", "position", default: "name")
  --col-item-type <column position or name>          column where dim/measure flag is found. Use "dim" in that column to create master dimension, "measure" for master measure
  --col-master-item-name <column position or name>   column number (zero based) to use as master item name
  --col-master-item-descr <column position or name>  column number (zero based) to use as master item description
  --col-master-item-label <column position or name>  column number (zero based) to use as master item label
  --col-master-item-expr <column position or name>   column number (zero based) to use as master item expression
  --col-master-item-tag <column position or name>    column number (zero based) to use as master item tags
  --limit-import-count <number>                      import at most x number of master items from the Excel file. Defaults to 0 = no limit (default: 0)
  -h, --help                                         display help for command

C:\tools\ctrl-q>
```

Now let's run the command.  
Note the (intentional) warning for the incorrectly spelled master item type "measur" (which should have been "measure", of course).

```
C:\tools\ctrl-q>ctrl-q.exe master-item-import --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --auth-user-dir LAB --auth-user-id goran --auth-type cert --file-type excel --file ./ctrl-q-testdata.xlsx --sheet Sales --col-ref-by name --col-item-type "Master item type" --col-master-item-name "Master Item Name" --col-master-item-descr Description --col-master-item-label Label --col-master-item-expr Expression --col-master-item-tag Tag
2022-11-01T08:04:17.806Z info: -----------------------------------------------------------
2022-11-01T08:04:17.808Z info: | Ctrl-Q
2022-11-01T08:04:17.825Z info: |
2022-11-01T08:04:17.826Z info: | Version      : 3.3.0
2022-11-01T08:04:17.827Z info: | Log level    : info
2022-11-01T08:04:17.828Z info: |
2022-11-01T08:04:17.829Z info: | Command      : master-item-import
2022-11-01T08:04:17.831Z info: |              : create master items based on definitions in a file on disk
2022-11-01T08:04:17.832Z info: |
2022-11-01T08:04:17.833Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:04:17.834Z info: |
2022-11-01T08:04:17.835Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:04:17.836Z info: ----------------------------------------------------------
2022-11-01T08:04:17.837Z info:
2022-11-01T08:04:17.841Z info: Import master items from definitions in Excel file "./ctrl-q-testdata.xlsx"
2022-11-01T08:04:18.237Z info: Created new measure "No. of sold units"
2022-11-01T08:04:18.240Z info: Updated existing measure "No. of sold units (LY)"
2022-11-01T08:04:18.257Z info: Updated existing measure "Revenue EUR"
2022-11-01T08:04:18.261Z info: Created new measure "Revenue EUR (LY)"
2022-11-01T08:04:18.264Z info: Updated existing measure "Profit EUR"
2022-11-01T08:04:18.264Z warn: Found an unknown master item type: "measur". Ignoring this line in the imported file.
2022-11-01T08:04:18.267Z info: Updated existing measure "Profit EUR (LY)"
2022-11-01T08:04:18.270Z info: Updated existing dimension "Country"
2022-11-01T08:04:18.290Z info: Created new dimension "Sales month"
2022-11-01T08:04:18.295Z info: Created new dimension "Salesperson"

C:\tools\ctrl-q>
```

## Scramble

Scrambles one or more fields in an app using Qlik Sense's internal scrambling feature.  

Note:  

- If more than one field is to be scrambled, the indidivudal field names should be separated by the character or string specified in the `--separator` option. 
- The entire list of field names (the `--fieldname` option) should be surrounded by double quotes.
- A new app with the scrambled data will be created. Specify its name in the `--newappname` option.

```
C:\tools\ctrl-q>ctrl-q.exe field-scramble --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --auth-user-dir LAB --auth-user-id goran --field-name Expression1 Dim1 AsciiAlpha --new-app-name __ScrambledTest1
2022-11-01T08:06:08.417Z info: -----------------------------------------------------------
2022-11-01T08:06:08.418Z info: | Ctrl-Q
2022-11-01T08:06:08.436Z info: |
2022-11-01T08:06:08.437Z info: | Version      : 3.3.0
2022-11-01T08:06:08.438Z info: | Log level    : info
2022-11-01T08:06:08.439Z info: |
2022-11-01T08:06:08.440Z info: | Command      : field-scramble
2022-11-01T08:06:08.442Z info: |              : scramble one or more fields in an app. A new app with the scrambled data is created.
2022-11-01T08:06:08.443Z info: |
2022-11-01T08:06:08.444Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:06:08.445Z info: |
2022-11-01T08:06:08.446Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:06:08.447Z info: ----------------------------------------------------------
2022-11-01T08:06:08.448Z info:
2022-11-01T08:06:08.453Z info: Scramble field
2022-11-01T08:06:08.837Z info: Scrambled field "Expression1"
2022-11-01T08:06:08.841Z info: Scrambled field "Dim1"
2022-11-01T08:06:08.858Z info: Scrambled field "AsciiAlpha"
2022-11-01T08:06:09.347Z info: Scrambled data written to new app "__ScrambledTest1" with app ID: ae013d9d-8280-4315-9d9c-a039c8b6c3b7

C:\tools\ctrl-q>
```

## Get script

Get script and associated metadata for a Sense app.

Available options:

```

```


```
C:\tools\ctrl-q>ctrl-q.exe script-get --host 192.168.100.109 --app-id a3e0f5d2-000a-464f-998d-33d333b175d7 --auth-user-dir LAB --auth-user-id goran
2022-11-01T08:06:45.716Z info: -----------------------------------------------------------
2022-11-01T08:06:45.718Z info: | Ctrl-Q
2022-11-01T08:06:45.733Z info: |
2022-11-01T08:06:45.735Z info: | Version      : 3.3.0
2022-11-01T08:06:45.736Z info: | Log level    : info
2022-11-01T08:06:45.737Z info: |
2022-11-01T08:06:45.738Z info: | Command      : script-get
2022-11-01T08:06:45.739Z info: |              : get script from Qlik Sense app
2022-11-01T08:06:45.740Z info: |
2022-11-01T08:06:45.741Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2022-11-01T08:06:45.742Z info: |
2022-11-01T08:06:45.744Z info: | https://github.com/ptarmiganlabs/ctrl-q
2022-11-01T08:06:45.745Z info: ----------------------------------------------------------
2022-11-01T08:06:45.746Z info:
2022-11-01T08:06:46.113Z info: ----- Script metadata -----
2022-11-01T08:06:46.114Z info: App id: a3e0f5d2-000a-464f-998d-33d333b175d7
2022-11-01T08:06:46.130Z info: Created date: 2021-06-03T22:04:52.283Z
2022-11-01T08:06:46.132Z info: Modified date: 2021-06-04T15:42:23.759Z
2022-11-01T08:06:46.133Z info: ----- End script metadata -----
2022-11-01T08:06:46.134Z info:
///$tab Main
SET ThousandSep=',';
SET DecimalSep='.';
SET MoneyThousandSep=',';
SET MoneyDecimalSep='.';
SET MoneyFormat='$#,##0.00;-$#,##0.00';
SET TimeFormat='h:mm:ss TT';
SET DateFormat='M/D/YYYY';
SET TimestampFormat='M/D/YYYY h:mm:ss[.fff] TT';
SET FirstWeekDay=6;
SET BrokenWeeks=1;
SET ReferenceDay=0;
SET FirstMonthOfYear=1;
SET CollationLocale='en-US';
SET CreateSearchIndexOnReload=1;
SET MonthNames='Jan;Feb;Mar;Apr;May;Jun;Jul;Aug;Sep;Oct;Nov;Dec';
SET LongMonthNames='January;February;March;April;May;June;July;August;September;October;November;December';
SET DayNames='Mon;Tue;Wed;Thu;Fri;Sat;Sun';
SET LongDayNames='Monday;Tuesday;Wednesday;Thursday;Friday;Saturday;Sunday';
SET NumericalAbbreviation='3:k;6:M;9:G;12:T;15:P;18:E;21:Z;24:Y;-3:m;-6:μ;-9:n;-12:p;-15:f;-18:a;-21:z;-24:y';

Characters:
Load Chr(RecNo()+Ord('A')-1) as Alpha, RecNo() as Num autogenerate 26;

ASCII:
Load
 if(RecNo()>=65 and RecNo()<=90,RecNo()-64) as Num,
 Chr(RecNo()) as AsciiAlpha,
 RecNo() as AsciiNum
autogenerate 255
 Where (RecNo()>=32 and RecNo()<=126) or RecNo()>=160 ;

Transactions:
Load
 TransLineID,
 TransID,
 mod(TransID,26)+1 as Num,
 Pick(Ceil(3*Rand1),'A','B','C') as Dim1,
 Pick(Ceil(6*Rand1),'a','b','c','d','e','f') as Dim2,
 Pick(Ceil(3*Rand()),'X','Y','Z') as Dim3,
 Round(1000*Rand()*Rand()*Rand1) as Expression1,
 Round(  10*Rand()*Rand()*Rand1) as Expression2,
 Round(Rand()*Rand1,0.00001) as Expression3;
Load
 Rand() as Rand1,
 IterNo() as TransLineID,
 RecNo() as TransID
Autogenerate 1000
 While Rand()<=0.5 or IterNo()=1;

 Comment Field Dim1 With "This is a field comment";

C:\tools\ctrl-q>
```
