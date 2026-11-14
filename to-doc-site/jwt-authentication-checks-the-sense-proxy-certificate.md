# Ctrl-Q checks the Sense proxy's certificate before it sends a JWT

_Requires Ctrl-Q X.Y.Z or later._

## What changed

With `--auth-type jwt`, Ctrl-Q reaches the Qlik Sense repository service through a virtual proxy and sends the JWT with each request.
Ctrl-Q now checks the proxy's certificate before it sends anything, as it already did with certificate authentication: the certificate
must come from a certificate authority (CA) this computer trusts, must not have expired, and must be made out to the name given in
`--host`. If any of that fails, Ctrl-Q stops without sending the JWT.

Earlier versions accepted any certificate on these connections, whatever `--secure` was set to. A JWT is a full credential for the user
it was issued to, so it went to whatever answered at `--host`, including a server pretending to be Qlik Sense.

`--secure` now means the same for both authentication types:

| `--secure`          | Certificate authentication                        | JWT authentication                           |
| ------------------- | ------------------------------------------------- | -------------------------------------------- |
| `true`, the default | Checked against the CA in `--auth-root-cert-file` | Checked against the CAs this computer trusts |
| `false`             | Not checked                                       | Not checked                                  |

`false` is not case sensitive, and any other value keeps the check on. `--secure` can also be set with the environment variable
`CTRLQ_SECURE`.

## When the proxy's certificate is not trusted

Ctrl-Q stops with the error from the certificate check. `qseow connection-test` reports it like this:

```text
error: GET ABOUT INFO: Error: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca
error: Could not get about info from QSEoW
```

Other commands put their own text before the error. Other errors from the same check include `self-signed certificate in certificate
chain`, `certificate has expired` and `Hostname/IP does not match certificate's altnames`.

It happens when the virtual proxy uses the certificate Qlik Sense created for itself when it was installed, or one from your
organisation's own CA, and this computer does not trust that CA. There are two ways to fix it.

**Make Ctrl-Q trust the CA.** Set the environment variable `NODE_EXTRA_CA_CERTS` to a file holding the CA's certificate in PEM format.
For the certificate Qlik Sense created, that is the root certificate exported from the QMC, `root.pem`: the same file certificate
authentication uses. For your organisation's CA, ask whoever runs it for the CA certificate.

```powershell
$env:NODE_EXTRA_CA_CERTS = 'C:\ctrl-q\config\root.pem'
.\ctrl-q.exe qseow connection-test --host sense.example.com --port 443 --virtual-proxy jwt --auth-type jwt --auth-jwt "<JWT>"
```

Check `--host` as well: it must be a name in the certificate. A certificate made out to `sense.example.com` is not valid for `sense`, or
for the server's IP address.

**Or turn the check off with `--secure false`**, on a network you trust only. Ctrl-Q then sends the JWT to whatever answers at
`--host`, as earlier versions did.

## What it does not change

- **Certificate authentication** works as before. It checks the certificate against the CA in `--auth-root-cert-file` only, so
  `NODE_EXTRA_CA_CERTS` does not affect it.
- **The JWT, the virtual proxy and the port** are used as before.
- **Connections to the Sense engine**, which the commands that work inside an app use (master items, variables, bookmarks, the load
  script, scrambling fields), are not covered by this change.

---

## Notes for the publishing pass — remove before publishing

- From the commit `fix: check the Sense proxy's certificate before sending a JWT to the QRS`.
- Target page: `docs/docs/getting-started/qseow-auth/index.md`. Its section "Strict or relaxed certificate validation" sits under
  "Certificates" and speaks of certificate authentication only, and the "JWTs" section says nothing about certificates. A short
  subsection under "JWTs" could carry this and link to the existing explanation of what validating a certificate means.
- The `--secure` help text on the command pages, "https connection to Qlik Sense must use correct certificate. Invalid certificates will
  result in rejected/failed connection.", does not change. For JWT connections to the repository service it is now true.
- **This breaks JWT setups** where the computer running Ctrl-Q does not trust the proxy's certificate: they connected before and now
  stop until they set `NODE_EXTRA_CA_CERTS` or `--secure false`. The release notes should say so; whether the release is marked as
  breaking is the maintainer's call.
- The quoted message is from `qseow connection-test` run from source on Node.js 24, the version the binaries are built with, against a
  test server whose CA the computer did not trust. Its second half is Node.js's own suggestion. Whether the binaries can use the
  operating system's CAs (`--use-system-ca` through `NODE_OPTIONS`, or `NODE_USE_SYSTEM_CA=1`) was not checked. If they can, that is the
  simplest fix for a CA that Windows already trusts, and worth a line here. `NODE_EXTRA_CA_CERTS` was checked with a binary built
  locally.
- Engine connections do not check the certificate yet, with either authentication type. If that is fixed before this is published,
  fold it in and drop the last bullet of "What it does not change". The existing page's statement that certificate authentication
  validates the certificate is not true of engine connections either.
