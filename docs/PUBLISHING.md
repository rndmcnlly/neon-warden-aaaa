# Publishing: public repository, GitHub Pages and DNS

How the public surfaces were created on October 29, 2026, what each setting
is, and how to undo it. Adam authorized placeholder content only; the project
history is not public yet. The scrubbed mirror at `~/Desktop/neon-warden-public`
is force-pushed over the placeholder later, after Adam approves it.

## Surfaces

| Surface         | Address                                         | State (October 29, 2026)                                                |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Repository      | <https://github.com/rndmcnlly/neon-warden-aaaa> | Public, one placeholder commit: README, MIT `LICENSE`, coming-soon page |
| Site            | <https://neon-warden-aaaa.adamsmith.systems>    | Placeholder page from the placeholder repository's `site/` folder       |
| Fallback origin | `rndmcnlly.github.io/neon-warden-aaaa/`         | Redirects to the custom domain                                          |

## GitHub (gh CLI, account rndmcnlly)

```sh
# Placeholder repository, built in a temporary directory (not this repo):
gh repo create rndmcnlly/neon-warden-aaaa --public \
  --description "Neon Warden AAAA: a meta vertical slice of AI-assisted game production" \
  --homepage https://neon-warden-aaaa.adamsmith.systems --source . --push
# Pages with "GitHub Actions" as the source (no gh-pages branch):
gh api -X POST repos/rndmcnlly/neon-warden-aaaa/pages -f build_type=workflow
# Custom domain, set on the Pages site itself:
gh api -X PUT repos/rndmcnlly/neon-warden-aaaa/pages -f cname=neon-warden-aaaa.adamsmith.systems
# After the certificate was issued (about 15 minutes after the DNS record;
# the edge servers took a few more minutes to all serve it):
gh api -X PUT repos/rndmcnlly/neon-warden-aaaa/pages -F https_enforced=true
```

With Actions as the source, the custom domain lives in the repository's Pages
settings, not in the deployed files, so it survives every deploy. The
`public/CNAME` file (copied into `dist/CNAME`) is belt and braces: it records
the domain in the source and keeps it if Pages is ever switched to branch
deploys. `src/platform/build.ts` keeps `CNAME` out of the offline pack.

The placeholder repository's workflow uploads its `site/` folder. When the
real history replaces it, this repository's `.github/workflows/pages.yml`
takes over: it runs `deno task ci` and uploads `dist/`.

## Base path

The site is served at a domain root, so the real workflow leaves `REPO_NAME`
unset and `vite.config.ts` builds with base `/` (landing page at `/`, game at
`/play/`, service worker scope inside `/play/`). A fork served from
`<user>.github.io/<repo>/` instead should set `REPO_NAME:
${{ github.event.repository.name }}` in the workflow's `deno task ci` step and
delete `public/CNAME`. `REPO_URL` is still passed by the workflow so the
landing page links to whichever repository built it; local builds fall back
to `https://github.com/rndmcnlly/neon-warden-aaaa`.

Canonical links and the Open Graph and Twitter cards are absolute URLs built
from `SITE_URL` (default `https://neon-warden-aaaa.adamsmith.systems`, see
`vite.config.ts`); a fork served elsewhere sets it, subpath included. The
share image is `public/media/og-poster.jpg` (1200x630).

## Cloudflare DNS (cf CLI, profile `personal`)

- Account: `890753ccd6f0bbbfbe2c030cc44f6a87` (Adam's personal account).
- Zone: `adamsmith.systems`, zone ID `01d5dd6aa6a367bb3c7de7b33791c722`.
- Record ID `82e2e443c0ebf4e8e56508092d4c6543`: `CNAME`
  `neon-warden-aaaa.adamsmith.systems` -> `rndmcnlly.github.io`, DNS only
  (not proxied, so GitHub can issue and serve its own certificate), automatic
  TTL, with a comment naming the repository.

```sh
cf dns records create -z 01d5dd6aa6a367bb3c7de7b33791c722 --profile personal --body \
  '{"type":"CNAME","name":"neon-warden-aaaa.adamsmith.systems","content":"rndmcnlly.github.io","proxied":false,"ttl":1}'
```

Checked first, and left unchanged: the zone had no record with this name; it
has a proxied wildcard `A *.adamsmith.systems -> 192.0.2.1` (and the same for
the apex). A specific record overrides a wildcard, and DNS-only traffic never
reaches Cloudflare's proxy, so Worker routes, rules and the wildcard do not
apply to this host. No page rules or custom zone rulesets existed (only
Cloudflare-managed ones). Nothing else in the zone was changed.

## Verification

```sh
dig +short CNAME neon-warden-aaaa.adamsmith.systems   # rndmcnlly.github.io.
curl -sI https://neon-warden-aaaa.adamsmith.systems    # 200, GitHub certificate
gh api repos/rndmcnlly/neon-warden-aaaa/pages          # cname, https_enforced
```

## Not done (needs Adam's hands, optional)

Verifying `adamsmith.systems` under GitHub account settings (Pages, "Add a
verified domain") prevents another GitHub account from claiming a dangling
subdomain if this repository's Pages site is ever removed while the DNS
record remains. GitHub shows a TXT record value only in its web UI; add that
TXT record in the zone above, then click Verify. HTTPS works without it.

## Undo

```sh
# DNS (do this first, or together with removing Pages, to avoid a dangling record):
cf dns records delete 82e2e443c0ebf4e8e56508092d4c6543 -z 01d5dd6aa6a367bb3c7de7b33791c722 --profile personal
# Pages:
gh api -X DELETE repos/rndmcnlly/neon-warden-aaaa/pages
# Repository (irreversible; needs the delete_repo scope):
gh repo delete rndmcnlly/neon-warden-aaaa
```

In this repository, revert the commit that added this file to restore the
subpath (`REPO_NAME`) build.

## GitHub Pages verified domain (October 29, 2026)

Adam authorized adding the TXT record GitHub showed for verifying
`adamsmith.systems` under the `rndmcnlly` account. A verified domain stops
other GitHub accounts from claiming a dangling `*.adamsmith.systems`
subdomain (takeover protection), which covers the "Not done" item above.

- Record ID `b7bf2adb9af9b03cd9dc8de519e0f0a0`: `TXT`
  `_github-pages-challenge-rndmcnlly.adamsmith.systems` ->
  `d66017d854133aab95af31a517f761`, DNS only, automatic TTL, with a comment
  naming this file. Checked first: no record with this name existed. Nothing
  else in the zone was changed.
- Verified: `dig +short TXT _github-pages-challenge-rndmcnlly.adamsmith.systems @1.1.1.1`
  returned `"d66017d854133aab95af31a517f761"`.
- Remaining step (Adam): click Verify at https://github.com/settings/pages.
  GitHub recommends keeping the record afterward.

Undo (also remove the domain from https://github.com/settings/pages):

```sh
cf dns records delete b7bf2adb9af9b03cd9dc8de519e0f0a0 -z 01d5dd6aa6a367bb3c7de7b33791c722 --profile personal
```

- 2026-10-29: Adam clicked Verify; adamsmith.systems is now a verified GitHub Pages domain for rndmcnlly. Keep the TXT record in place (removing it can unverify the domain).
