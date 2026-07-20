<a name="readme-top"></a>

# reckoner

**A plain-text notepad where math answers itself.**

Type notes and numbers together. Any line that parses as math gets a live
answer on the rail to the right; any line that doesn't is simply a note. No
mode switch, no syntax errors thrown in your face, no wrong way to type.

reckoner understands the arithmetic of everyday life — money, percentages,
units, clock time, and rates — and it does all of it **entirely in your
browser**. There is no backend, no account, no analytics, no network call of
any kind. Sheets autosave to local storage, work offline as a PWA, and can be
shared as a URL that carries the whole sheet *inside the link itself*
(deflate-compressed into the fragment — nothing is ever uploaded, because
there is nothing to upload to).

Commercial apps have owned this idea for years. reckoner is the
free-software answer: AGPL-3.0, zero runtime dependencies beyond React, and
small enough to read in an afternoon.

## What a sheet looks like

```text
— Split the check —                    │
dinner = $86.40                        │      $86.40
tip = 18% of dinner                    │      $15.55
dinner + tip                           │     $101.95
prev / 3                               │      $33.98
                                       │
5 km in mi                             │     3.11 mi
9:30am + 3h 45m                        │       13:15
$18 / 2.5 h                            │     $7.20/h
62 mph * 3.5 h                         │      217 mi
                                       │
28.50                                  │       28.5
41.25                                  │       41.25
sum                                    │       69.75
```

Click any answer to copy it. Negative answers show in bookkeeper red, the way
a ledger would write them.

## The language

| Write | Get | Notes |
| --- | --- | --- |
| `2 + 2 * 2` | `6` | usual precedence, `( )`, `^`, `pi`, `sqrt()`, `round(x, 2)`, `abs`, `floor`, `ceil`, `min`, `max` |
| `$5k + 8.25%` | `$5,412.50` | `k` / `M` / `B` magnitude suffixes; `+ %` and `- %` grow or shrink the left side |
| `15% of 240` | `36` | also `20% off 150`, `20% on 150`, `32 as % of 80` |
| `rent = 1200` | `1,200` | variables flow down the sheet; `prev` (or `ans`) is the last answer |
| `5 km in mi` | `3.11 mi` | `in` or `to` converts; length, mass, volume, temperature, data, area, time |
| `6 ft 2 in in cm` | `187.96 cm` | quantities chain: `1 lb 4 oz`, `3h 20m`, `5'10"` |
| `9:30am + 3h 45m` | `13:15` | clock literals stay clocks; durations pretty-print as `6 h 15 min` |
| `$18 / 2.5 h` | `$7.20/h` | rates from division or `per`; `rate × time`, `distance ÷ mpg`, `mph in km/h` all work |
| `sum` / `avg` | | adds or averages the value lines above, up to a blank line; prose lines are skipped, mismatched units left out |
| `total` | | grand total: adds every `sum` above it |
| `10 * 2  # boxes` | `20` | `#` or `//` starts a comment |

Two deliberate stances worth knowing:

- **After an hour value, `m` means minutes** (`3h 20m`), because that is what
  a human means. A bare `20m` is still twenty metres.
- **Currencies never cross-convert.** `$40 + €5` is an error, not a guess.
  Exchange rates require a network feed, and reckoner makes no network calls —
  offline honesty over online convenience.

## Privacy model

The entire application is static files. Your sheets live in
`localStorage` under the key `reckoner.v1` and nowhere else. Share links are
self-contained: the sheet text is deflate-compressed (via the browser's native
`CompressionStream`) and base64url-encoded into the URL fragment, which
[browsers do not send to servers](https://developer.mozilla.org/en-US/docs/Web/API/URL/hash).
Deleting your browser data deletes your sheets. That's the whole model.

## Architecture

```
src/
  engine/          the whole calculator — pure TypeScript, no DOM
    tokenizer.ts   numbers (1,299 / $5k / 9:30am), units, keywords
    units.ts       dimension table, aliases, compound presets (mph, mpg)
    evaluator.ts   direct-evaluation recursive descent; Val = {n, num, den}
    formatter.ts   money, percent, pretty durations, clock time, rates
    index.ts       evaluateSheet(text) → per-line results
  components/      Editor (textarea + answer rail), Help drawer
  lib/             storage.ts (localStorage), share.ts (URL codec)
  App.tsx          sheets, theme, toast, share import
public/
  sw.js            offline: network-first navigations, cache-first assets
```

Values are stored canonically in base units with the display atom preserved,
so `5 mi + 3 km` answers in miles because miles is what you wrote. A line that
fails to *parse* is prose; a line that parses but fails to *evaluate*
(`$40 + €5`, division by zero, `5 km + 3 kg`) shows a quiet `!` with the
reason on hover. The engine has no browser dependencies and ships with a
78-assertion test suite:

```sh
npm run selftest
```

## Development

```sh
npm install
npm run dev        # Vite dev server
npm run build      # type-check + production build → dist/
npm run selftest   # engine assertions
```

Stack: Vite 5, React 18, TypeScript 5. No other runtime dependencies.

## Deploying

reckoner is a fully static site — `npm run build` produces a `dist/` folder
that any static host serves as-is.

- **bolt.new** — import the repository, and Bolt will install and run it;
  publish from there. No server component, no environment variables, nothing
  to configure.
- **Netlify / any static host** — build command `npm run build`, publish
  directory `dist`.

The service worker enables offline use on the published site and stays out of
the way during development.

## Copying

Copyright © 2026 Kevin Bell.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) file for details.

--------------------------------------------------------------------------------------------------------------------------
== We're Using GitHub Under Protest ==

This project is currently hosted on GitHub.  This is not ideal; GitHub is a
proprietary, trade-secret system that is not Free and Open Souce Software
(FOSS).  We are deeply concerned about using a proprietary system like GitHub
to develop our FOSS project. I have a [website](https://bellKevin.me) where the
project contributors are actively discussing how we can move away from GitHub
in the long term.  We urge you to read about the [Give up GitHub](https://GiveUpGitHub.org) campaign 
from [the Software Freedom Conservancy](https://sfconservancy.org) to understand some of the reasons why GitHub is not 
a good place to host FOSS projects.

If you are a contributor who personally has already quit using GitHub, please
email me at **kevinBell@Linux.com** for how to send us contributions without
using GitHub directly.

Any use of this project's code by GitHub Copilot, past or present, is done
without our permission.  We do not consent to GitHub's use of this project's
code in Copilot.

![Logo of the GiveUpGitHub campaign](https://sfconservancy.org/img/GiveUpGitHub.png)

<p align="right"><a href="#readme-top">back to top</a></p>
