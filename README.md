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

The current list of features are:

- Get complete definition of all reload tasks as tree view, tabular view or JSON. Show on screen or save to disk file.
- Bulk import of reload tasks from disk files. Optionally also import QVF files.<br>
  Building task chains with new and/or existing tasks supported. <br>
  All options available in the QMC (and then some!) can be defined.
- Bulk import of QVF files into Sense apps. 
- Update custom properties for multiple tasks.
- Import master dimensions and master measures from definitions in Excel file.
- Show complete definition for all master measures in a Sense app.
- Delete master measures from a Sense app.
- Show complete definition for all master dimensions in a Sense app.
- Delete master dimensions from a Sense app.
- Show complete definition of all bookmarks in a Sense app.
- Scramble fields in Sense apps.
- Get load script from Sense app.

As Ctrl-Q is completely command line driven it is very suitable to be used in CI/CD pipelines, with time savings, increased reusability and higher app quality as a result.

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
- [Colors \& formatting: Windows vs Windows Server vs macOS/Linux](#colors--formatting-windows-vs-windows-server-vs-macoslinux)
  - [All OSs: plain text](#all-oss-plain-text)
  - [Windows 10 using Windows Terminal](#windows-10-using-windows-terminal)
  - [macOS and Linux](#macos-and-linux)
- [Dry runs are a good idea](#dry-runs-are-a-good-idea)
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
      - [Show task table on screen](#show-task-table-on-screen)
      - [Save task to disk file in tabular format](#save-task-to-disk-file-in-tabular-format)
      - [Save task to disk file as JSON](#save-task-to-disk-file-as-json)
  - [Custom properties](#custom-properties)
    - [Set custom property of reload task](#set-custom-property-of-reload-task)
  - [Import](#import)
    - [Import master items from Excel file](#import-master-items-from-excel-file)
    - [Import apps from QVF files](#import-apps-from-qvf-files)
    - [Import reload tasks from file](#import-reload-tasks-from-file)
      - [Source file columns for task defintions](#source-file-columns-for-task-defintions)
      - [Source file columns for app import definitions](#source-file-columns-for-app-import-definitions)
      - [Example: Export tasks to CSV, then import tasks from same CSV](#example-export-tasks-to-csv-then-import-tasks-from-same-csv)
      - [Example: Import tasks from Excel file with chaining of new tasks](#example-import-tasks-from-excel-file-with-chaining-of-new-tasks)
      - [Example: Import apps from QVF files and create associated reload tasks](#example-import-apps-from-qvf-files-and-create-associated-reload-tasks)
        - [Defining apps to be imported](#defining-apps-to-be-imported)
        - [Defining tasks to be created](#defining-tasks-to-be-created)
        - [Associating new tasks with imported and existing apps](#associating-new-tasks-with-imported-and-existing-apps)
  - [Scramble fields in Sense app](#scramble-fields-in-sense-app)
  - [Get script](#get-script)

# Getting started

There is no need to install Ctrl-Q. Just download and run.  
The GitHub [release page](https://github.com/ptarmiganlabs/ctrl-q/releases) has ready-to-run binaries for Windows, macOS and Linux.

The macOS binary is security scanned and signed by Apple, using their standard notarization process.  
This means you won't get those annoying unsigned-app-warnings when using the app on macOS.

The Windows binary is signed by an official/commercial app signing certificate that can be verified when needed.

# Logging

Logging is controlled by the --log-level option.

Valid values are (in order of increasing verbosity): error, warn, info, verbose, debug, silly.

Note: When using log level silly all websocket communication to/from the Sense server will be logged to the console. This means *lots* of log output.

# Security

Ctrl-Q is open source and you have access to all source code.

It is ***your responsibility*** to determine if Ctrl-Q is suitable for **your** use case.  
The creators of Ctrl-Q, including Ptarmigan Labs, Göran Sander or any other contributor, can and must never be held liable to past or future security issues of Ctrl-Q.
If you have security concerns or ideas around Ctrl-Q, please get involved in the project and contribute to making it better!

    If you discover a serious bug with Ctrl-Q that may pose a security problem, please disclose it  
    confidentially to security@ptarmiganlabs.com first, so it can be assessed and hopefully fixed  
    prior to being exploited.  
    
    Please do not raise GitHub issues for serious security-related doubts or problems.

## Virus scanning

Every time a Ctrl-Q release is done the created binaries are sent to [VirusTotal](https://www.virustotal.com/) for scanning.  
VirusTotal acts as an aggregated virus scanner that sends the Ctrl-Q binaries to dozens of anti-virus scanners, including many of the major/most widely used ones.  

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
ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest screen
```

![Qlik Sense task tree 1](docs/task-tree-no-color-1.png "Qlik Sense task tree with no colors or task details")

Add the `--tree-details` option and the result contains a lot more details for each task. Not very easy to read though.  
Note: the `task-get` command has lots of options, these are described in more detail in [List tasks as tree](#list-tasks-as-tree) section below.

```
ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest screen `
--tree-details
```

![Qlik Sense task tree 2](docs/task-tree-no-color-details-1.png "Qlik Sense task tree with task details but no colors")

## Windows 10 using Windows Terminal

Thanks to Windows Terminal handling text coloring and emojis we can add a couple of options:

- `--tree-icons` to get emojis showing the result from each task's last execution (success, fail etc)
- `--text-color yes` to get nicely colored text in the task tree

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest screen `
--tree-icons `
--text-color yes
```

![Qlik Sense task tree 3](docs/task-tree-color-1.png "Qlik Sense task tree with colors but no task details")

Adding `--tree-details` gives us a tree that's a lot easier to read compared to previous, uncolored version.

```
PS C:\tools\ctrl-q> .\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest screen `
--tree-icons `
--text-color yes `
--tree-details
```

![Qlik Sense task tree 4](docs/task-tree-color-details-1.png "Qlik Sense task tree with task details and colors")

## macOS and Linux

A task tree with colors on macOS and Linux versions of Ctrl-Q looks exactly like same as in Windows Terminal.  
The only difference is that you don't have to install a new command line shell.

# Dry runs are a good idea

Many of Ctrl-Q's commands will create, update or delete things in Sense.  
As long as you have specified the correct parameters that's all good - but there is also the risk of using incorrect parameters or filters, causing too many (or too few or the wrong ones) resources in Sense to be affected.

Most Ctrl-Q commands that change things in Sense have a `--dry-run` option.  
If it is used, Ctrl-Q will not make any changes in Sense, but instead only show what *would* happen.

It's thus a *very* good idea to first do a dry run of the intended command, verify that the correct things would happen and then finally do a real execution of the desired Ctrl-Q command.

Might take a bit of extra time, but better safe than sorry.

# Commands

List available commands, using Windows Terminal/PowerShell:

```
.\ctrl-q.exe help
```

```
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
  task-import [options]                 create tasks based on definitions in a file on disk, optionally also importing apps from QVF files.
  app-import [options]                  import apps/upload QVF files on disk to Sense based on definitions in Excel file.
  help [command]                        display help for command
```

**Note**: All examples below are using PowerShell.  
Adapt as needed for macOS, Linux and NodeJS.

## Bookmarks

### List bookmarks

```
.\ctrl-q.exe bookmark-get `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--output-format table `
--auth-user-dir LAB `
--auth-user-id goran
```

```
2023-02-22T14:55:15.193Z info: -----------------------------------------------------------
2023-02-22T14:55:15.193Z info: | Ctrl-Q
2023-02-22T14:55:15.193Z info: |
2023-02-22T14:55:15.193Z info: | Version      : 3.6.0
2023-02-22T14:55:15.193Z info: | Log level    : info
2023-02-22T14:55:15.193Z info: |
2023-02-22T14:55:15.193Z info: | Command      : bookmark-get
2023-02-22T14:55:15.193Z info: |              : get info about one or more bookmarks
2023-02-22T14:55:15.193Z info: |
2023-02-22T14:55:15.193Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T14:55:15.193Z info: |
2023-02-22T14:55:15.193Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T14:55:15.193Z info: ----------------------------------------------------------
2023-02-22T14:55:15.193Z info:
2023-02-22T14:55:15.207Z info: Get bookmarks
2023-02-22T14:55:16.223Z info: Bookmarks
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Bookmarks (1 bookmark(s) found in the app)                                                                                                                                                                                                                                                               │
├──────────────────────────────────────┬──────────┬───────────┬─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┤
│ Id                                   │ Type     │ Title     │ Description     │ Bookmark definition                                                                                  │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │
├──────────────────────────────────────┼──────────┼───────────┼─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┤
│ 81ec0c0d-c90c-431b-8c19-eff4048de404 │ bookmark │ Bookmark1 │ BM1 description │ {"qStateData":[{"qStateName":"$","qFieldItems":[{"qDef":{"qName":"Dim1","qType":"PRESENT"},"qSelectI │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-07-06T15:09:38.565Z │ 2021-07-06T15:09:38.565Z │ LAB\goran │
│                                      │          │           │                 │ nfo":{"qRangeLo":"NaN","qRangeHi":"NaN","qNumberFormat":{"qType":"U","qnDec":10,"qUseThou":0},"qRang │          │           │                          │                          │                          │           │
│                                      │          │           │                 │ eInfo":[],"qContinuousRangeInfo":[]},"qValues":[],"qExcludedValues":[]}]}],"qUtcModifyTime":44383.71 │          │           │                          │                          │                          │           │
│                                      │          │           │                 │ 498842593,"qVariableItems":[],"qPatches":[]}                                                         │          │           │                          │                          │                          │           │
└──────────────────────────────────────┴──────────┴───────────┴─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┘
```

## Measures

### List measures

```
.\ctrl-q.exe master-item-measure-get `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--output-format table `
--auth-user-dir LAB `
--auth-user-id goran
```

```
2023-02-22T14:55:52.347Z info: -----------------------------------------------------------
2023-02-22T14:55:52.347Z info: | Ctrl-Q
2023-02-22T14:55:52.347Z info: |
2023-02-22T14:55:52.347Z info: | Version      : 3.6.0
2023-02-22T14:55:52.347Z info: | Log level    : info
2023-02-22T14:55:52.347Z info: |
2023-02-22T14:55:52.347Z info: | Command      : master-item-measure-get
2023-02-22T14:55:52.347Z info: |              : get info about one or more master measures
2023-02-22T14:55:52.347Z info: |
2023-02-22T14:55:52.347Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T14:55:52.347Z info: |
2023-02-22T14:55:52.347Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T14:55:52.347Z info: ----------------------------------------------------------
2023-02-22T14:55:52.347Z info:
2023-02-22T14:55:52.347Z info: Get master measures
2023-02-22T14:55:52.909Z info:
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Measures (6 measure(s) found in the app)                                                                                                                                                                                                                                                                                                                                                │
├──────────────────────────────────────┬─────────┬────────────────────────┬───────────────────────────────────────────────────┬──────────────────┬──────────────────┬──────────────────────┬───────────┬───────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┬───────────┤
│ Id                                   │ Type    │ Title                  │ Description                                       │ Label            │ Label expression │ Definition           │ Coloring  │ Number format                         │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │ Tags      │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ 04bf8dc9-a354-41f5-ad57-cb445c725479 │ measure │ Revenue EUR            │ Revenue during selected time period.              │ ='Revenue'       │ ='Revenue'       │ Sum(Revenue)         │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ LAB\goran │ Sales     │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ 81f92d37-b201-4752-9314-33af74a57d94 │ measure │ No. of sold units (LY) │ Number of units sold last year.                   │ ='Sold units LY' │ ='Sold units LY' │ Sum(UnitsInOrder_LY) │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-12T18:24:55.392Z │ LAB\goran │ Sales, LY │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ 2a14160f-2bc9-45d0-86da-3c3c50ab3216 │ measure │ Profit EUR (LY)        │ Profit during last year                           │ ='Profit LY'     │ ='Profit LY'     │ Sum(Profit_LY)       │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:30:45.026Z │ LAB\goran │ Sales, LY │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ 86c518f1-39b9-4e74-9152-add4218464ef │ measure │ Profit EUR             │ Profit during selected time period.               │ ='Profit'        │ ='Profit'        │ Sum(Profit)          │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-13T18:30:45.026Z │ 2022-10-13T18:30:45.026Z │ LAB\goran │ Sales     │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ 874c047f-58e6-406d-8e55-fcf016ca67a0 │ measure │ No. of sold units      │ Number of units sold during selected time period. │ ='Sold units'    │ ='Sold units'    │ =Sum(UnitsInOrder)   │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-11-01T08:04:18.540Z │ 2022-11-01T08:04:18.540Z │ LAB\goran │ Sales     │
├──────────────────────────────────────┼─────────┼────────────────────────┼───────────────────────────────────────────────────┼──────────────────┼──────────────────┼──────────────────────┼───────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼───────────┤
│ b8a8b192-800c-4b02-89c9-999b4c2e37a0 │ measure │ Revenue EUR (LY)       │ Revenue during last year.                         │ ='Revenue LY'    │ ='Revenue LY'    │ Sum(Revenue_LY)      │ undefined │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-11-01T08:04:18.540Z │ 2022-11-01T08:04:18.540Z │ LAB\goran │ Sales, LY │
└──────────────────────────────────────┴─────────┴────────────────────────┴───────────────────────────────────────────────────┴──────────────────┴──────────────────┴──────────────────────┴───────────┴───────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┴───────────┘
```

### Delete measures

```
.\ctrl-q.exe master-item-measure-delete `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--auth-user-dir LAB `
--auth-user-id goran `
--id-type id `
--master-item 04bf8dc9-a354-41f5-ad57-cb445c725479 81f92d37-b201-4752-9314-33af74a57d94
```

```
2023-02-22T22:42:05.584Z info: -----------------------------------------------------------
2023-02-22T22:42:05.600Z info: | Ctrl-Q
2023-02-22T22:42:05.600Z info: |
2023-02-22T22:42:05.600Z info: | Version      : 3.6.0
2023-02-22T22:42:05.600Z info: | Log level    : info
2023-02-22T22:42:05.600Z info: |
2023-02-22T22:42:05.600Z info: | Command      : master-item-measure-delete
2023-02-22T22:42:05.600Z info: |              : delete master measure(s)
2023-02-22T22:42:05.600Z info: |
2023-02-22T22:42:05.600Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T22:42:05.600Z info: |
2023-02-22T22:42:05.600Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T22:42:05.600Z info: ----------------------------------------------------------
2023-02-22T22:42:05.600Z info:
2023-02-22T22:42:05.600Z info: Delete master measures
2023-02-22T22:42:05.975Z info: Deleted master item measure "Profit EUR (LY)", id=2a14160f-2bc9-45d0-86da-3c3c50ab3216 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
2023-02-22T22:42:05.975Z info: Deleted master item measure "Revenue EUR", id=a53aa4ce-6df0-4614-8f2f-e0e2ed5f71cb in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
2023-02-22T22:42:05.975Z info: Deleted master item measure "No. of sold units", id=874c047f-58e6-406d-8e55-fcf016ca67a0 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
```

## Dimensions

### List dimensions

```
.\ctrl-q.exe master-item-dim-get `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--output-format table `
--auth-user-dir LAB `
--auth-user-id goran
```

```
2023-02-22T14:57:13.481Z info: -----------------------------------------------------------
2023-02-22T14:57:13.481Z info: | Ctrl-Q
2023-02-22T14:57:13.481Z info: |
2023-02-22T14:57:13.481Z info: | Version      : 3.6.0
2023-02-22T14:57:13.481Z info: | Log level    : info
2023-02-22T14:57:13.481Z info: |
2023-02-22T14:57:13.481Z info: | Command      : master-item-dim-get
2023-02-22T14:57:13.481Z info: |              : get info about one or more master dimensions
2023-02-22T14:57:13.481Z info: |
2023-02-22T14:57:13.481Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T14:57:13.481Z info: |
2023-02-22T14:57:13.481Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T14:57:13.481Z info: ----------------------------------------------------------
2023-02-22T14:57:13.481Z info:
2023-02-22T14:57:13.481Z info: Get master dimensions
2023-02-22T14:57:13.874Z info:
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dimensions (4 dimension(s) found in the app)                                                                                                                                                                                                                                                                                                                                                                                                     │
├──────────────────────────────────────┬───────────┬─────────────────┬────────────────────────────────┬───────────────────────────────┬────────────────────────┬──────────────────┬──────────────────┬─────────────┬───────────────────────────────────────────────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┬────────────────┤
│ Id                                   │ Type      │ Title           │ Description (static)           │ Description (from expression) │ Description expression │ Label expression │ Definition count │ Definition  │ Coloring                                                                      │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │ Tags           │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼────────────────┤
│ 866fc972-76fb-49c4-bceb-2db959d1d59e │ dimension │ Country         │ Country where a unit was sold. │                               │                        │ ='Country'       │ 1                │ Country     │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-10-12T18:24:55.392Z │ 2022-10-13T18:30:45.026Z │ LAB\goran │ Geo            │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼────────────────┤
│ JDWuPK                               │ dimension │ Dimension 2-3-1 │ Description for 2-3-1          │                               │                        │                  │ 3                │ Dim2        │ {"changeHash":"0.5399463179200534","baseColor":{"color":"#ffffff","index":1}} │ H        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-07T02:31:02.093Z │ 2021-06-07T02:31:02.093Z │ LAB\goran │ My awesome tag │
│                                      │           │                 │                                │                               │                        │                  │                  │ Dim3        │                                                                               │          │          │           │                          │                          │                          │           │                │
│                                      │           │                 │                                │                               │                        │                  │                  │ Dim1        │                                                                               │          │          │           │                          │                          │                          │           │                │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼────────────────┤
│ 66e62cbc-b34d-4de8-89ae-c7ed33f5d478 │ dimension │ Sales month     │ Date in which a unit was sold. │                               │                        │ ='Sales month'   │ 1                │ Month_Sales │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-11-01T08:04:18.540Z │ 2022-11-11T06:44:00.808Z │ LAB\goran │ Sales calendar │
├──────────────────────────────────────┼───────────┼─────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────────────┼──────────────────┼──────────────────┼─────────────┼───────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼────────────────┤
│ f77fb50e-7b18-4076-b956-90d635df2bfa │ dimension │ Salesperson     │ The person who sold the unit.  │                               │                        │ ='Salesperson'   │ 1                │ Salesperson │ undefined                                                                     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2022-11-01T08:04:18.540Z │ 2022-11-11T06:44:00.808Z │ LAB\goran │ Staff, Sales   │
└──────────────────────────────────────┴───────────┴─────────────────┴────────────────────────────────┴───────────────────────────────┴────────────────────────┴──────────────────┴──────────────────┴─────────────┴───────────────────────────────────────────────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┴────────────────┘
```

### Delete dimensions

```powershell
.\ctrl-q.exe master-item-dim-delete `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--auth-user-dir LAB `
--auth-user-id goran `
--id-type id `
--master-item 866fc972-76fb-49c4-bceb-2db959d1d59e 66e62cbc-b34d-4de8-89ae-c7ed33f5d478
```

```
2023-02-22T22:43:12.869Z info: -----------------------------------------------------------
2023-02-22T22:43:12.869Z info: | Ctrl-Q
2023-02-22T22:43:12.869Z info: |
2023-02-22T22:43:12.869Z info: | Version      : 3.6.0
2023-02-22T22:43:12.869Z info: | Log level    : info
2023-02-22T22:43:12.869Z info: |
2023-02-22T22:43:12.869Z info: | Command      : master-item-dim-delete
2023-02-22T22:43:12.869Z info: |              : delete master dimension(s)
2023-02-22T22:43:12.869Z info: |
2023-02-22T22:43:12.869Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T22:43:12.869Z info: |
2023-02-22T22:43:12.869Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T22:43:12.869Z info: ----------------------------------------------------------
2023-02-22T22:43:12.869Z info:
2023-02-22T22:43:12.869Z info: Delete master dimensions
2023-02-22T22:43:13.244Z info: Deleted master item dimension "Salesperson", id=f77fb50e-7b18-4076-b956-90d635df2bfa in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
2023-02-22T22:43:13.244Z info: Deleted master item dimension "Sales month", id=be77c955-6dfc-4db7-9667-c90d2ab404a7 in app "a3e0f5d2-000a-464f-998d-33d333b175d7"
```

## Tasks

### List tasks as tree

This command provides a hierarchical tree view of reload tasks, similar to what is available in QlikView.

The tree view can be enhanced with colours (see [above](#colors--formatting-windows-vs-windows-server-vs-macoslinux)) and task details.

There are quite a few customisation options available when creating a task tree.  
Note that some options are used when creating task tables, these are not applicable for task trees. Ctrl-Q will show an error when invalid combinations of options are used.

Here [Windows Terminal](https://github.com/microsoft/terminal) is used to run Ctrl-Q.
Let's first take a look at the options for the`task-get` command:

```
.\ctrl-q.exe task-get --help
```

```
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
  --task-id <ids...>             use task IDs to select which tasks to retrieve. Only allowed when --output-format=table
  --task-tag <tags...>           use tags to select which tasks to retrieve. Only allowed when --output-format=table
  --output-format <format>       output format (choices: "table", "tree", default: "tree")
  --output-dest <dest>           where to send task info (choices: "screen", "file", default: "screen")
  --output-file-name <name>      file name to store task info in (default: "")
  --output-file-format <format>  file type/format (choices: "excel", "csv", "json", default: "excel")
  --output-file-overwrite        overwrite output file without asking
  --text-color <show>            use colored text in task views (choices: "yes", "no", default: "yes")
  --tree-icons                   display task status icons in tree view
  --tree-details [detail...]     display details for each task in tree view (choices: "taskid", "laststart", "laststop", "nextstart", "appname", "appstream", default: "")
  --table-details [detail...]    which aspects of tasks should be included in table view (choices: "common", "lastexecution", "tag", "customproperty", "schematrigger", "compositetrigger", "comptimeconstraint",
                                 "comprule", default: "")
  -h, --help                     display help for command
```

Note:  
Task trees are currently an all-or-nothing feature.  
It is **not** possible to use the `--task-id` or `--task-tag` options when showing task trees.

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
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest screen `
--tree-icons `
--text-color yes `
--tree-details nextstart appname
```

![Qlik Sense task tree 5](docs/task-tree-color-details-2_65.png "Qlik Sense task tree with task details and colors")

#### Save tree to disk file

Under the hood the task tree is stored as a JSON structure.  
It's possible to save this JSON to disk:

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format tree `
--output-dest file `
--tree-details appname `
--output-file-name tasktree.json `
--output-file-format json
```

```
2023-02-08T17:31:53.682Z info: -----------------------------------------------------------
2023-02-08T17:31:53.682Z info: | Ctrl-Q
2023-02-08T17:31:53.682Z info: |
2023-02-08T17:31:53.682Z info: | Version      : 3.4.1
2023-02-08T17:31:53.682Z info: | Log level    : info
2023-02-08T17:31:53.682Z info: |
2023-02-08T17:31:53.682Z info: | Command      : task-get
2023-02-08T17:31:53.682Z info: |              : get info about one or more tasks
2023-02-08T17:31:53.682Z info: |
2023-02-08T17:31:53.682Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-08T17:31:53.682Z info: |
2023-02-08T17:31:53.682Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-08T17:31:53.682Z info: ----------------------------------------------------------
2023-02-08T17:31:53.682Z info:
2023-02-08T17:31:54.635Z info: ✅ Writing task tree to disk file "tasktree.json".
```

Running the same command again, when the destination file already exists, results in a question to overwrite the file:

```
2023-02-08T17:32:18.108Z info: -----------------------------------------------------------
2023-02-08T17:32:18.124Z info: | Ctrl-Q
2023-02-08T17:32:18.124Z info: |
2023-02-08T17:32:18.124Z info: | Version      : 3.4.1
2023-02-08T17:32:18.124Z info: | Log level    : info
2023-02-08T17:32:18.124Z info: |
2023-02-08T17:32:18.124Z info: | Command      : task-get
2023-02-08T17:32:18.124Z info: |              : get info about one or more tasks
2023-02-08T17:32:18.124Z info: |
2023-02-08T17:32:18.124Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-08T17:32:18.124Z info: |
2023-02-08T17:32:18.124Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-08T17:32:18.124Z info: ----------------------------------------------------------
2023-02-08T17:32:18.124Z info:
2023-02-08T17:32:19.108Z info:
                                  Destination file "tasktree.json" exists. Do you want to overwrite it? (y/n) y
2023-02-08T17:32:19.936Z info:
2023-02-08T17:32:19.936Z info: ✅ Writing task tree to disk file "tasktree.json".
```

To forcibly overwrite the destination file the `--output-file-overwrite` option can be specified.

### List tasks as table

This command provides a tabular view of tasks.  
Tags, custom properties, schedules, triggers and references to other tasks are all included in the table.
This tabular task view can be shown on screen or saved to disk as Excel or CSV files.

The idea is that all information needed to recreate the tasks should be included in the table.  
In reality a few more fields are included, for example app name for the app associated with a task.

The table view can be enhanced with colours (see [above](#colors--formatting-windows-vs-windows-server-vs-macoslinux)) and task details.

There are quite a few customisation options available when creating a task tree.  
Note that some options are used when creating task tables, these are not applicable for task trees. Ctrl-Q will show an error when invalid combinations of options are used.

#### Show task table on screen

Show a list of tasks on screen, including main task fields as well as any tags defined for the tasks.  

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format table `
--output-dest screen `
--table-details common tag
```

Note:  
It's possible to get more information about tasks by adding additional values to the `--table-details` option.  
Run `.\ctrl-q.exe task-get --help` to show a complete list of all options and their allowed values.

If `--table-details` is not specified all available information will be showed about the tasks.  
This will result in a *very* wide table!

```
2023-02-09T13:49:02.127Z info: -----------------------------------------------------------
2023-02-09T13:49:02.127Z info: | Ctrl-Q
2023-02-09T13:49:02.127Z info: |
2023-02-09T13:49:02.127Z info: | Version      : 3.4.1
2023-02-09T13:49:02.127Z info: | Log level    : info
2023-02-09T13:49:02.127Z info: |
2023-02-09T13:49:02.127Z info: | Command      : task-get
2023-02-09T13:49:02.127Z info: |              : get info about one or more tasks
2023-02-09T13:49:02.127Z info: |
2023-02-09T13:49:02.127Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-09T13:49:02.127Z info: |
2023-02-09T13:49:02.127Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-09T13:49:02.127Z info: ----------------------------------------------------------
2023-02-09T13:49:02.127Z info:
2023-02-09T13:49:03.251Z info: # rows in table: 50
2023-02-09T13:49:03.251Z info: # tasks in table: 50
2023-02-09T13:49:03.361Z info:
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ # tasks: 50, # rows in table: 50                                                                                                                                                                                                                                                                                                │
├──────────────┬───────────┬──────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────────────────────────────┬────────────────┬────────────────────┬──────────────────────────────────────────────────────────┤
│ Task counter │ Task type │ Task name                                                                │ Task id                              │ Task enabled │ Task timeout │ Task retries │ App id                               │ Partial reload │ Manually triggered │ Tags                                                     │
├──────────────┼───────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────┼────────────────┼────────────────────┼──────────────────────────────────────────────────────────┤
│ 1            │ Reload    │ Manually triggered reload of Always failing reload (no delay)            │ 0d815a99-1ca3-4131-a398-6878bd735fd8 │ true         │ 1440         │ 0            │ deba4bcf-47e4-472e-97b2-4fe8d6498e11 │ false          │ true               │ api2 / 👍😎 updateSheetThumbnail / Tag with spaces in it │
├──────────────┼───────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────┼────────────────┼────────────────────┼──────────────────────────────────────────────────────────┤
│ 2            │ Reload    │ Manually triggered reload of App1 🏆                                     │ b37f8034-faee-4e9b-bbca-5aba0cdf5df2 │ true         │ 1440         │ 0            │ 26634113-9163-44e4-a879-d87817d6e887 │ false          │ true               │ Butler 5.0 demo                                          │
├──────────────┼───────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────┼────────────────┼────────────────────┼──────────────────────────────────────────────────────────┤
│ 3            │ Reload    │ Manually triggered reload of Butler 7 Slack debug                        │ 77f11a41-af3a-4bca-bf67-725be92a88f6 │ true         │ 1440         │ 0            │ 628ecfe8-b42a-484d-b06e-c6aae36c9923 │ false          │ true               │                                                          │
├──────────────┼───────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────┼────────────────┼────────────────────┼──────────────────────────────────────────────────────────┤
│ 4            │ Reload    │ Manually triggered reload of ButlerTest 1                                │ 244ca6a8-8c20-488d-aed2-504048dd4516 │ true         │ 1440         │ 0            │ c81a6d9a-f07a-47c4-8dbf-b68653e05354 │ false          │ true               │                                                          │
├──────────────┼───────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────────────────────┼────────────────┼────────────────────┼──────────────────────────────────────────────────────────┤
...
...
```

The `--task-id` and `--task-tag` options take a list of task IDs and tags, respectively.  
When used only the tasks matching the specified task IDs and tags will be included in the created table.  
These options can be used both when showing the task table on screen and when storing it on disk.

Example command using these options. Note the quotes around the task tags:

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format table `
--output-dest screen `
--table-details common tag `
--task-id e3b27f50-b1c0-4879-88fc-c7cdd9c1cf3e 09b3c78f-04dd-45e3-a4bf-1b074d6572fa `
--task-tag "Demo apps" "Finance" "Sales forecast"
```

#### Save task to disk file in tabular format

Saving a task table to disk file (Excel and CSV file formats supported) is done via the `task-get` command, adding `--output-format table`, `--output-dest file`, `--output-file-format csv` and `--output-file-name <filename>` options.  
Here the most common task fileds together with task tags are included in the table written to a CSV file:

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format table `
--output-dest file `
--table-details common tag `
--output-file-format csv `
--output-file-name tasktable.csv
```

```
2023-02-09T13:58:06.481Z info: -----------------------------------------------------------
2023-02-09T13:58:06.481Z info: | Ctrl-Q
2023-02-09T13:58:06.481Z info: |
2023-02-09T13:58:06.481Z info: | Version      : 3.4.1
2023-02-09T13:58:06.481Z info: | Log level    : info
2023-02-09T13:58:06.481Z info: |
2023-02-09T13:58:06.481Z info: | Command      : task-get
2023-02-09T13:58:06.481Z info: |              : get info about one or more tasks
2023-02-09T13:58:06.481Z info: |
2023-02-09T13:58:06.481Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-09T13:58:06.481Z info: |
2023-02-09T13:58:06.481Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-09T13:58:06.481Z info: ----------------------------------------------------------
2023-02-09T13:58:06.481Z info:
2023-02-09T13:58:07.528Z info: ✅ Writing task table to disk file "tasktable.csv".
```

#### Save task to disk file as JSON

If task defintions should be read by some other system the task definitions can be saved as JSON.  
Here only the most basic task info included via the `--table-details` option.

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format table `
--output-dest file `
--table-details common `
--output-file-format json `
--output-file-name tasks.json
```

```
2023-02-09T14:07:09.422Z info: -----------------------------------------------------------
2023-02-09T14:07:09.422Z info: | Ctrl-Q
2023-02-09T14:07:09.422Z info: |
2023-02-09T14:07:09.422Z info: | Version      : 3.4.1
2023-02-09T14:07:09.422Z info: | Log level    : info
2023-02-09T14:07:09.422Z info: |
2023-02-09T14:07:09.422Z info: | Command      : task-get
2023-02-09T14:07:09.422Z info: |              : get info about one or more tasks
2023-02-09T14:07:09.422Z info: |
2023-02-09T14:07:09.422Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-09T14:07:09.438Z info: |
2023-02-09T14:07:09.438Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-09T14:07:09.438Z info: ----------------------------------------------------------
2023-02-09T14:07:09.438Z info:
2023-02-09T14:07:10.329Z info: ✅ Writing task table to disk file "tasks.json".
```

The resulting JSON file looks like this:

```json
[
    [
        "Task counter",
        "Task type",
        "Task name",
        "Task id",
        "Task enabled",
        "Task timeout",
        "Task retries",
        "App id",
        "Partial reload",
        "Manually triggered"
    ],
    [
        1,
        "Reload",
        "Manually triggered reload of Always failing reload (no delay)",
        "0d815a99-1ca3-4131-a398-6878bd735fd8",
        true,
        1440,
        0,
        "deba4bcf-47e4-472e-97b2-4fe8d6498e11",
        false,
        true
    ],
    [
        2,
        "Reload",
        "Manually triggered reload of App1 🏆",
        "b37f8034-faee-4e9b-bbca-5aba0cdf5df2",
        true,
        1440,
        0,
        "26634113-9163-44e4-a879-d87817d6e887",
        false,
        true
    ],
...
...
]
```

## Custom properties

### Set custom property of reload task

Setting custom properties of reload tasks can be very time consuming if there are lots of tasks and/or custom propertis.  
Ctrl-Q makes it possible to update many takes at once with a single command.

Note:

1. ONE custom property can be updated each time Ctrl-Q is executed.  
   If several custom properties should be updated Ctrl-Q must be started several times.
2. The custom property to be updated must exist before Ctrl-Q is executed. Create the custom property in the QMC first.
3. The custom property values to be set must exist before Ctrl-Q is executed. Create the custom property in the QMC first.
4. Task IDs and task tags can be useed to specifiy which tasks' custom properties should be updated.
   1. The `--task-id` and `--task-tag` options are additive, i.e. the union of tasks matching the task IDs and tags will be updated.
5. The `--update-mode` option controls how custom properties are updated.
   1. Setting the option to `append` will add the specified values to any other values already set for the custom property.
   2. Setting the option to `replace` will delete any already set values for the custom property and then add the specified values.

In the example below 5 tasks  will be updated: 3 based on task IDs and 2 based on the task tag "apiCreated".  
The values "Finance" and "Sales" will be added to the custom property "Department".  
Existing custom property values are preserver (i.e. the new values are appended to any already existing values).

```
.\ctrl-q.exe task-custom-property-set `
--auth-type cert `
--host 192.168.100.109 `
--auth-cert-file ./cert/client.pem `
--auth-cert-key-file ./cert/client_key.pem `
--auth-user-dir LAB `
--auth-user-id goran `
--task-id 82bc3e66-c899-4e44-b52f-552145da5ee0 5748afa9-3abe-43ab-bb1f-127c48ced075 5520e710-91ad-41d2-aeb6-434cafbf366b `
--custom-property-name Department `
--custom-property-value Finance Sales `
--overwrite `
--update-mode append
```

```
2023-02-22T20:12:07.499Z info: -----------------------------------------------------------
2023-02-22T20:12:07.499Z info: | Ctrl-Q
2023-02-22T20:12:07.499Z info: |
2023-02-22T20:12:07.499Z info: | Version      : 3.6.0
2023-02-22T20:12:07.499Z info: | Log level    : info
2023-02-22T20:12:07.499Z info: |
2023-02-22T20:12:07.499Z info: | Command      : task-custom-property-set
2023-02-22T20:12:07.499Z info: |              : update a custom property of one or more tasks
2023-02-22T20:12:07.499Z info: |
2023-02-22T20:12:07.499Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T20:12:07.499Z info: |
2023-02-22T20:12:07.499Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T20:12:07.515Z info: ----------------------------------------------------------
2023-02-22T20:12:07.515Z info:
2023-02-22T20:12:07.640Z info: Number of tasks that will be updated: 5
2023-02-22T20:12:07.640Z info:
2023-02-22T20:12:07.640Z info: -----------------------------------------------------------
2023-02-22T20:12:07.640Z info: Processing task "Reload of Test data - Seattle checkouts by title3" with ID=82bc3e66-c899-4e44-b52f-552145da5ee0
2023-02-22T20:12:07.640Z info: Starting updating custom property "Department" of task "Reload of Test data - Seattle checkouts by title3" with ID=82bc3e66-c899-4e44-b52f-552145da5ee0
2023-02-22T20:12:07.733Z info:    ...Custom property "Department" on task "Reload of Test data - Seattle checkouts by title3" successfully updated.
2023-02-22T20:12:07.733Z info:
2023-02-22T20:12:07.733Z info: -----------------------------------------------------------
2023-02-22T20:12:07.733Z info: Processing task "Reload task of App ageing" with ID=5217e6b2-65ce-4535-ad2a-37b62e66d12c
2023-02-22T20:12:07.733Z info: Starting updating custom property "Department" of task "Reload task of App ageing" with ID=5217e6b2-65ce-4535-ad2a-37b62e66d12c
2023-02-22T20:12:07.906Z info:    ...Custom property "Department" on task "Reload task of App ageing" successfully updated.
2023-02-22T20:12:07.906Z info:
2023-02-22T20:12:07.906Z info: -----------------------------------------------------------
2023-02-22T20:12:07.906Z info: Processing task "Reload of Test data - Seattle library checkouts & collection inventory" with ID=5520e710-91ad-41d2-aeb6-434cafbf366b
2023-02-22T20:12:07.906Z info: Starting updating custom property "Department" of task "Reload of Test data - Seattle library checkouts & collection inventory" with ID=5520e710-91ad-41d2-aeb6-434cafbf366b
2023-02-22T20:12:07.999Z info:    ...Custom property "Department" on task "Reload of Test data - Seattle library checkouts & collection inventory" successfully updated.
2023-02-22T20:12:07.999Z info:
2023-02-22T20:12:07.999Z info: -----------------------------------------------------------
2023-02-22T20:12:07.999Z info: Processing task "Reload task of Lab 1_1" with ID=5748afa9-3abe-43ab-bb1f-127c48ced075
2023-02-22T20:12:07.999Z info: Starting updating custom property "Department" of task "Reload task of Lab 1_1" with ID=5748afa9-3abe-43ab-bb1f-127c48ced075
2023-02-22T20:12:08.093Z info:    ...Custom property "Department" on task "Reload task of Lab 1_1" successfully updated.
2023-02-22T20:12:08.093Z info:
2023-02-22T20:12:08.093Z info: -----------------------------------------------------------
2023-02-22T20:12:08.093Z info: Processing task "Reload Operations Monitor" with ID=fbf645f0-0c92-40a4-af9a-6e3eb1d3c35c
2023-02-22T20:12:08.093Z info: Starting updating custom property "Department" of task "Reload Operations Monitor" with ID=fbf645f0-0c92-40a4-af9a-6e3eb1d3c35c
2023-02-22T20:12:08.187Z info:    ...Custom property "Department" on task "Reload Operations Monitor" successfully updated.
```

## Import

### Import master items from Excel file

This command imports dimensions and measures into master items in a Sense app.

First let's take a look at the command options:

```
.\ctrl-q.exe master-item-import --help
```

```
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
```

There are several options that allow for a great deal of flexibility.  
For example, the `--col-ref-by` option determines whether the `--col-master-item-...` options refer to columns by position or name. 
Column names will in most cases be easier to read and understand, but sometimes a zero-based column position might be preferred.

Similarly those `--col-master-item-...` options let you use your own column names in the source file.

Note: 

- The (intentional) warning for the incorrectly spelled master item type "measur" (which should have been "measure", of course).
- Master items are referred to by name. This means that if a master item in the source file already exists in the target Sense app, the app's master item will be updated.
- If a master does not exist in the target app the master item will be created.

Now let's run the command.  

```
.\ctrl-q.exe master-item-import `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--auth-user-dir LAB `
--auth-user-id goran `
--auth-type cert `
--file-type excel `
--file ./ctrl-q-master-items.xlsx `
--sheet Sales `
--col-ref-by name `
--col-item-type "Master item type" `
--col-master-item-name "Master Item Name" `
--col-master-item-descr Description `
--col-master-item-label Label `
--col-master-item-expr Expression `
--col-master-item-tag Tag
```

```
2023-02-22T20:16:28.161Z info: -----------------------------------------------------------
2023-02-22T20:16:28.161Z info: | Ctrl-Q
2023-02-22T20:16:28.161Z info: |
2023-02-22T20:16:28.161Z info: | Version      : 3.6.0
2023-02-22T20:16:28.161Z info: | Log level    : info
2023-02-22T20:16:28.161Z info: |
2023-02-22T20:16:28.161Z info: | Command      : master-item-import
2023-02-22T20:16:28.161Z info: |              : create master items based on definitions in a file on disk
2023-02-22T20:16:28.161Z info: |
2023-02-22T20:16:28.161Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T20:16:28.161Z info: |
2023-02-22T20:16:28.161Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T20:16:28.161Z info: ----------------------------------------------------------
2023-02-22T20:16:28.161Z info:
2023-02-22T20:16:28.161Z info: Import master items from definitions in Excel file "./ctrl-q-master-items.xlsx"
2023-02-22T20:16:28.568Z info: Updated existing measure "No. of sold units"
2023-02-22T20:16:28.583Z info: Updated existing measure "No. of sold units (LY)"
2023-02-22T20:16:28.583Z info: Updated existing measure "Revenue EUR"
2023-02-22T20:16:28.583Z info: Updated existing measure "Revenue EUR (LY)"
2023-02-22T20:16:28.583Z info: Updated existing measure "Profit EUR"
2023-02-22T20:16:28.583Z warn: Found an unknown master item type: "measur". Ignoring this line in the imported file.
2023-02-22T20:16:28.598Z info: Updated existing measure "Profit EUR (LY)"
2023-02-22T20:16:28.598Z info: Updated existing dimension "Country"
2023-02-22T20:16:28.598Z info: Updated existing dimension "Sales month"
2023-02-22T20:16:28.598Z info: Updated existing dimension "Salesperson"
```

### Import apps from QVF files

.QVF files are Sense apps stored on disk.  
Ctrl-Q's `app-import` command does bulk import of such QVF files, as well as setting tags and custom properties on the created apps.

Importing apps defined on the `App import` sheet of the `tasks.xlsx` Excel file can be done with a command like this:

```powershell
.\ctrl-q.exe app-import `
--auth-type cert `
--host 192.168.100.109 `
--auth-cert-file ./cert/client.pem `
--auth-cert-key-file ./cert/client_key.pem `
--auth-user-dir LAB `
--auth-user-id goran `
--file-name tasks.xlsx `
--sheet-name "App import"
```

```
2023-03-10T08:41:43.520Z info: -----------------------------------------------------------
2023-03-10T08:41:43.520Z info: | Ctrl-Q
2023-03-10T08:41:43.520Z info: |
2023-03-10T08:41:43.520Z info: | Version      : 3.6.0
2023-03-10T08:41:43.520Z info: | Log level    : info
2023-03-10T08:41:43.520Z info: |
2023-03-10T08:41:43.520Z info: | Command      : app-import
2023-03-10T08:41:43.520Z info: |              : import apps/upload QVF files on disk to Sense based on definitions in Excel file.
2023-03-10T08:41:43.520Z info: |
2023-03-10T08:41:43.520Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-03-10T08:41:43.520Z info: |
2023-03-10T08:41:43.520Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-03-10T08:41:43.520Z info: ----------------------------------------------------------
2023-03-10T08:41:43.520Z info:
2023-03-10T08:41:43.536Z info: Import apps from definitions in file "tasks.xlsx"
2023-03-10T08:41:43.614Z info: Importing app "App 1" from file "C:/tools/ctrl-q/testdata/App import 1.qvf"
2023-03-10T08:41:44.926Z info: Importing app "App 2" from file "C:/tools/ctrl-q/testdata/App import 2.qvf"
2023-03-10T08:41:46.177Z info: Importing app "App 3" from file "C:/tools/ctrl-q/testdata/App import 3.qvf"
```

The QMC now shows three new apps:

![Sense apps imported from QVF files](docs/ctrl-q-app-import-2.png "Sense apps imported from QVF files")

The Excel file with definitions on what QVF files should be imported, what the apps should be named etc looks like this:

![QVF app files that should be imported into Qlik Sense](docs/ctrl-q-app-import-1.png "QVF app files that should be imported into Qlik Sense")

An explanation of each column is available [here](#defining-apps-to-be-imported).

### Import reload tasks from file

Task definitions can be read from CSV or Excel files.  
The options are as follows:

```
.\ctrl-q.exe task-import --help
```

```
Usage: ctrl-q task-import [options]

create tasks based on definitions in a file on disk

Options:
  --log-level <level>            log level (choices: "error", "warn", "info", "verbose", "debug", "silly", default: "info")
  --host <host>                  Qlik Sense server IP/FQDN
  --port <port>                  Qlik Sense server engine port (default: "4242")
  --schema-version <string>      Qlik Sense engine schema version (default: "12.612.0")
  --virtual-proxy <prefix>       Qlik Sense virtual proxy prefix (default: "")
  --secure <true|false>          connection to Qlik Sense engine is via https (default: true)
  --auth-user-dir <directory>    user directory for user to connect with
  --auth-user-id <userid>        user ID for user to connect with
  -a, --auth-type <type>         authentication type (choices: "cert", default: "cert")
  --auth-cert-file <file>        Qlik Sense certificate file (exported from QMC) (default: "./cert/client.pem")
  --auth-cert-key-file <file>    Qlik Sense certificate key file (exported from QMC) (default: "./cert/client_key.pem")
  --auth-root-cert-file <file>   Qlik Sense root certificate file (exported from QMC) (default: "./cert/root.pem")
  -t, --file-type <type>         source file type (choices: "excel", "csv", default: "excel")
  --file-name <filename>         file containing task definitions
  --sheet-name <name>            name of Excel sheet where task info is found
  --update-mode <mode>           create new or update existing tasks (choices: "create", default: "create")
  --limit-import-count <number>  import at most x number of tasks from the source file. Defaults to 0 = no limit (default: 0)
  --dry-run                      do a dry run, i.e. do not create any reload tasks - just show what would be done
  -h, --help                     display help for command
```

The options are *almost* the same irrespective of source file type:

The `--sheet-name` is only used/valid/relevant when `--file-type` is set to `excel`.  
Why? Because there are no sheets/tabs in CSV files.

#### Source file columns for task defintions

The source file format is quite relaxed, but a few rules apply:

- The first column in the source file *must* be the task number. This value uniquely identifies each task that should be imported and should be incremented by one for each task.
- All other columns, mandatory and optional, beyond the first one may be placed in any order.
  - For mandatory columns the names listed below *must* be used (but they can be placed in any order in the file, except the first column).
  - All mandatory columns must be present in the source file, even if they are not used/empty.
    For example, a task may not have a scheduled trigger, but the schema trigger columns must still be present in the source file.
- "Counter" columns are used to keep together lines that are associated.
  - All lines involved in defining a certain task have the same "Task counter" value.
  - All lines involved in defining a certain schema or composite event have the same "Event counter" value.
  - All lines involved in defining a certain composite event rule have the same "Rule counter" value.
- The file format used when *exporting* task tables to disk is a superset of the format used for task *import*.
  It's thus a good idea to first do a task export, look at the file format and then adopt as needed before importing.

The *mandatory* columns in the task definition file are:

| Column name                  | Comment | Description | Valid values |
|------------------------------|-----------|-------------|------|
| Task counter                 | 1 | Counter starting at 1. Increments one step for each task. All rows associated with a specific task should have the same value in this column. | Integer > 0 |
| Task type                    | 1 | Type of task. In the future Ctrl-Q may support more task types. | Reload |
| Task name                    | 1 | Name of the task that will be created. | Any string. Emojis allowed. |
| Task id                      | 1 | When creating new tasks a new task ID will always be created. This column is instead used to create task chains: it links a composite trigger in a downstream task with an upstream task via this column's value. | Any string, but to make it easier to verify task chains it's recommended to use integers in this column. |
| Task enabled                 | 1 | Should the created task be enabled or not. | 1 / 0 / blank. 1=enabled, 0 or blank=disabled |
| Task timeout                 | 1 | Timeout for the created task, i.e. number of seconds the task is allowed to run before it's aborted. | Seconds |
| Task retries                 | 1 | Number of retries to make if the task execution fails. | Integer >= 0 |
| App id                       | 1 | The Sense app the task should be associated with. | If a valid GUID is specified it's assumed to be an app id. The task will be associated with that app. If the app id starts with `newapp-` it is a reference to an app that is imported during the current Ctrl-Q execution. The integer following `newapp-` is the value in the `App counter` column in the Excel definitions file. |
| Partial reload               | 1 | Should the task do a partial or full reload of the app? | 1 / 0 / blank. 1=true, 0 or blank=false |
| Manually triggered           | 1 | Is the task manually triggered or not? | 1 / 0 / blank. 1=true, 0 or blank=false |
| Tags                         | 1 | Tags to set on the created task. | Format is "tag1 / tag2 / tag with spaces in it", i.e. separate tag names by "space-forward slash-space". |
| Custom properties            | 1 | Custom properties to set on the created task. | Format is CustPropName1=Value1 / CustPropName2=Value2 |
| Event counter                | 2 | Counter identifying events associated with the task defined in the previous line. One task can have zero or more events associated with it. | Integer > 0     |
| Event type                   | 2 | Which event type does this line specify? Schema events deal with time-based execution of the task. Composite events are used to build task chains. | Schema / Composite |
| Event name                   | 2 | Name of the event. | Any string |
| Event enabled                | 2 | Is event enabled. | 1 / 0 / blank. 1=enabled, 0 or blank=disabled |
| Schema increment option      | 3 | Type of schema event. For reference only, not used when Sense evaluates schema events (or??). | once / hourly / daily / weekly / monthly / custom |
| Schema increment description | 3 | Structured description of the schema increment option. For reference only, not used when Sense evaluates schema events (or??). | Integers separated by space, e.g. "0 0 1 0" for weekly |
| Daylight savings time        | 3 | Control how the schema event should deal with dayligt savings time. | ObserveDaylightSavingTime / PermanentStandardTime / PermanentDaylightSavingTime |
| Schema start                 | 3 | First valid time for the schema event. The event will not fire before this moment. | A valid timestamp string, e.g. 2022-10-19T10:19:30.000 |
| Schema expiration            | 3 | Last valid time for the schema event. The event will not fire after this moment. | A valid timestamp string or 9999-01-01T00:00:00.000 to signify "never" |
| Schema filter description    | 3 | Used to control when a schema event is allower to trigger. More info [here](https://community.qlik.com/t5/Integration-Extension-APIs/Interval-and-time-explanation-for-creating-a-new-SchemaEvent/m-p/1784892/highlight/true#M13886). | Default: "* * - * * * *" |
| Schema time zone             | 3 | Time zone the schema event is evaluated in | E.g. "Europe/Paris" |
| Time contstraint seconds     | 4 | Used for composite events. Defines a window in which all dependent tasks have to complete. | Integer >= 0 |
| Time contstraint minutes     | 4 | Used for composite events. Defines a window in which all dependent tasks have to complete. | Integer >= 0 |
| Time contstraint hours       | 4 | Used for composite events. Defines a window in which all dependent tasks have to complete. | Integer >= 0 |
| Time contstraint days        | 4 | Used for composite events. Defines a window in which all dependent tasks have to complete. | Integer >= 0 |
| Rule counter                 | 4 | Counter identifying rules that define upstream task executions the current task is depending on. | Integer > 0 |
| Rule state                   | 4 | Is the rule waiting for success or failure of upstream task? | TaskSuccessful / TaskFail |
| Rule task name               |   | Name of the rule | Any string |
| Rule task id                 | 4 | Reference to the upstream task. Two options exist: If the "Rule task id" has the same value as the "Task id" of another task in the source file, those two tasks will be linked via this rule. If the "Rule task id" refers to an existing task id in Sense, the new rule will link to that existing task. | Any string (if referring to a task within the same file), **or** a valid id of a task that already exists in Sense. |

Meaning of "Comment" column above:

1: These columns are required for all lines where top-level task information is defined.  
2: These columns are required for all lines where general event info (shared for schema and composite events) is defined. There may be zero or more such lines for a specific task.  
3: These columns are required for all lines where schema events info are defined.  
4: These columns are required for all lines where composite events ("task chains") are defined.  

#### Source file columns for app import definitions

If apps should be imported (by means of the `--import-app` option) an Excel file must be provided with info about what app QVF files should be imported, as well as details about each app import.  
A sheet name (where the app details are found) in the Excel file must also be specified using the `--import-app-sheet-name` option.

The mandatory columns (case sensitive!) in the app import definition file are:

| Column name                  | Comment | Description | Valid values |
|------------------------------|-----------|-------------|------|
| App counter                  |   | Counter starting at 1. Increments one step for each app. | Integer > 0 |
| App name                     |   | Name of the app that will be created based on the specified QVF file. | Any string. Emojis allowed. |
| QVF directory                |   | Directory where app QVF files are stored | Any valid path, absolute or relative. |
| QVF name                     |   | Name of QVD file, including extension. | Any valid file name. |
| Exclude data connections     |   | Should data connections stored in the QVF file be excluded during app import or not. | true / false |
| App tags                     |   | Tags to set on the imported app. | Format is "tag1 / tag2 / tag with spaces in it", i.e. separate tag names by "space-forward slash-space". |
| App custom properties        |   | Custom properties to set on the imported app. | Format is CustPropName1=Value1 / CustPropName2=Value2 |

#### Example: Export tasks to CSV, then import tasks from same CSV

This example will

1. Export ca 50 tasks to a CSV file
2. Import tasks from the just created CSV file

The CSV file created during the task export will contain some columns that are not needed during task import (last execution timestamp for each task and similar).  
That's fine though, during the task import Ctrl-Q will only look at the required columns and simply disregard all other columns.

Export tasks to CSV file:

```
.\ctrl-q.exe task-get `
--auth-type cert `
--host 192.168.100.109 `
--auth-user-dir LAB `
--auth-user-id goran `
--output-format table `
--output-dest file `
--output-file-name tasks.csv `
--output-file-format csv
```

```
2023-02-22T22:36:37.148Z info: -----------------------------------------------------------
2023-02-22T22:36:37.151Z info: | Ctrl-Q
2023-02-22T22:36:37.151Z info: | 
2023-02-22T22:36:37.151Z info: | Version      : 3.6.0
2023-02-22T22:36:37.151Z info: | Log level    : info
2023-02-22T22:36:37.151Z info: | 
2023-02-22T22:36:37.152Z info: | Command      : task-get
2023-02-22T22:36:37.152Z info: |              : get info about one or more tasks
2023-02-22T22:36:37.152Z info: | 
2023-02-22T22:36:37.153Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T22:36:37.153Z info: | 
2023-02-22T22:36:37.153Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T22:36:37.154Z info: ----------------------------------------------------------
2023-02-22T22:36:37.154Z info: 
2023-02-22T22:36:40.149Z info: ✅ Writing task table to disk file "tasks.csv".
```

Now let's import tasks from the `tasks.csv` file:

```
.\ctrl-q.exe task-import `
--auth-type cert `
--host 192.168.100.109 `
--auth-cert-file ./cert/client.pem `
--auth-cert-key-file ./cert/client_key.pem `
--auth-user-dir LAB `
--auth-user-id goran `
--file-type csv `
--file-name tasks.csv
```

It's worth noting that all the created tasks will be linked into the task chains that existed when the tasks where first *exported* into the CSV file.  
This happens because the composite event rules that were exported into the CSV file (i.e. "start the task when task A and task B have successfully finished reloaded") contain task IDs that point to already existing reload tasks in Sense.  
When that's the case the newly created tasks (based on the info in the CSV file) will link to those existing tasks.

This way a newly created task (based on info in the CSV file) can still be configured to start after some already existing task finish reloading.

```
2023-02-22T22:38:42.265Z info: -----------------------------------------------------------
2023-02-22T22:38:42.268Z info: | Ctrl-Q
2023-02-22T22:38:42.268Z info: | 
2023-02-22T22:38:42.268Z info: | Version      : 3.6.0
2023-02-22T22:38:42.268Z info: | Log level    : info
2023-02-22T22:38:42.269Z info: | 
2023-02-22T22:38:42.269Z info: | Command      : task-import
2023-02-22T22:38:42.269Z info: |              : create tasks based on definitions in a file on disk, optionally also importing apps from QVF files.
2023-02-22T22:38:42.269Z info: | 
2023-02-22T22:38:42.270Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T22:38:42.270Z info: | 
2023-02-22T22:38:42.270Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T22:38:42.271Z info: ----------------------------------------------------------
2023-02-22T22:38:42.271Z info: 
2023-02-22T22:38:42.275Z info: Import tasks from definitions in file "tasks.csv"
2023-02-22T22:38:42.668Z info: CREATE RELOAD TASK IN QSEOW: "Manually triggered reload of Always failing reload (no delay)", new task id: 9f04388c-4cbf-4c67-aef7-39ac7bde57ac. Result: 201/Created.
2023-02-22T22:38:42.836Z info: CREATE RELOAD TASK IN QSEOW: "Manually triggered reload of App1 🏆", new task id: 551abbd3-dee9-430b-97b4-b357e553829e. Result: 201/Created.
2023-02-22T22:38:42.931Z info: CREATE RELOAD TASK IN QSEOW: "Manually triggered reload of Butler 7 Slack debug", new task id: 2f5619dc-988f-4660-8e59-34f54edc2a7a. Result: 201/Created.
2023-02-22T22:38:43.039Z info: CREATE RELOAD TASK IN QSEOW: "Manually triggered reload of ButlerTest 1", new task id: baea8b70-9e20-48d9-b08f-ff99b7d4e243. Result: 201/Created.
...
...
2023-02-22T22:38:49.288Z info: -------------------------------------------------------------------
2023-02-22T22:38:49.289Z info: Creating composite events for the just created tasks...
2023-02-22T22:38:49.345Z info: CREATE COMPOSITE EVENT IN QSEOW: Event name="App2_composite_1" for task ID baea8b70-9e20-48d9-b08f-ff99b7d4e243. Result: 201/Created.
2023-02-22T22:38:49.400Z info: CREATE COMPOSITE EVENT IN QSEOW: Event name="When HR metrics done" for task ID ac986964-a938-47c4-935e-4f0866e435ca. Result: 201/Created.
2023-02-22T22:38:49.464Z info: CREATE COMPOSITE EVENT IN QSEOW: Event name="When Operations monitor has reloaded" for task ID 15f2a083-314f-4b09-b6a2-54775a03720d. Result: 201/Created.
...
...
```

#### Example: Import tasks from Excel file with chaining of new tasks

This example will

1. Import tasks from an Excel file, associating the tasks with existing Sense apps.
2. Create a task chain consisting of the newly imported tasks.
3. Some imported tasks will be triggered by already existing Sense tasks.

```powershell

```

#### Example: Import apps from QVF files and create associated reload tasks

This example will

1. Import 3 apps from QVF files. Definitions of which files to import are stored in an Excel file.
2. Set tags and custom properties for the imported apps.
3. Create reload tasks based on definitions in same Excel file (but on a different sheet).
4. The reload tasks will be associated with the previously imported apps.
5. The reload tasks will be linked in a task chain.

The task import command looks like this in PowerShell:

```powershell
.\ctrl-q.exe task-import `
--auth-type cert `
--host 192.168.100.109 `
--auth-cert-file ./cert/client.pem `
--auth-cert-key-file ./cert/client_key.pem `
--auth-user-dir LAB `
--auth-user-id goran `
--file-type excel `
--file-name tasks.xlsx `
--sheet-name "Ctrl-Q task import 2" `
--import-app `
--import-app-sheet-name "App import"
```

Some comments about the above command:

- The certificates used to authenticate with Sense are stored in the `cert` subdirectory, right under where Ctrl-Q is started from. That's actually the default locataion, meaning that the options `--auth-cert-file` and `--auth-cert-key-file` are not needed in this case.
- The app and task definitions are found in a Excel file (`--file-type` option) named `tasks.xlsx`.
- Task definitions are found in the Excel file's sheet named `Ctrl-Q task import`. 
- The `--import-app` tells Ctrl-Q to import certain apps before tasks defined in the `Ctrl-Q task import` sheet are created. This parameter is optional. If it is **not** included no apps will be imported.
- The `--import-app-sheet-name` tells Ctrl-Q that a list of apps to be imported (and import parameters for each app) is found the `App import` sheet of the Excel file.

##### Defining apps to be imported

The Excel sheet specified by the `--import-app-sheet-name` has the following *mandatory* columns:

| Column name              | Comment | Description | Valid values |
|--------------------------|-----------|-------------|------|
| App counter              |  | Counter starting at 1. Increments one step for each app. All rows associated with a specific app should have the same value in this column. | Integer > 0 |
| App name                 |  | Name that the imported app should be given. | Any string. Emojis allowed. |
| QVF directory            |  | Directory where the app QVF file is stored. | A valid relative or absolut path. |
| QVF name                 |  | Name of app QVF file | File name, including extension. |
| Exclude data connections |  | Should data connections stored in the QVF file be imported? | true/false. `true`= don't import data connections. |
| App tags                 |  | Tags to set on the imported app. | Format is "tag1 / tag2 / tag with spaces in it", i.e. separate tag names by "space-forward slash-space". |
| App custom properties    |  | Custom properties to set on the created task. | Format is CustPropName1=Value1 / CustPropName2=Value2 |

##### Defining tasks to be created

The format is the same as when importing tasks only (and no apps).  
More info [here](#source-file-columns-for-task-defintions).

##### Associating new tasks with imported and existing apps

A few special cases apply when tasks are created **and** apps also imported.

In this situation it's important that tasks can be associated with either the newly imported apps *or* already existing apps.  
Similarly, for composite task triggers (used to create task chains) it's important that either newly created tasks *or* already existing tasks can be referenced.  

Let's say the following three QVF files should be imported into Sense.  
Note the `App counter` column, with values 1, 2 and 3.

![QVF app files that should be imported into Qlik Sense](docs/ctrl-q-app-import-1.png "QVF app files that should be imported into Qlik Sense")

Now let's look at the tasks to be created.
In the image below the main info (task name etc) for each of the four tasks is shown.  
Note that the `Task id` column has both proper GUIDs and simple integers in it.  
This will be important when defining composite triggers.

![Reload tasks should be created in Qlik Sense](docs/ctrl-q-task-import-1.png "Reload tasks should be created in Qlik Sense")

Finally let's look at the composite triggers associated with the last of the four tasks.  
That composite trigger relies on two tasks, one that should fail (`TaskFail`) to trigger the composite trigger and one that should succeed (`TaskSuccessful`).

The important part here is the last column, `Rule task id`:

- If that column contains a valid GUID it is assumed to be a reference to an *existing* task.
- If the column contains an integer it is assumed to be a reference to a *newly created* task. <br>
  Which task? The one with the same integer number in the `Task id` column (see previous paragraph).

This way it's possible to chain new reload tasks to both already existing tasks and new ones.

![Reload tasks should be created in Qlik Sense](docs/ctrl-q-task-import-2.png "Reload tasks should be created in Qlik Sense")

## Scramble fields in Sense app

Scramble one or more fields in an app using Qlik Sense's internal scrambling feature.  

Note:  

- If more than one field is to be scrambled, the indidivudal field names should be separated by the character or string specified in the `--separator` option.
- The entire list of field names (the `--fieldname` option) should be surrounded by double quotes.
- A new app with the scrambled data will be created. Specify its name in the `--newappname` option.
  

```
.\ctrl-q.exe field-scramble `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--auth-user-dir LAB `
--auth-user-id goran `
--field-name Expression1 Dim1 AsciiAlpha `
--new-app-name __ScrambledTest1
```

```
2023-02-22T15:44:52.667Z info: -----------------------------------------------------------
2023-02-22T15:44:52.667Z info: | Ctrl-Q
2023-02-22T15:44:52.667Z info: |
2023-02-22T15:44:52.667Z info: | Version      : 3.6.0
2023-02-22T15:44:52.667Z info: | Log level    : info
2023-02-22T15:44:52.667Z info: |
2023-02-22T15:44:52.667Z info: | Command      : field-scramble
2023-02-22T15:44:52.667Z info: |              : scramble one or more fields in an app. A new app with the scrambled data is created.
2023-02-22T15:44:52.667Z info: |
2023-02-22T15:44:52.667Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T15:44:52.667Z info: |
2023-02-22T15:44:52.667Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T15:44:52.667Z info: ----------------------------------------------------------
2023-02-22T15:44:52.667Z info:
2023-02-22T15:44:52.667Z info: Scramble field
2023-02-22T15:44:53.043Z info: Scrambled field "Expression1"
2023-02-22T15:44:53.058Z info: Scrambled field "Dim1"
2023-02-22T15:44:53.058Z info: Scrambled field "AsciiAlpha"
2023-02-22T15:44:53.574Z info: Scrambled data written to new app "__ScrambledTest1" with app ID: cec487a0-9b96-4c84-bea7-dd286ed52f87
```

## Get script

Get script and associated metadata for a Sense app.

```
.\ctrl-q.exe script-get `
--host 192.168.100.109 `
--app-id a3e0f5d2-000a-464f-998d-33d333b175d7 `
--auth-user-dir LAB `
--auth-user-id goran
```

```
2023-02-22T15:44:17.122Z info: -----------------------------------------------------------
2023-02-22T15:44:17.137Z info: | Ctrl-Q
2023-02-22T15:44:17.137Z info: |
2023-02-22T15:44:17.137Z info: | Version      : 3.6.0
2023-02-22T15:44:17.137Z info: | Log level    : info
2023-02-22T15:44:17.137Z info: |
2023-02-22T15:44:17.137Z info: | Command      : script-get
2023-02-22T15:44:17.137Z info: |              : get script from Qlik Sense app
2023-02-22T15:44:17.137Z info: |
2023-02-22T15:44:17.137Z info: | Run Ctrl-Q with the '--help' option to see a list of all available options for this command.
2023-02-22T15:44:17.137Z info: |
2023-02-22T15:44:17.137Z info: | https://github.com/ptarmiganlabs/ctrl-q
2023-02-22T15:44:17.137Z info: ----------------------------------------------------------
2023-02-22T15:44:17.137Z info:
2023-02-22T15:44:17.543Z info: ----- Script metadata -----
2023-02-22T15:44:17.543Z info: App id: a3e0f5d2-000a-464f-998d-33d333b175d7
2023-02-22T15:44:17.543Z info: Created date: 2021-06-03T22:04:52.283Z
2023-02-22T15:44:17.543Z info: Modified date: 2021-06-04T15:42:23.759Z
2023-02-22T15:44:17.543Z info: ----- End script metadata -----
2023-02-22T15:44:17.543Z info:
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
```
