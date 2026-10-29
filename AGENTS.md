# AGENTS.md

A pointer file. The rules live in the documents it names, so that there is one copy of each and they cannot drift apart. Extend those,
not this.

## Documentation drafts

**When you implement a user-visible change, add a Markdown draft to [`to-doc-site/`](to-doc-site/) in the same commit.**

[`to-doc-site/README.md`](to-doc-site/README.md) is the authoritative spec — what counts as user-visible, who the reader is, how to write
a draft, and what publishing one needs to know about Ctrl-Q, including the house rule that is the publishing loop. Read it before
writing or publishing anything. Its rules are deliberately not repeated here.

The drafts are published to the documentation site, <https://ctrl-q.ptarmiganlabs.com>, from its own repository,
`ptarmiganlabs/ctrl-q-docs`. A draft is not a reason to leave a command's `--help` text stale: the option descriptions in
[`src/lib/cli/`](src/lib/cli/) are live documentation too, and a user-visible change updates them in the same commit.

## Everything else

[`README.md`](README.md) points to the documentation site. [`docs/README.md`](docs/README.md) is developer material, such as how the
terminal captures are made.
