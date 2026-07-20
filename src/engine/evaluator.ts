// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { Tok, tokenize, RESERVED } from "./tokenizer";
import { Atom, ATOMS, CompoundPreset, convertTemp } from "./units";

/**
 * A value. `n` is stored in base units of the numerator dimension divided by
 * base units of the denominator dimension (temperatures store face values and
 * only allow same-atom arithmetic plus explicit conversion). `num`/`den` keep
 * the display atoms the person wrote, so answers come back in their units.
 */
export interface Val {
  n: number;
  num: Atom | null;
  den: Atom | null;
  pct?: boolean; // n is a fraction (0.18 for 18%)
  clock?: boolean; // came from a clock literal → format as h:mm
}

export class EvalError extends Error {}
class ParseFail extends Error {}

const scalar = (n: number): Val => ({ n, num: null, den: null });

function dimName(v: Val): string {
  if (v.pct) return "%";
  if (!v.num && !v.den) return "number";
  const n = v.num ? v.num.label : "1";
  return v.den ? `${n}/${v.den.label}` : n;
}

function sameShape(a: Val, b: Val): boolean {
  const ad = a.num?.dim ?? null;
  const bd = b.num?.dim ?? null;
  const ade = a.den?.dim ?? null;
  const bde = b.den?.dim ?? null;
  if (ad !== bd || ade !== bde) return false;
  if (ad === "currency" && a.num!.code !== b.num!.code) return false;
  if (ade === "currency" && a.den!.code !== b.den!.code) return false;
  if (ad === "temp" && a.num!.id !== b.num!.id) return false;
  return true;
}

function assertFinite(n: number): number {
  if (!Number.isFinite(n)) throw new EvalError("result is out of range");
  return n;
}

// ---- arithmetic on Vals -----------------------------------------------------

function addVals(a: Val, b: Val, sign: 1 | -1): Val {
  // percent on the right of +/-: grow or shrink the left value
  if (b.pct && !a.pct) {
    return { ...a, n: assertFinite(a.n * (1 + sign * b.n)) };
  }
  if (a.pct && b.pct) {
    return { n: assertFinite(a.n + sign * b.n), num: null, den: null, pct: true };
  }
  if (a.pct !== b.pct) {
    throw new EvalError("can't mix a percentage with a plain value here");
  }
  if (!sameShape(a, b)) {
    throw new EvalError(
      a.num?.dim === "currency" && b.num?.dim === "currency"
        ? "no exchange rates — reckoner is offline by design"
        : `can't add ${dimName(a)} and ${dimName(b)}`,
    );
  }
  return {
    n: assertFinite(a.n + sign * b.n),
    num: a.num,
    den: a.den,
    clock: a.clock || b.clock,
  };
}

function mulVals(a: Val, b: Val): Val {
  if (a.pct || b.pct) {
    const p = a.pct ? a : b;
    const v = a.pct ? b : a;
    if (p.pct && v.pct)
      return { n: assertFinite(p.n * v.n), num: null, den: null, pct: true };
    return { ...v, n: assertFinite(v.n * p.n) };
  }
  const aPlain = !a.num && !a.den;
  const bPlain = !b.num && !b.den;
  if (aPlain && bPlain) return scalar(assertFinite(a.n * b.n));
  if (aPlain) return { ...b, n: assertFinite(a.n * b.n) };
  if (bPlain) return { ...a, n: assertFinite(a.n * b.n) };

  // rate × quantity → quantity (in the rate's numerator unit)
  const rateTimesQty = (rate: Val, qty: Val): Val | null => {
    if (rate.num && rate.den && qty.num && !qty.den && qty.num.dim === rate.den.dim) {
      if (rate.den.dim === "temp" || qty.num.dim === "temp") return null;
      return { n: assertFinite(rate.n * qty.n), num: rate.num, den: null };
    }
    return null;
  };
  const r1 = rateTimesQty(a, b) ?? rateTimesQty(b, a);
  if (r1) return r1;

  throw new EvalError(`can't multiply ${dimName(a)} by ${dimName(b)}`);
}

