// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Basics",
    rows: [
      ["2 + 2 * 2", "usual precedence, with ( ) and ^"],
      ["$5k + 8.25%", "k, M, B magnitude suffixes"],
      ["price = 1200", "name a value, use it below"],
      ["prev / 3", "prev (or ans) is the last answer"],
      ["10 * 2  # boxes", "# or // starts a comment"],
      ["sqrt(2)  round(x, 2)", "also abs, floor, ceil, min, max, pi"],
    ],
  },
  {
    title: "Percent",
    rows: [
      ["15% of 240", "36"],
      ["$1,299 - 20%", "grows or shrinks the left side"],
      ["20% off 150   20% on 150", "discounts and surcharges"],
      ["32 as % of 80", "40%"],
    ],
  },
  {
    title: "Units",
    rows: [
      ["5 km in mi", "in or to converts"],
      ["6 ft 2 in in cm", "quantities chain: 1 lb 4 oz, 5'10\""],
      ["350 F in C", "temperatures convert; they don't mix"],
      ["2 TB / 4.7 GB", "same dimension divides to a ratio"],
      ["$40 + 12 USD", "currencies never cross-convert — reckoner keeps no exchange rates and makes no network calls"],
    ],
  },
  {
    title: "Time",
    rows: [
      ["9:30am + 3h 45m", "clock in, clock out"],
      ["11h 20m - 5h 5m", "after an hour value, m means minutes"],
      ["3 h in min", "durations convert like any unit"],
    ],
  },
  {
    title: "Rates",
    rows: [
      ["$18 / 2.5 h", "$7.20/h"],
      ["62 mph * 3.5 h", "rate × time = distance"],
      ["$4,000 per mo * 6 mo", "per builds a rate"],
      ["300 mi / 25 mpg", "12 gal"],
    ],
  },
  {
    title: "Lists",
    rows: [
      ["sum", "adds the lines above, up to a blank line"],
      ["avg", "same lines, averaged"],
      ["total", "adds every sum above — a grand total"],
      ["", "prose lines are skipped; mismatched units are left out"],
    ],
  },
  {
    title: "Sharing",
    rows: [
      ["Share", "the whole sheet is compressed into the link itself — nothing is uploaded, there is no server to upload to"],
    ],
  },
];

export default function Help({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="help-backdrop" onClick={onClose}>
      <aside
        className="help"
        role="dialog"
        aria-label="Syntax guide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-head">
          <h2>How to write it</h2>
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Close guide">
            Close
          </button>
        </div>
        <p className="help-lede">
          Every line is tried as math. If it parses, the answer appears on the
          rail; if it doesn't, it's a note. There is no wrong way to type.
        </p>
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            <dl>
              {s.rows.map(([ex, note], i) => (
                <div key={i} className="help-row">
                  {ex ? <dt>{ex}</dt> : <dt className="mute">·</dt>}
                  <dd>{note}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="help-foot">
          reckoner is free software (AGPL-3.0). Sheets live in this browser's
          local storage and nowhere else.
        </p>
      </aside>
    </div>
  );
}
