# Docs staging: `to-doc-site`

Files in this folder are drafts of pages for the Ctrl-Q documentation site. They are written and reviewed here, alongside the change
they describe, and published to the documentation site later.

**This file is the authoritative spec for writing them, and records what publishing one needs to know about Ctrl-Q.** The publishing
loop itself is a house rule, named under [Publishing](#publishing). [`AGENTS.md`](../AGENTS.md) carries a short pointer to this file and
nothing more, so the rules live in one place and cannot drift apart. Extend this file rather than restating any of it in an agent
instruction file.

## The documentation site

|                   |                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Published site    | <https://ctrl-q.ptarmiganlabs.com> — public                                                                                   |
| Source repository | [ptarmiganlabs/ctrl-q-docs](https://github.com/ptarmiganlabs/ctrl-q-docs) — public, cloned at `/Users/goran/code/ctrl-q-docs` |
| Hosting           | A Cloudflare Pages project, which builds and serves `main`                                                                    |
| Previews          | One per pull request, at its own `https://<hash>.ctrl-q-docs.pages.dev` — public. See [Decisions](#decisions)                 |
| Local build       | `npm run build` in the site repository, or `npm run dev` to browse it                                                         |

**Every user-visible change gets its draft here, in the same commit as the change**, and is published to the site later, as
[Publishing](#publishing) describes. The alternative — reconstructing the documentation from memory and commit logs — loses exactly the
details a reader needs: why a default is what it is, the exact wording of a message they can search for, what an option does _not_ do.

## Why this folder is at the repository root

`docs/` in this repository is developer material: how terminal captures are made, and the images the repository's README shows. These
drafts are for people who run Ctrl-Q. Keeping the two apart keeps both audiences' documents honest, and the sibling Ptarmigan Labs
projects keep their drafts at the root for the same reason.

Nothing a user receives can carry this folder, and it is worth writing down why, so that nobody adds machinery to guard a door that is
already shut:

- Ctrl-Q is released as zipped single-file binaries. Each embeds one script, bundled by esbuild from the code `src/ctrl-q.js` imports,
  and the web page files that [`sea-config.json`](../sea-config.json) lists by name. Nothing else in the repository reaches a binary.
- Ctrl-Q is not published to npm, so there is no package that could carry it either.

So there is no exclusion to add and no guard test to write. If a packager that ships everything committed is ever introduced, this
folder is the first thing to exclude from it.

### A pull request touching only this folder runs the full CI

No workflow skips a pull request because it touches only this folder. Do not add a `paths-ignore` for it: the checks take minutes, and a
path filter that leaves a path out retires every check that reads it — a cost paid forever to save one run of a job that was going to
pass.

## Purpose

This folder is a **staging area, not the published source**. Nothing here is rendered anywhere; the site lives in its own repository and
is written from these drafts.

The command line's own `--help` text is live documentation too. **A draft here does not excuse leaving an option's description stale**:
a user-visible change updates it in the same commit. The draft is for the page the site carries, at a length and depth `--help` cannot
hold.

## When to add a file

**When you implement a user-visible change, add a Markdown file here in the same commit as the change.** For Ctrl-Q that covers:

- A **new command**, or a new or changed **option**: its name, default, allowed values, environment variable, or when it is required.
- A change to what a command **does**: what it reads from or changes in Qlik Sense, the files it writes and their format, the tables it
  prints and their columns.
- A new or changed **message** Ctrl-Q prints: an error, a warning, a log line people act on. People search the web for those strings
  verbatim.
- A change to **authentication**: certificates, JWTs, virtual proxies, and the environment variables they are read from.
- A change to a **web page** Ctrl-Q serves, such as `qseow task-vis`: what it shows, who can open it, and what that takes.
- A change to **installation**, the binaries, supported platforms, or supported Qlik Sense versions.
- A **limit** a user can hit, or an **exit code** a script relies on.
- A bug fix a user would notice, or a correction to previously documented behaviour.

**A draft can also be triggered by something with no commit to attach to** — a Qlik Sense release that changes what the repository
service returns, a dead link, a claim found to have been wrong since it was written. The trigger is then noticing rather than
implementing: write the file when you spot it, and say in it what changed and how you checked.

**Skip it when nothing a user sees changes** — internal refactoring, test-only work, build and CI changes, dependency bumps, performance
work that does not change what is possible.

The question is not whether the change was large, but whether somebody running Ctrl-Q would need to know. A large refactor can warrant
nothing; a one-line change to a default can warrant a file.

## Audience

Drafts are written for **Qlik Sense administrators and developers** who run Ctrl-Q against client-managed Qlik Sense Enterprise on
Windows, and, for a few commands, Qlik Cloud. Assume the reader:

- Knows Qlik Sense: the QMC, apps, reload tasks and their triggers, tags, custom properties, virtual proxies and certificates.
- Runs Ctrl-Q in a terminal on Windows, macOS or Linux, often from a script or a scheduled job.
- May work on a locked-down server without internet access.
- Does not read JavaScript, and should not have to.

Say what changes for the reader and what they do about it, not how it was implemented. Command lines, options, environment variables
and Ctrl-Q's own messages are welcome. Source paths and internal names are not.

## File format

- Markdown (`.md`), **one topic per file — the unit is the topic, not the target page.** One behaviour that has to be described on
  three pages is one draft: one set of facts to verify, one decision to review. The reverse holds too: two unrelated topics that happen
  to land on the same page are two files.
- Descriptive kebab-case names for the **topic**, starting with the command when the topic belongs to one:
  `task-vis-sharing-the-page-with-other-computers.md`, not `task-page-update.md`. Which page a draft belongs on is a proposal the
  publishing pass can overrule, so a name taken from a page turns misleading the moment that decision changes.
- Self-contained: do not split a topic across files or rely on the reader cross-referencing.
- **Quote Ctrl-Q's own strings verbatim** — options, environment variables, messages, log lines. A reader searching for what they see
  in the terminal has to find the page.
- Show command lines in full. The site shows most examples as PowerShell commands run as `.\ctrl-q.exe`; a draft may use any shell,
  and the publishing pass adapts it.
- Screenshots and terminal captures are welcome in a draft as a description of what to capture; do not add binary files here. The
  publishing pass makes them against a real server.

### Draft anatomy

Start with an H1 naming the change as a reader would experience it. Where behaviour changed, follow it with a one-line italic version
gate, which becomes a callout on the site:

```markdown
# task-vis asks before it shares the task network with other computers

_Requires Ctrl-Q X.Y.Z or later._
```

Leave the version as `X.Y.Z` when the release is not known yet; the publishing pass settles it, as
[Which release ships it](#which-release-ships-it) describes. Where the draft corrects documentation rather than describing a change, say
that instead — a correction gates against no version at all:

```markdown
# The task network shows external program tasks too

_Applies to every released version. This corrects a page that has said otherwise since it was written._
```

Then `## What changed`, `## What it does not change`, and whatever the reader needs to act: the command line, the options, the exact
messages. `## What it does not change` is the section readers get most from and writers skip most often.

Anything that is context for the publishing pass rather than content for the site goes in a trailing `---` section headed
**`## Notes for the publishing pass — remove before publishing`**: issue and pull request numbers, ordering hints relative to other
drafts, target-page proposals, and anything the maintainer should decide.

### A draft for a new command

A new command is one draft, and it proposes a whole page. Cover what the reader needs to run it: what it is for, its syntax (the
`--help` output), the required options, authentication, how to select what it works on, what it outputs and where, its environment
variables, examples, and the errors it reports. The site's existing command pages show the shape it will take.

## Processing status

- Files **directly in this folder, without a prefix**, are pending review or publication.
- Files in the **`done/` subfolder, prefixed `done_`**, have been published, verified to exist already, or deliberately judged not worth
  publishing.

Marking a file processed is one `git mv`, so history follows the file:

```bash
git mv to-doc-site/task-vis-sharing-the-page-with-other-computers.md to-doc-site/done/done_task-vis-sharing-the-page-with-other-computers.md
```

Where the publishing pass did something the draft did not say — landed it on a different page, corrected a claim, split it in two —
record that as a leading HTML comment in the moved file. That comment is the only record of the decision. **The comment is a second
change, and `git mv` stages only the first**: stage the comment as well, and check what was committed with `git show HEAD:<path>`, not
the file on disk.

Processed files stay in `done/` for traceability until there is a deliberate cleanup pass.

**When writing a new file, leave it unprefixed and directly in this folder.** The `done_` move belongs to whoever publishes it, never to
whoever writes it.

## Adding a file vs. editing an existing one

Prefer updating an existing unprefixed file on the same topic over adding a second one: a later change to the same behaviour updates the
pending draft, so the publishing pass sees one current account rather than two partial ones.

If the topic already has a `done_` file, add a new unprefixed file instead, so the record of what was published stays intact.

---

## Publishing

**The publishing loop is `rules/docs/to-doc-site.md` in plabs-house-rules** — the one copy every Ptarmigan Labs product follows: scope
and order, a critical review of each draft, every claim verified against the source, the release that ships it, and then one draft per
pull request, reviewed and approved one at a time, with the `done_` move in the same turn as the approval. It runs only when asked. It
is not repeated here, so that the copies cannot drift apart; what follows is what it needs to know about Ctrl-Q, including where Ctrl-Q
departs from it for now (see [Decisions](#decisions)).

### Run the pass from this repository, at a fresh `main`

The drafts are here, and so is the source every claim is checked against. Read both from a freshly fetched `main` of
`ptarmiganlabs/ctrl-q`, not from a working tree: one may be on a feature branch, where a draft that exists looks deleted and an option
nobody has released looks current. In a clone whose `origin` is a fork, that remote is usually `upstream`:

```bash
git -C /Users/goran/code/ctrl-q fetch upstream
git -C /Users/goran/code/ctrl-q show upstream/main:to-doc-site/README.md
```

### Which source settles which claim

Drafts are written from intent and can be wrong in detail. Read the source at `main`:

| Claim                                                                  | Settled by                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| An option's name, default, allowed values and environment variable     | `src/lib/cli/<area>-<command>.js`, one file per command                                        |
| A message about a missing or invalid option                            | `src/lib/util/qseow/assert-options.js`, `src/lib/util/qscloud/assert-options.js`               |
| What a command does, reads and writes                                  | `src/lib/cmd/qseow/`, `src/lib/cmd/qscloud/`                                                   |
| How Ctrl-Q connects to Qlik Sense: certificates, JWTs, virtual proxies | `src/lib/util/qseow/qrs.js`, `src/lib/util/qseow/enigma_util.js`, `src/lib/util/qseow/cert.js` |
| What a web page shows                                                  | `src/static/`, and the command that serves it                                                  |
| Which files the binaries embed                                         | `sea-config.json`                                                                              |
| Which platforms get binaries, and how they are built and signed        | `.github/workflows/ci.yaml`                                                                    |

Ctrl-Q is a command-line tool, so where the source leaves something open, run it: `node src/ctrl-q.js <area> <command> --help` from a
checkout of `main` gives the exact option text. Behaviour against Qlik Sense needs a test server; leave out what neither the source nor
a run has settled rather than guessing.

### Which release ships it

- **The pending version** is in the open release-please pull request's title, `chore(main): release ctrl-q X.Y.Z`. A version number
  written in a draft is evidence of nothing.
- **Tags carry the package name**: `ctrl-q-vX.Y.Z`. A bare `vX.Y.Z` finds nothing.
- **A release is created as a draft** (`"draft": true` in `release-please-config.json`) and published by hand, so check that it is out
  before calling its version released: `gh release view ctrl-q-vX.Y.Z --repo ptarmiganlabs/ctrl-q --json isDraft`.

### Decisions

- **The site and its repository are public.** Everything published there can be read by anyone, so a page never documents behaviour no
  release has shipped yet.
- **This folder was set up on 2026-10-29** (Goran). Pages staged before it are in `docs/commands/`. Its template,
  `TEMPLATE_qseow_command.md`, became [A draft for a new command](#a-draft-for-a-new-command) and was deleted, because a template in
  this folder would read as a pending draft. The pages move here once the open task-gantt pull request has merged:
  `qseow/app-metadata-get.md`, published in the site's update for Ctrl-Q 4.5, to `done/`, and `qseow/task-gantt.md`, which that pull
  request adds, as a pending draft. Moving `app-metadata-get.md` first would make git read the move as a rename of its whole folder,
  and file `task-gantt.md` under `done/` when the pull request merged.
- **Until the site moves to the house setup, a draft's pull request goes into the site's `main`** (Goran, 2026-10-29). ctrl-q-docs
  predates the house setup for documentation sites: a Cloudflare Pages project builds and serves `main`, and there is no `next` branch.
  Each pull request does get a preview, at an address of its own on `pages.dev`, but anyone can open it, where the house setup keeps
  previews behind Cloudflare Access. So each draft still gets a pull request of its own, reviewed on its preview _before_ the merge,
  because the merge publishes it; the `done_` move follows the merge, in the same turn. A preview can show behaviour no release has
  shipped yet, so its address goes no further than the review. Goran decided the same day that the site moves to the house setup — a
  `next` branch, a Worker, previews behind Access — and this decision lapses once it has.

## Ownership

These drafts are maintained by the Ctrl-Q maintainers. Pull requests and issues are welcome.
