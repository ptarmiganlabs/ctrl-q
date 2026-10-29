# task-vis asks before it shares the task network with other computers

_Requires Ctrl-Q X.Y.Z or later._

## What changed

`qseow task-vis` shows the task network on a web page that Ctrl-Q serves. By default only the computer Ctrl-Q runs on can open it,
because the page server listens on `localhost`.

To let other computers open the page, give `--vis-host` an address that is not a loopback address — `0.0.0.0` listens on all IPv4
network interfaces — **and add `--vis-allow-remote` to confirm it**:

```bash
ctrl-q qseow task-vis --host sense.example.com --auth-user-dir LAB --auth-user-id ctrlq --vis-host 0.0.0.0 --vis-allow-remote
```

Without `--vis-allow-remote`, task-vis stops before it connects to Qlik Sense, with exit code 1 and this message:

```text
--vis-host 0.0.0.0 makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.
```

When the address came from the environment variable `CTRLQ_VIS_HOST`, the message says so: `--vis-host 0.0.0.0 (from CTRLQ_VIS_HOST) makes
the page reachable from other computers. …`

`--vis-allow-remote` can also be set with the environment variable `CTRLQ_VIS_ALLOW_REMOTE`. On the command line it needs no value;
with a value, or in the environment variable, `true`, `1`, `yes` and `on` turn it on, and `false`, `0`, `no` and `off` leave it off. Any
other value stops task-vis with:

```text
--vis-allow-remote must be true or false, got "maybe".
```

`qseow task-gantt` reads the same two environment variables, so setting them once covers both commands.

### The access token

A page that other computers can open is protected by a random access token, a new one each time task-vis starts. Ctrl-Q prints the
addresses to open, with the token in them: one for this computer, and one for each name and address other computers can use.

```text
Task visualization, on this computer: http://localhost:3000/?token=…
Task visualization, from other computers: http://sense-admin-pc:3000/?token=…
Task visualization, from other computers: http://10.0.0.15:3000/?token=…
The page is reachable from other computers. Share one of the URLs above, including its token, only with people who may see it.
```

A browser that opens one of these addresses keeps the token in a cookie for the rest of the session. A request without the token gets
the answer `401 Unauthorized`.

## What it does not change

- **On this computer only, nothing changes.** With the default `--vis-host localhost`, or `127.0.0.1` or `::1`, there is no token and
  no `--vis-allow-remote` is needed. `--vis-allow-remote` with a loopback address is accepted and changes nothing.
- `--vis-port`, its environment variable `CTRLQ_VIS_PORT` and its default, 3000, stay as they were.
- The page itself — the network, its controls and the node details — is the same whether other computers can open it or not.

---

## Notes for the publishing pass — remove before publishing

- From ptarmiganlabs/ctrl-q#705: f31e458 put the page behind the token, and 57012b2 added `--vis-allow-remote`.
- Target page: the task-vis section "List tasks as network graph" in `docs/docs/command/qseow/task/index.md`. Its `--help` output there
  predates both changes; replace it with the released one, which lists `--vis-allow-remote`.
- **This breaks scripts** that pass a non-loopback `--vis-host`, or set `CTRLQ_VIS_HOST` to one: they stop with exit code 1 until they add
  `--vis-allow-remote`. Before #705 such a page was open to anyone who could reach the port, with no token. The release notes should say
  so; whether the release is marked as breaking is the maintainer's call.
- The host name and addresses in the example output are made up; the real list depends on the computer's network interfaces. With
  `--vis-host ::` the list also includes IPv6 addresses.