function divVals(a: Val, b: Val): Val {
  if (b.n === 0) throw new EvalError("division by zero");
  if (b.pct) {
    if (a.pct)
      return { n: assertFinite(a.n / b.n), num: null, den: null, pct: false };
    return { ...a, n: assertFinite(a.n / b.n) };
  }
  if (a.pct) throw new EvalError("can't divide a percentage by that");

  const aPlain = !a.num && !a.den;
  const bPlain = !b.num && !b.den;
  if (bPlain) return { ...a, n: assertFinite(a.n / b.n) };
  if (a.num?.dim === "temp" || b.num?.dim === "temp")
    throw new EvalError("temperatures only convert; they don't divide");

  // qty ÷ qty of same dimension → plain ratio
  if (a.num && !a.den && b.num && !b.den && a.num.dim === b.num.dim) {
    if (a.num.dim === "currency" && a.num.code !== b.num.code)
      throw new EvalError("no exchange rates — reckoner is offline by design");
    return scalar(assertFinite(a.n / b.n));
  }
  // qty ÷ qty of another dimension → rate
  if (a.num && !a.den && b.num && !b.den) {
    return { n: assertFinite(a.n / b.n), num: a.num, den: b.num };
  }
  // rate ÷ rate, same shape → ratio
  if (a.num && a.den && b.num && b.den && sameShape(a, b)) {
    return scalar(assertFinite(a.n / b.n));
  }
  // quantity ÷ rate with matching numerator → denominator quantity
  // (300 mi ÷ 25 mi/gal = 12 gal)
  if (a.num && !a.den && b.num && b.den && a.num.dim === b.num.dim) {
    if (a.num.dim === "currency" && a.num.code !== b.num.code)
      throw new EvalError("no exchange rates — reckoner is offline by design");
    return { n: assertFinite(a.n / b.n), num: b.den, den: null };
  }
  // plain ÷ rate → flipped rate
  if (aPlain && b.num && b.den) {
    return { n: assertFinite(a.n / b.n), num: b.den, den: b.num };
  }
  throw new EvalError(`can't divide ${dimName(a)} by ${dimName(b)}`);
}

function convertVal(v: Val, num: Atom, den: Atom | null): Val {
  if (v.pct) throw new EvalError("percentages don't convert to units");
  if (!v.num) throw new EvalError(`that's a plain number — nothing to convert to ${num.label}`);

  if (v.num.dim === "temp" || num.dim === "temp") {
    if (v.num.dim !== "temp" || num.dim !== "temp" || v.den || den)
      throw new EvalError(`can't convert ${dimName(v)} to ${num.label}`);
    return { n: assertFinite(convertTemp(v.n, v.num, num)), num, den: null };
  }
  if (v.num.dim === "currency" || num.dim === "currency") {
    if (v.num.dim !== num.dim || v.num.code !== num.code)
      throw new EvalError("no exchange rates — reckoner is offline by design");
  }
  if ((v.den === null) !== (den === null))
    throw new EvalError(`can't convert ${dimName(v)} to ${den ? num.label + "/" + den.label : num.label}`);
  if (v.num.dim !== num.dim || (v.den && den && v.den.dim !== den.dim))
    throw new EvalError(`can't convert ${dimName(v)} to ${den ? num.label + "/" + den.label : num.label}`);
  return { n: v.n, num, den };
}

// ---- aggregates over previous lines ----------------------------------------

export type LineKind = "blank" | "text" | "value" | "error";

export interface LineOut {
  kind: LineKind;
  val?: Val;
  agg?: boolean; // produced by sum/total/avg
  aggKind?: "sum" | "avg" | "total";
  display?: string;
  full?: string;
  error?: string;
}

function collectAbove(results: LineOut[], upto: number): Val[] {
  const vals: Val[] = [];
  let shape: Val | null = null;
  for (let j = upto - 1; j >= 0; j--) {
    const r = results[j];
    if (r.kind === "blank") break;
    if (r.kind === "text" || r.kind === "error") continue;
    if (r.agg) {
      if (vals.length === 0) continue; // an agg directly above: skip past it
      break; // section boundary
    }
    const v = r.val!;
    if (v.pct || v.den) continue; // percentages and rates don't sum
    if (!shape) {
      shape = v;
      vals.push(v);
    } else if (sameShape(shape, v)) {
      vals.push(v);
    }
  }
  return vals;
}

