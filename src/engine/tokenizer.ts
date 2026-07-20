// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { Atom, CompoundPreset, CUR_SYMBOLS, lookupAtom, lookupCompound } from "./units";

export type TokKind =
  | "num" // numeric literal (magnitude suffixes already applied)
  | "clock" // hh:mm[:ss][am|pm] or bare 9am / 12pm — value in seconds
  | "op" // + - * / ^ =
  | "lparen"
  | "rparen"
  | "comma"
  | "pct" // %
  | "unit" // a unit atom
  | "compound" // preset compound unit (mph, km/h shorthand words)
  | "cursym" // currency symbol prefix ($ € £ ¥)
  | "kw" // of off on in to as per sum total avg average prev ans last
  | "func" // sqrt abs round floor ceil min max
  | "ident" // variable name (incl. pi / e constants, resolved later)
  | "junk"; // anything unrecognized → the whole line is prose

export interface Tok {
  kind: TokKind;
  text: string;
  n?: number;
  atom?: Atom;
  comp?: CompoundPreset;
}

const KEYWORDS = new Set([
  "of",
  "off",
  "on",
  "in",
  "to",
  "as",
  "per",
  "sum",
  "total",
  "avg",
  "average",
  "prev",
  "ans",
  "last",
]);

const FUNCS = new Set(["sqrt", "abs", "round", "floor", "ceil", "min", "max"]);

export const RESERVED = new Set<string>([...KEYWORDS, ...FUNCS, "pi", "e"]);

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => /[A-Za-z_]/.test(c);

/**
 * Tokenize one line. Returns null when the line contains anything reckoner
 * doesn't understand — the caller then treats the whole line as prose.
 */
export function tokenize(line: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  const src = line;

  const push = (t: Tok) => toks.push(t);

  while (i < src.length) {
    const c = src[i];

    // whitespace
    if (c === " " || c === "\t") {
      i++;
      continue;
    }

    // comments: rest of line is ignored
    if (c === "#" || (c === "/" && src[i + 1] === "/")) break;

    // clock literal: 1-2 digits ':' 2 digits [':' 2 digits] [am|pm]
    const clockM = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/.exec(
      src.slice(i),
    );
    if (clockM && !isDigit(src[i + clockM[0].length] ?? "")) {
      let hh = parseInt(clockM[1], 10);
      const mm = parseInt(clockM[2], 10);
      const ss = clockM[3] ? parseInt(clockM[3], 10) : 0;
      const ap = clockM[4]?.toLowerCase();
      if (mm < 60 && ss < 60) {
        if (ap === "am" && hh === 12) hh = 0;
        if (ap === "pm" && hh < 12) hh += 12;
        push({ kind: "clock", text: clockM[0], n: hh * 3600 + mm * 60 + ss });
        i += clockM[0].length;
        continue;
      }
    }

    // number: 1,234.56 | 1234 | .5 | 1e6, with optional magnitude suffix k/K/M/B
    const numM =
      /^(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(
        src.slice(i),
      );
    if (numM) {
      let text = numM[0];
      let n = parseFloat(text.replace(/,/g, ""));
      let j = i + text.length;

      // bare "9am" / "12pm"
      const apM = /^(am|pm|AM|PM)\b/.exec(src.slice(j));
      if (apM && Number.isInteger(n) && n >= 1 && n <= 12) {
        let hh = n;
        const ap = apM[1].toLowerCase();
        if (ap === "am" && hh === 12) hh = 0;
        if (ap === "pm" && hh < 12) hh += 12;
        push({ kind: "clock", text: text + apM[1], n: hh * 3600 });
        i = j + apM[1].length;
        continue;
      }

      // attached letters: unit (5kg, 3h) or magnitude (5k, 2M, 1.5B)
      let run = "";
      let k = j;
      while (k < src.length && isAlpha(src[k])) run += src[k++];
      if (run.length > 0) {
        const atom = lookupAtom(run);
        const comp = lookupCompound(run);
        if (atom || comp) {
          push({ kind: "num", text, n });
          if (comp) push({ kind: "compound", text: run, comp });
          else push({ kind: "unit", text: run, atom: atom! });
          i = k;
          continue;
        }
        if (run.length === 1 && "kKMB".includes(run)) {
          const scale = run === "M" ? 1e6 : run === "B" ? 1e9 : 1e3;
          n *= scale;
          push({ kind: "num", text: text + run, n });
          i = k;
          continue;
        }
        // attached word that isn't a unit ("3x") → not reckoner math
        return null;
      }

      push({ kind: "num", text, n });
      i = j;

      // feet / inch tick marks: 5'10"
      if (src[i] === "'") {
        push({ kind: "unit", text: "'", atom: lookupAtom("'")! });
        i++;
        continue;
      }
      if (src[i] === '"') {
        push({ kind: "unit", text: '"', atom: lookupAtom('"')! });
        i++;
        continue;
      }
      continue;
    }

    // degree-prefixed temperature units
    if (c === "°") {
      const two = src.slice(i, i + 2);
      const atom = lookupAtom(two);
      if (atom) {
        push({ kind: "unit", text: two, atom });
        i += 2;
        continue;
      }
      return null;
    }

    // currency symbols
    if (CUR_SYMBOLS[c]) {
      push({ kind: "cursym", text: c, atom: CUR_SYMBOLS[c] });
      i++;
      continue;
    }

    // operators & punctuation
    if ("+-*/^()=,".includes(c) || c === "×" || c === "÷" || c === "−") {
      const map: Record<string, string> = { "×": "*", "÷": "/", "−": "-" };
      const op = map[c] ?? c;
      if (op === "(") push({ kind: "lparen", text: op });
      else if (op === ")") push({ kind: "rparen", text: op });
      else if (op === ",") push({ kind: "comma", text: op });
      else push({ kind: "op", text: op });
      i++;
      continue;
    }

    if (c === "%") {
      push({ kind: "pct", text: "%" });
      i++;
      continue;
    }

    // words: keyword / function / unit / identifier
    if (isAlpha(c)) {
      let word = "";
      let k = i;
      while (k < src.length && /[A-Za-z0-9_]/.test(src[k])) word += src[k++];

      const lower = word.toLowerCase();
      if (FUNCS.has(lower)) {
        // min/max are also units-ish words; treat as function only before "("
        let p = k;
        while (src[p] === " ") p++;
        if (src[p] === "(") {
          push({ kind: "func", text: lower });
          i = k;
          continue;
        }
      }
      if (KEYWORDS.has(lower) && lower !== "in") {
        push({ kind: "kw", text: lower });
        i = k;
        continue;
      }
      if (lower === "in") {
        // "in" is resolved to inches vs conversion-keyword by the parser
        push({ kind: "kw", text: "in" });
        i = k;
        continue;
      }
      const atom = lookupAtom(word);
      if (atom) {
        push({ kind: "unit", text: word, atom });
        i = k;
        continue;
      }
      const comp = lookupCompound(word);
      if (comp) {
        push({ kind: "compound", text: word, comp });
        i = k;
        continue;
      }
      push({ kind: "ident", text: word });
      i = k;
      continue;
    }

    // anything else: the line is prose
    return null;
  }

  return toks;
}
