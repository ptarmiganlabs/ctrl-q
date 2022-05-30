# Ctrl-Q

Ctrl-Q is a cross platform, command line tool for interacting with client-managed Qlik Sense Enterprise on Windows.  
Ctrl-Q is open source with a permissive MIT license.

The tool is designed to be easily extensible if/when additional features are needed.

Focus is on slightly more complex use cases that are not handled out of the box by other tools such as [Qlik's official Qlik CLI tool](https://qlik.dev/libraries-and-tools/qlik-cli) or Adam Haydon's [Qlik CLI Windows](https://github.com/ahaydon/Qlik-Cli-Windows) tool.  
Both are exceptional tools and extremely useful, but especially when it comes to interactions with the Qlik Sense engine they fall a bit short.

Ctrl-Q also tries to fill niches that are not covered by the various members of the Butler family of open source SenseOps tools.

The Butler tools each focus on a specific feature (or features in the case of [the original Butler tool](https://github.com/ptarmiganlabs/butler)) and goes fairly deep in those areas.  
For example, [Butler SOS](https://github.com/ptarmiganlabs/butler-sos) focus on getting real-time metrics and events out of Sense and into a wide range of target databases and monitoring tools.  
Butler Sheet Icons creates sheet thumbnails for Sense apps - but offers lots of flexibility and power around that use case.

Ctrl-Q instead focus on specific, high-value uses cases that tend to be vary time consuming to do manually.  

Automated creation of master items is an example.  
Manually creating hundreds of master items can take hours or days.  
Having the definitions in an Excel file and then using Ctrl-Q shorten that time to minutes - at least once that Excel file has been created.  
A bonus is that the process can be included in CI/CD pipelines, with increased reusability and app quality as a result.

Maybe Qlik's CLI tool will evolve to include more of these use cases and engine-focused features too - great if so.  
Until then Ctrl-Q can hopefully make life a bit easier for Sense developers and admins out there.

Enjoy!

## Contents

- [Ctrl-Q](#ctrl-q)
  - [Contents](#contents)
  - [Getting started](#getting-started)
  - [Logging](#logging)
  - [Commands](#commands)
  - [Commands](#commands-1)
    - [Bookmarks](#bookmarks)
      - [List bookmarks](#list-bookmarks)
    - [Measures](#measures)
      - [List measures](#list-measures)
      - [Delete measures](#delete-measures)
    - [Dimensions](#dimensions)
    - [Import](#import)
    - [Scramble](#scramble)
    - [Get script](#get-script)

## Getting started

There is no need to install Ctrl-Q. Just download and run.  
The GitHub [release page](https://github.com/ptarmiganlabs/ctrl-q/releases) has ready-to-run binaries for Windows and macOS

The macOS binary is security scanned and signed by Apple, using their standard notarization process.  
This means you won't get those annoying warnings when using the app.

## Logging

Logging is controlled by the --loglevel option.

Valid values are (in order of increasing verbosity): error, warning, info, verbose, debug, silly.

Note: When using log level silly all websocket communication to/from the Sense server will be logged to the console. This means *lots* of log output.

## Commands

List available commands using the --help option:

```bash
➜  tools ./ctrl-q --help
Usage: ctrl-q [options] [command]

Ctrl-Q is a command line utility for interacting with client-managed Qlik Sense Enterprise on Windows servers.
Among other things the tool manipulates master items and scrambles in-app data.

Options:
  -V, --version                         output the version number
  -h, --help                            display help for command

Commands:
  master-item-import [options]          create master items based on definitions in an file on disk
  master-item-measure-get [options]     get info about one or more master measures
  master-item-measure-delete [options]  delete master measure(s)
  master-item-dim-get [options]         get info about one or more master dimensions
  master-item-dim-delete [options]      delete master dimension(s)
  field-scramble [options]              scramble one or more fields in an app. A new app with the scrambled data is created.
  script-get [options]                  get script from Qlik Sense app
  bookmark-get [options]                get info about one or more bookmarks
  help [command]                        display help for command
➜  tools
```

## Commands

### Bookmarks

#### List bookmarks

```bash
➜  tools ./ctrl-q-cli bookmark-get --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --output-format table --userdir LAB --userid goran --loglevel info --certfile ~/code/secret/pro2win1-nopwd/client.pem --certkeyfile ~/code/secret/pro2win1-nopwd/client_key.pem
2022-05-28T15:26:06.463Z info: Get bookmarks
2022-05-28T15:26:06.825Z info: Bookmarks
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                                 Bookmarks (1 bookmarks found in the app)                                                                                                                                 │
├──────────────────────────────────────┬──────────┬───────────┬─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┤
│ Id                                   │ Type     │ Title     │ Description     │ Bookmark definition                                                                                  │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │
├──────────────────────────────────────┼──────────┼───────────┼─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┤
│ 81ec0c0d-c90c-431b-8c19-eff4048de404 │ bookmark │ Bookmark1 │ BM1 description │ {"qStateData":[{"qStateName":"$","qFieldItems":[{"qDef":{"qName":"Dim1","qType":"PRESENT"},"qSelectI │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-07-06T15:09:38.565Z │ 2021-07-06T15:09:38.565Z │ LAB\goran │
│                                      │          │           │                 │ nfo":{"qRangeLo":"NaN","qRangeHi":"NaN","qNumberFormat":{"qType":"U","qnDec":10,"qUseThou":0},"qRang │          │           │                          │                          │                          │           │
│                                      │          │           │                 │ eInfo":[],"qContinuousRangeInfo":[]},"qValues":[],"qExcludedValues":[]}]}],"qUtcModifyTime":44383.71 │          │           │                          │                          │                          │           │
│                                      │          │           │                 │ 498842593,"qVariableItems":[],"qPatches":[]}                                                         │          │           │                          │                          │                          │           │
└──────────────────────────────────────┴──────────┴───────────┴─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┘

➜  tools
```

### Measures

#### List measures

```bash
➜ node ctrl-q-cli.js getmeasure --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --outputformat table --userdir LAB --userid goran --loglevel verbose

2021-07-06T09:34:46.707Z : Get master measure(s)
2021-07-06T09:34:46.822Z : Created session to server 192.168.100.109, engine version is 12.878.3.
2021-07-06T09:34:47.154Z : Opened app a3e0f5d2-000a-464f-998d-33d333b175d7.
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                                                                                                                 Measures (2 measures found in the app)                                                                                                                                                                                                                  │
├──────────────────────────────────────┬─────────┬─────────────────────────────┬──────────────────────────────────────────┬─────────────────────────────┬──────────────────────────────────────┬──────────────────────────────┬─────────────────────────────────────────────┬───────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┬──────────────────────┤
│ Id                                   │ Type    │ Title                       │ Description                              │ Label                       │ Label expression                     │ Definition                   │ Coloring                                    │ Number format                         │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │ Tags                 │
├──────────────────────────────────────┼─────────┼─────────────────────────────┼──────────────────────────────────────────┼─────────────────────────────┼──────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼──────────────────────┤
│ LKYyWDm                              │ measure │ Master measure 1            │ Description for master measure 1         │ Master measure 1            │ 'Label expr for master measure 1'    │ sum(Expression1)             │ {"baseColor":{"color":"#99cfcd","index":2}} │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-08T11:18:47.216Z │ 2021-06-08T11:18:47.216Z │ LAB\goran │ My awesome tag,Tag 2 │
├──────────────────────────────────────┼─────────┼─────────────────────────────┼──────────────────────────────────────────┼─────────────────────────────┼──────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼──────────────────────┤
│ tXgP                                 │ measure │ Master measure 2            │ 'Description for master measure 2'       │ Master measure 2            │ 'Label expr for master measure 2'    │ Avg(Expression2)             │ {"baseColor":{"color":"#a16090","index":9}} │ {"qType":"U","qnDec":10,"qUseThou":0} │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-08T11:53:15.543Z │ 2021-06-08T11:53:15.543Z │ LAB\goran │ Tag 1,Tag 2,Tag 3    │
└──────────────────────────────────────┴─────────┴─────────────────────────────┴──────────────────────────────────────────┴─────────────────────────────┴──────────────────────────────────────┴──────────────────────────────┴─────────────────────────────────────────────┴───────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┴──────────────────────┘

2021-07-06T09:34:47.256Z verbose : Closed session after managing master items in app a3e0f5d2-000a-464f-998d-33d333b175d7 on host 192.168.100.109
```

#### Delete measures

```bash
➜ node ctrl-q-cli.js deletemeasure --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --userdir LAB --userid goran --itemid "8ad641cd-73bc-4605-8bef-529cd2e507d1, af0d7c76-22f6-435a-be68-434a6b158bd1" --loglevel verbose
```

### Dimensions

List dimensions

```bash
➜ node ctrl-q-cli.js getdim --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --outputformat table --userdir LAB --userid goran --loglevel verbose

2021-07-06T09:42:09.881Z : Get master dimension(s)
2021-07-06T09:42:09.999Z : Created session to server 192.168.100.109, engine version is 12.878.3.
2021-07-06T09:42:10.416Z : Opened app a3e0f5d2-000a-464f-998d-33d333b175d7.
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                                                                                                                      Dimensions (3 dimensions found in the app)                                                                                                                                                                                                                      │
├──────────────────────────────────────┬───────────┬─────────────────┬──────────────────────────────────────────┬──────────────────────────────────────────┬──────────────────────────────────────────┬──────────────────────────────────────────┬──────────────────┬─────────────────┬──────────────────────────────────────────┬──────────┬──────────┬───────────┬──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────┬──────────────────────┤
│ Id                                   │ Type      │ Title           │ Description (static)                     │ Description (from expression)            │ Description expression                   │ Label expression                         │ Definition count │ Definition      │ Coloring                                 │ Grouping │ Approved │ Published │ Publish time             │ Created date             │ Modified date            │ Owner     │ Tags                 │
├──────────────────────────────────────┼───────────┼─────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────┼─────────────────┼──────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼──────────────────────┤
│ mjEfUrd                              │ dimension │ Dimension 1     │                                          │ Master dimension description             │ 'Master dimension' & chr(32) & 'descript │ ='Label expression for master' & chr(32) │ 1                │ Dim1            │ {"changeHash":"0.5143626022511367","colo │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-04T15:43:56.505Z │ 2021-06-06T20:32:39.750Z │ LAB\goran │ My awesome tag,tag 1 │
│                                      │           │                 │                                          │                                          │ ion'                                     │ & 'dim 1'                                │                  │                 │ rMapRef":"mjEfUrd","baseColor":{"color": │          │          │           │                          │                          │                          │           │                      │
│                                      │           │                 │                                          │                                          │                                          │                                          │                  │                 │ "#87205d","index":7}}                    │          │          │           │                          │                          │                          │           │                      │
├──────────────────────────────────────┼───────────┼─────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────┼─────────────────┼──────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼──────────────────────┤
│ UPRBXKf                              │ dimension │ Dimension 2     │ Description for dimension 2              │                                          │                                          │ 'label expression for dimension 2'       │ 1                │ Dim2            │ {"changeHash":"0.03484771814318943"}     │ N        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-06T20:28:24.565Z │ 2021-06-06T20:28:24.565Z │ LAB\goran │                      │
├──────────────────────────────────────┼───────────┼─────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────────┼──────────────────┼─────────────────┼──────────────────────────────────────────┼──────────┼──────────┼───────────┼──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────┼──────────────────────┤
│ JDWuPK                               │ dimension │ Dimension 2-3-1 │ Description for 2-3-1                    │                                          │                                          │                                          │ 3                │ Dim2            │ {"changeHash":"0.5399463179200534","base │ H        │ false    │ false     │ 1753-01-01T00:00:00.000Z │ 2021-06-07T02:31:02.093Z │ 2021-06-07T02:31:02.093Z │ LAB\goran │ My awesome tag       │
│                                      │           │                 │                                          │                                          │                                          │                                          │                  │ Dim3            │ Color":{"color":"#ffffff","index":1}}    │          │          │           │                          │                          │                          │           │                      │
│                                      │           │                 │                                          │                                          │                                          │                                          │                  │ Dim1            │                                          │          │          │           │                          │                          │                          │           │                      │
└──────────────────────────────────────┴───────────┴─────────────────┴──────────────────────────────────────────┴──────────────────────────────────────────┴──────────────────────────────────────────┴──────────────────────────────────────────┴──────────────────┴─────────────────┴──────────────────────────────────────────┴──────────┴──────────┴───────────┴──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────┴──────────────────────┘


2021-07-06T09:42:10.526Z : Closed session after managing master items in app a3e0f5d2-000a-464f-998d-33d333b175d7 on host 192.168.100.109
```

Delete dimensions

```bash
➜ node ctrl-q-cli.js deletedim --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --userdir LAB --userid goran --itemid "b7d9a7f1-8361-4300-ad68-af5ae38cdb8d, a6ed0a7f-0065-4c21-b0ac-1b1250e0d71d" --loglevel verbose
```

### Import

Import dimensions and measures from Excel file.

First let's take a look at the command options:

```bash
➜ node ctrl-q-cli.js importexcel --help

Usage: ctrl-q-cli importexcel [options]

create master items based on definitions in an Excel file

Options:
  --loglevel <level>        log level (error, warning, info, verbose, debug, silly). "Info" level is default (default: "info")
  --host <host>             Qlik Sense server IP/FQDN
  --port <port>             Qlik Sense server engine port (default: "4747")
  --schemaversion <string>  Qlik Sense engine schema version (default: "12.612.0")
  --appid <id>              Qlik Sense app whose master items should be modified
  --certfile <file>         Qlik Sense certificate file (exported from QMC) (default: "./cert/client.pem")
  --certkeyfile <file>      Qlik Sense certificate key file (exported from QMC) (default: "./cert/client_key.pem")
  --rootcertfile <file>     Qlik Sense root certificate file (exported from QMC) (default: "./cert/root.pem")
  --prefix <prefix>         Qlik Sense virtual proxy prefix (default: "")
  --secure <true|false>     connection to Qlik Sense engine is via https (default: true)
  --userdir <directory>     user directory for user to connect with
  --userid <userid>         user ID for user to connect with
  --file <filename>         Excel file containing master item definitions
  --sheet <name>            name of Excel sheet where dim/measure flag column is found
  --columnflag <number>     column number (zero based) where dim/measure flag is found. Use "dim" in that column to create master dimension, "measure" for master measure
  --columnname <number>     column number (zero based) to use as master item name
  --columndescr <number>    column number (zero based) to use as master item description (default: "")
  --columnlabel <number>    column number (zero based) to use as master item label (default: "")
  --columnexpr <number>     column number (zero based) to use as master item expression
  --columntag <number>      column number (zero based) to use as master item tags
  -h, --help                display help for command
  ```


```bash
node ctrl-q-cli.js importexcel --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --userdir LAB --userid goran --file "/Users/goran/code/ctrl-q-cli/test/variables.xlsx" --sheet Sales --columnflag 0 --columnname 5 --columndescr 10 --columnlabel 6 --columnexpr 1 --columntag 7 --loglevel verbose
```

### Scramble

Scrambles one or more fields in an app using Qlik Sense's internal scrambling feature.  

Note:  

- If more than one field is to be scrambled, the indidivudal field names should be separated by the character or string specified in the `--separator` option. 
- The entire list of field names (the `--fieldname` option) should be surrounded by double quotes.
- A new app with the scrambled data will be created. Specify its name in the `--newappname` option.

```bash
➜ node ctrl-q-cli.js scramblefield --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --userdir LAB --userid goran --fieldname Expression1,Dim1,AsciiAlpha --separator , --newappname __ScrambledTest1 --loglevel silly

2021-07-06T09:44:19.277Z verbose: Scramble field
2021-07-06T09:44:19.778Z verbose: Created session to server 192.168.100.109, engine version is 12.878.3.
2021-07-06T09:44:20.104Z verbose: Opened app a3e0f5d2-000a-464f-998d-33d333b175d7.
2021-07-06T09:44:20.121Z info: Scrambled field "Expression1"
2021-07-06T09:44:20.140Z info: Scrambled field "Dim1"
2021-07-06T09:44:20.158Z info: Scrambled field "AsciiAlpha"
2021-07-06T09:44:20.891Z verbose: Closed session after managing master items in app a3e0f5d2-000a-464f-998d-33d333b175d7 on host 192.168.100.109
```

### Get script

Get script and associated metadata for a Sense app

```bash
➜ node ctrl-q-cli.js getscript --host 192.168.100.109 --appid a3e0f5d2-000a-464f-998d-33d333b175d7 --userdir LAB --userid goran --loglevel verbose

2021-07-06T09:44:55.221Z verbose: Get app script
2021-07-06T09:44:55.333Z verbose: Created session to server 192.168.100.109, engine version is 12.878.3.
2021-07-06T09:44:55.689Z verbose: Opened app a3e0f5d2-000a-464f-998d-33d333b175d7.
2021-07-06T09:44:55.705Z verbose: ----- Script metadata -----
2021-07-06T09:44:55.706Z verbose: Created date: 2021-06-03T22:04:52.283Z
2021-07-06T09:44:55.706Z verbose: Modified date: 2021-06-04T15:42:23.759Z
2021-07-06T09:44:55.706Z verbose: ----- End script metadata -----
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
2021-07-06T09:44:55.725Z verbose: Closed session after retrieving script from app a3e0f5d2-000a-464f-998d-33d333b175d7 on host 192.168.100.109
```