function aggValue(kind: string, results: LineOut[], upto: number): Val {
  if (kind === "prev" || kind === "ans" || kind === "last") {
    for (let j = upto - 1; j >= 0; j--) {
      const r = results[j];
      if (r.kind === "value") return r.val!;
      if (r.kind === "blank") continue;
    }
    throw new EvalError("no previous answer yet");
  }
  if (kind === "total") {
    const sums: Val[] = [];
    for (let j = upto - 1; j >= 0; j--) {
      const r = results[j];
      if (r.kind === "value" && r.aggKind === "sum" && !r.val!.pct) sums.push(r.val!);
    }
    const usable = sums.filter((v, _, arr) => sameShape(v, arr[0]));
    if (usable.length > 0) {
      const n = usable.reduce((acc, v) => acc + v.n, 0);
      return { n: assertFinite(n), num: usable[0].num, den: usable[0].den };
    }
    // fall through: behaves like sum
  }
  const vals = collectAbove(results, upto);
  if (vals.length === 0) throw new EvalError("nothing above to add up");
  const n = vals.reduce((acc, v) => acc + v.n, 0);
  const base: Val = { n: assertFinite(n), num: vals[0].num, den: vals[0].den };
  if (kind === "avg" || kind === "average") {
    return { ...base, n: assertFinite(n / vals.length) };
  }
  return base;
}

// ---- parser (direct evaluation) ---------------------------------------------

interface Ctx {
  toks: Tok[];
  i: number;
  env: Map<string, Val>;
  results: LineOut[];
  line: number;
}

const peek = (c: Ctx, k = 0): Tok | undefined => c.toks[c.i + k];
const next = (c: Ctx): Tok => {
  const t = c.toks[c.i++];
  if (!t) throw new ParseFail("unexpected end");
  return t;
};
const atEnd = (c: Ctx) => c.i >= c.toks.length;

function isKw(t: Tok | undefined, w: string): boolean {
  return !!t && t.kind === "kw" && t.text === w;
}

/** Decide whether a `kw:in` token means the inch unit here. */
function inMeansInches(c: Ctx): boolean {
  const nxt = peek(c, 1);
  if (!nxt) return true; // trailing "5 ft 3 in"
  if (isKw(nxt, "in") || isKw(nxt, "to")) return true; // "2 in in cm"
  if (nxt.kind === "unit" || nxt.kind === "compound" || nxt.kind === "cursym")
    return false; // "72 in cm" reads as a conversion
  return true;
}

function makeQty(n: number, atom: Atom): Val {
  if (atom.dim === "scalar") return scalar(n * atom.factor); // dozen
  if (atom.dim === "temp") return { n, num: atom, den: null };
  return { n: n * atom.factor, num: atom, den: null };
}

/** Parse a unit spec: atom [ '/' atom ] or a compound preset. */
function parseUnitSpec(c: Ctx): { num: Atom; den: Atom | null } | null {
  const t = peek(c);
  if (!t) return null;
  if (t.kind === "compound") {
    next(c);
    return { num: t.comp!.num, den: t.comp!.den };
  }
  let numAtom: Atom | null = null;
  if (t.kind === "unit") {
    next(c);
    numAtom = t.atom!;
  } else if (t.kind === "cursym") {
    next(c);
    numAtom = t.atom!;
  } else if (isKw(t, "in")) {
    next(c);
    numAtom = ATOMS.inch;
  } else {
    return null;
  }
  const slash = peek(c);
  if (slash && slash.kind === "op" && slash.text === "/") {
    const after = peek(c, 1);
    if (after && (after.kind === "unit" || after.kind === "compound")) {
      next(c); // '/'
      const dt = next(c);
      const den = dt.kind === "unit" ? dt.atom! : dt.comp!.num;
      return { num: numAtom, den };
    }
  }
  return { num: numAtom, den: null };
}

