// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { evalLine, LineOut, Val } from "./evaluator";
import { formatVal, fullPrecision } from "./formatter";

export type { LineOut, Val };
export { formatVal, fullPrecision };

export const ENGINE_VERSION = "1.0.0";

/**
 * Evaluate a whole sheet. Lines are processed top to bottom; variables flow
 * downward; sum / total / avg / prev see the lines above them.
 */
export function evaluateSheet(text: string): LineOut[] {
  const lines = text.split("\n");
  const env = new Map<string, Val>();
  const results: LineOut[] = [];

  for (let i = 0; i < lines.length; i++) {
    const r = evalLine(lines[i], env, results, i);
    const out: LineOut = { kind: r.kind, val: r.val, agg: r.agg, aggKind: r.aggKind, error: r.error };
    if (r.kind === "value" && r.val) {
      out.display = formatVal(r.val);
      out.full = fullPrecision(r.val);
    }
    results.push(out);
  }
  return results;
}