function parsePrimary(c: Ctx): Val {
  const t = peek(c);
  if (!t) throw new ParseFail("empty");

  // ( expr )
  if (t.kind === "lparen") {
    next(c);
    const v = parseExpr(c);
    const r = next(c);
    if (r.kind !== "rparen") throw new ParseFail("expected )");
    return v;
  }

  // function call
  if (t.kind === "func") {
    next(c);
    const l = next(c);
    if (l.kind !== "lparen") throw new ParseFail("expected (");
    const args: Val[] = [parseExpr(c)];
    while (peek(c)?.kind === "comma") {
      next(c);
      args.push(parseExpr(c));
    }
    const r = next(c);
    if (r.kind !== "rparen") throw new ParseFail("expected )");
    return applyFunc(t.text, args);
  }

  // currency symbol prefix: $12.50
  if (t.kind === "cursym") {
    next(c);
    const numTok = peek(c);
    if (!numTok || numTok.kind !== "num") throw new ParseFail("number expected after currency symbol");
    next(c);
    const v: Val = { n: numTok.n!, num: t.atom!, den: null };
    return withUnitTail(c, v, true);
  }

  // clock literal
  if (t.kind === "clock") {
    next(c);
    const v: Val = { n: t.n!, num: ATOMS.h, den: null, clock: true };
    return juxtapose(c, v);
  }

  // numeric literal, possibly followed by unit(s)
  if (t.kind === "num") {
    next(c);
    return withUnitTail(c, scalar(t.n!), false);
  }

  // identifiers & constants
  if (t.kind === "ident") {
    next(c);
    if (t.text === "pi") return scalar(Math.PI);
    if (t.text === "e") return scalar(Math.E);
    const v = c.env.get(t.text);
    if (!v) throw new ParseFail(`unknown name ${t.text}`);
    return { ...v };
  }

  // aggregates
  if (t.kind === "kw" && ["sum", "total", "avg", "average", "prev", "ans", "last"].includes(t.text)) {
    next(c);
    const v = aggValue(t.text, c.results, c.line);
    return { ...v };
  }

  throw new ParseFail(`unexpected ${t.text}`);
}

/** Attach a unit (and possible compound tail) to a bare number, then juxtapose. */
function withUnitTail(c: Ctx, v: Val, isCurrency: boolean): Val {
  const t = peek(c);
  if (!isCurrency && t) {
    if (t.kind === "unit") {
      next(c);
      v = makeQty(v.n, t.atom!);
    } else if (t.kind === "compound") {
      next(c);
      const { num, den } = t.comp!;
      v = { n: (v.n * num.factor) / den.factor, num, den };
    } else if (isKw(t, "in") && inMeansInches(c)) {
      next(c);
      v = makeQty(v.n, ATOMS.inch);
    } else if (t.kind === "cursym") {
      // 12$ style suffix
      next(c);
      v = { n: v.n, num: t.atom!, den: null };
    }
  }
  // rate written as unit/unit right after the quantity: 5 mi/h
  if (v.num && !v.den) {
    const slash = peek(c);
    const after = peek(c, 1);
    if (
      slash &&
      slash.kind === "op" &&
      slash.text === "/" &&
      after &&
      (after.kind === "unit" || after.kind === "compound")
    ) {
      next(c);
      const dt = next(c);
      const den = dt.kind === "unit" ? dt.atom! : dt.comp!.num;
      if (den.dim === "temp" || den.dim === "scalar")
        throw new EvalError(`can't make a rate per ${den.label}`);
      v = { n: v.n / den.factor, num: v.num, den };
    }
  }
  return juxtapose(c, v);
}

/**
 * Same-dimension juxtaposition: "5 ft 10 in", "3h 20m", "1 lb 4 oz".
 * In time context a bare "m" means minutes.
 */
function juxtapose(c: Ctx, v: Val): Val {
  while (true) {
    const a = peek(c);
    const b = peek(c, 1);
    if (!a || a.kind !== "num" || !b) return v;
    let atom: Atom | null = null;
    if (b.kind === "unit") atom = b.atom!;
    else if (isKw(b, "in") && v.num?.dim === "length") atom = ATOMS.inch;
    else return v;

    // reinterpret metres as minutes when the running value is a time
    if (v.num?.dim === "time" && atom.id === "m") atom = ATOMS.min;
    // reinterpret a leading "1m" as minutes when followed by seconds: 1m 30s
    if (v.num?.id === "m" && atom.dim === "time") {
      v = { n: (v.n / ATOMS.m.factor) * ATOMS.min.factor, num: ATOMS.min, den: null };
    }
    if (!v.num || v.den || v.num.dim !== atom.dim || v.num.dim === "temp") return v;
    if (v.num.dim === "currency" && v.num.code !== atom.code) return v;

    next(c); // num
    next(c); // unit-ish
    const addN = atom.dim === "currency" ? a.n! : a.n! * atom.factor;
    v = { ...v, n: v.n + addN };
  }
}

function applyFunc(name: string, args: Val[]): Val {
  const plain = (v: Val): number => {
    if (v.pct || v.num || v.den)
      throw new EvalError(`${name}() takes plain numbers`);
    return v.n;
  };
  switch (name) {
    case "sqrt": {
      const x = plain(args[0]);
      if (x < 0) throw new EvalError("sqrt of a negative number");
      return scalar(Math.sqrt(x));
    }
    case "abs": {
      const v = args[0];
      return { ...v, n: Math.abs(v.n) };
    }
    case "round": {
      const v = args[0];
      const dp = args[1] ? plain(args[1]) : 0;
      const f = 10 ** dp;
      // round in display units for quantities
      if (v.num && !v.pct) {
        const disp = v.num.dim === "temp" ? v.n : v.n / v.num.factor / (v.den ? 1 / v.den.factor : 1);
        const r = Math.round(disp * f) / f;
        const backN =
          v.num.dim === "temp" ? r : r * v.num.factor * (v.den ? 1 / v.den.factor : 1);
        return { ...v, n: assertFinite(backN) };
      }
      return { ...v, n: assertFinite(Math.round(v.n * f) / f) };
    }
    case "floor":
      return { ...args[0], n: Math.floor(args[0].n) };
    case "ceil":
      return { ...args[0], n: Math.ceil(args[0].n) };
    case "min":
    case "max": {
      let best = args[0];
      for (const v of args.slice(1)) {
        if (!sameShape(best, v) || best.pct !== v.pct)
          throw new EvalError(`${name}() needs matching units`);
        const pick = name === "min" ? v.n < best.n : v.n > best.n;
        if (pick) best = v;
      }
      return { ...best };
    }
  }
  throw new ParseFail("unknown function");
}

function parseUnary(c: Ctx): Val {
  const t = peek(c);
  if (t && t.kind === "op" && (t.text === "-" || t.text === "+")) {
    next(c);
    const v = parseUnary(c);
    return t.text === "-" ? { ...v, n: -v.n } : v;
  }
  const v = parsePrimary(c);
  return parsePostfix(c, v);
}

function parsePostfix(c: Ctx, v: Val): Val {
  let out = v;
  while (peek(c)?.kind === "pct") {
    next(c);
    if (out.num || out.den) throw new EvalError("only plain numbers become percentages");
    out = { n: out.n / 100, num: null, den: null, pct: true };
  }
  return out;
}

function parsePower(c: Ctx): Val {
  const base = parseUnary(c);
  const t = peek(c);
  if (t && t.kind === "op" && t.text === "^") {
    next(c);
    const exp = parsePower(c); // right associative
    if (base.num || base.den || base.pct || exp.num || exp.den || exp.pct)
      throw new EvalError("exponents work on plain numbers");
    return scalar(assertFinite(base.n ** exp.n));
  }
  return base;
}

function parseMul(c: Ctx): Val {
  let v = parsePower(c);
  while (true) {
    const t = peek(c);
    if (t && t.kind === "op" && (t.text === "*" || t.text === "/")) {
      next(c);
      let rhs: Val;
      const nt = peek(c);
      if (
        t.text === "/" &&
        nt &&
        (nt.kind === "unit" || nt.kind === "compound" || isKw(nt, "in"))
      ) {
        // "value / unit" → rate per one unit
        const spec = parseUnitSpec(c)!;
        rhs = spec.den
          ? { n: spec.num.factor / spec.den.factor, num: spec.num, den: spec.den }
          : makeQty(1, spec.num);
      } else {
        rhs = parsePower(c);
      }
      v = t.text === "*" ? mulVals(v, rhs) : divVals(v, rhs);
      continue;
    }
    if (isKw(t, "per")) {
      next(c);
      const nt = peek(c);
      let rhs: Val;
      if (nt && (nt.kind === "unit" || nt.kind === "compound" || isKw(nt, "in"))) {
        const spec = parseUnitSpec(c)!;
        rhs = spec.den
          ? { n: spec.num.factor / spec.den.factor, num: spec.num, den: spec.den }
          : makeQty(1, spec.num);
      } else {
        rhs = parsePower(c);
      }
      v = divVals(v, rhs);
      continue;
    }
    if (isKw(t, "of")) {
      next(c);
      const rhs = parsePower(c);
      v = mulVals(v, rhs);
      continue;
    }
    if (isKw(t, "off") || isKw(t, "on")) {
      const grow = t!.text === "on";
      next(c);
      const rhs = parsePower(c);
      if (!v.pct) throw new EvalError(`"${t!.text}" needs a percentage on the left`);
      v = { ...rhs, n: assertFinite(rhs.n * (1 + (grow ? 1 : -1) * v.n)) };
      continue;
    }
    break;
  }
  return v;
}

function parseAdd(c: Ctx): Val {
  let v = parseMul(c);
  while (true) {
    const t = peek(c);
    if (t && t.kind === "op" && (t.text === "+" || t.text === "-")) {
      next(c);
      const rhs = parseMul(c);
      v = addVals(v, rhs, t.text === "+" ? 1 : -1);
      continue;
    }
    break;
  }
  return v;
}

function parseExpr(c: Ctx): Val {
  let v = parseAdd(c);
  while (true) {
    const t = peek(c);
    // "X as % of Y"
    if (isKw(t, "as") && peek(c, 1)?.kind === "pct" && isKw(peek(c, 2), "of")) {
      next(c);
      next(c);
      next(c);
      const rhs = parseAdd(c);
      if (v.pct || rhs.pct) throw new EvalError("that's already a percentage");
      if (!sameShape(v, rhs)) throw new EvalError(`can't compare ${dimName(v)} with ${dimName(rhs)}`);
      if (rhs.n === 0) throw new EvalError("division by zero");
      v = { n: assertFinite(v.n / rhs.n), num: null, den: null, pct: true };
      continue;
    }
    // conversions: "expr in unit", "expr to unit"
    if (isKw(t, "to") || (isKw(t, "in") && peek(c, 1) !== undefined)) {
      const save = c.i;
      next(c);
      const spec = parseUnitSpec(c);
      if (spec) {
        v = convertVal(v, spec.num, spec.den);
        continue;
      }
      c.i = save;
      break;
    }
    break;
  }
  return v;
}

// ---- line & sheet evaluation -------------------------------------------------

export interface EvalLineResult {
  kind: LineKind;
  val?: Val;
  agg?: boolean;
  aggKind?: "sum" | "avg" | "total";
  error?: string;
}

function aggKindOf(toks: Tok[]): "sum" | "avg" | "total" | undefined {
  let kind: "sum" | "avg" | "total" | undefined;
  for (const t of toks) {
    if (t.kind !== "kw") continue;
    if (t.text === "sum") return "sum";
    if (t.text === "total") kind = kind ?? "total";
    if (t.text === "avg" || t.text === "average") kind = kind ?? "avg";
  }
  return kind;
}

export function evalLine(
  raw: string,
  env: Map<string, Val>,
  results: LineOut[],
  line: number,
): EvalLineResult {
  if (raw.trim().length === 0) return { kind: "blank" };
  const toks = tokenize(raw);
  if (toks === null || toks.length === 0) return { kind: "text" };

  const c: Ctx = { toks, i: 0, env, results, line };
  try {
    // assignment?
    let v: Val;
    if (
      toks.length >= 3 &&
      toks[0].kind === "ident" &&
      toks[1].kind === "op" &&
      toks[1].text === "=" &&
      !RESERVED.has(toks[0].text)
    ) {
      c.i = 2;
      v = parseExpr(c);
      if (!atEnd(c)) throw new ParseFail("trailing input");
      if (!Number.isFinite(v.n)) return { kind: "text" };
      env.set(toks[0].text, v);
    } else {
      v = parseExpr(c);
      if (!atEnd(c)) throw new ParseFail("trailing input");
    }
    if (!Number.isFinite(v.n)) return { kind: "text" };
    const ak = aggKindOf(toks);
    return { kind: "value", val: v, agg: ak !== undefined, aggKind: ak };
  } catch (err) {
    if (err instanceof EvalError) return { kind: "error", error: err.message };
    return { kind: "text" }; // ParseFail or anything else → prose
  }
}
