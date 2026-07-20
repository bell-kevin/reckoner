// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

/** Physical / logical dimensions. Each atom converts to a base unit of its dimension. */
export type Dim =
  | "scalar"
  | "length"
  | "mass"
  | "volume"
  | "temp"
  | "time"
  | "data"
  | "area"
  | "currency";

export interface Atom {
  id: string;
  dim: Dim;
  /** Multiplier to the dimension's base unit (metre, kg, litre, second, byte, m², face-value for temp/currency). */
  factor: number;
  /** Short label used when formatting results. */
  label: string;
  /** Currency symbol, when the atom is a symbol-prefixed currency. */
  sym?: string;
  /** ISO-ish currency code; currencies only add/convert within the same code (offline by design). */
  code?: string;
}

/** A preset compound unit, e.g. mph → mi/h. */
export interface CompoundPreset {
  num: Atom;
  den: Atom;
}

const A = (
  id: string,
  dim: Dim,
  factor: number,
  label: string,
  extra?: Partial<Atom>,
): Atom => ({ id, dim, factor, label, ...extra });

// ---- Atom definitions -------------------------------------------------------

export const ATOMS = {
  // length (base: metre)
  mm: A("mm", "length", 0.001, "mm"),
  cm: A("cm", "length", 0.01, "cm"),
  m: A("m", "length", 1, "m"),
  km: A("km", "length", 1000, "km"),
  inch: A("inch", "length", 0.0254, "in"),
  ft: A("ft", "length", 0.3048, "ft"),
  yd: A("yd", "length", 0.9144, "yd"),
  mi: A("mi", "length", 1609.344, "mi"),

  // mass (base: kg)
  mg: A("mg", "mass", 1e-6, "mg"),
  g: A("g", "mass", 0.001, "g"),
  kg: A("kg", "mass", 1, "kg"),
  oz: A("oz", "mass", 0.028349523125, "oz"),
  lb: A("lb", "mass", 0.45359237, "lb"),
  ton: A("ton", "mass", 907.18474, "ton"),

  // volume (base: litre)
  ml: A("ml", "volume", 0.001, "ml"),
  l: A("l", "volume", 1, "L"),
  tsp: A("tsp", "volume", 0.00492892159375, "tsp"),
  tbsp: A("tbsp", "volume", 0.01478676478125, "tbsp"),
  cup: A("cup", "volume", 0.2365882365, "cup"),
  floz: A("floz", "volume", 0.0295735295625, "fl oz"),
  pt: A("pt", "volume", 0.473176473, "pt"),
  qt: A("qt", "volume", 0.946352946, "qt"),
  gal: A("gal", "volume", 3.785411784, "gal"),

  // temperature (face-value storage; conversions handled specially)
  C: A("C", "temp", 1, "°C"),
  F: A("F", "temp", 1, "°F"),
  K: A("K", "temp", 1, "K"),

  // time (base: second)
  s: A("s", "time", 1, "s"),
  min: A("min", "time", 60, "min"),
  h: A("h", "time", 3600, "h"),
  day: A("day", "time", 86400, "days"),
  week: A("week", "time", 604800, "weeks"),
  mo: A("mo", "time", 2629746, "mo"), // mean Gregorian month
  yr: A("yr", "time", 31556952, "yr"), // mean Gregorian year

  // data (base: byte; decimal SI prefixes, binary IEC prefixes)
  byte: A("byte", "data", 1, "bytes"),
  KBd: A("KBd", "data", 1e3, "KB"),
  MBd: A("MBd", "data", 1e6, "MB"),
  GBd: A("GBd", "data", 1e9, "GB"),
  TBd: A("TBd", "data", 1e12, "TB"),
  KiB: A("KiB", "data", 1024, "KiB"),
  MiB: A("MiB", "data", 1024 ** 2, "MiB"),
  GiB: A("GiB", "data", 1024 ** 3, "GiB"),
  TiB: A("TiB", "data", 1024 ** 4, "TiB"),

  // area (base: m²)
  sqm: A("sqm", "area", 1, "m²"),
  sqft: A("sqft", "area", 0.09290304, "sq ft"),
  acre: A("acre", "area", 4046.8564224, "acres"),

  // dimensionless multipliers
  dozen: A("dozen", "scalar", 12, "dozen"),

  // currencies (no cross-currency conversion — reckoner is offline by design)
  USD: A("USD", "currency", 1, "USD", { sym: "$", code: "USD" }),
  EUR: A("EUR", "currency", 1, "EUR", { sym: "€", code: "EUR" }),
  GBP: A("GBP", "currency", 1, "GBP", { sym: "£", code: "GBP" }),
  JPY: A("JPY", "currency", 1, "JPY", { sym: "¥", code: "JPY" }),
  CAD: A("CAD", "currency", 1, "CAD", { code: "CAD" }),
  AUD: A("AUD", "currency", 1, "AUD", { code: "AUD" }),
  CHF: A("CHF", "currency", 1, "CHF", { code: "CHF" }),
  CNY: A("CNY", "currency", 1, "CNY", { code: "CNY" }),
  INR: A("INR", "currency", 1, "INR", { code: "INR" }),
  MXN: A("MXN", "currency", 1, "MXN", { code: "MXN" }),
  BRL: A("BRL", "currency", 1, "BRL", { code: "BRL" }),
  KRW: A("KRW", "currency", 1, "KRW", { code: "KRW" }),
} as const;

export type AtomId = keyof typeof ATOMS;

// ---- Alias tables -----------------------------------------------------------

/** Case-sensitive aliases (single letters and case-significant symbols). */
const EXACT: Record<string, Atom> = {
  m: ATOMS.m,
  s: ATOMS.s,
  h: ATOMS.h,
  d: ATOMS.day,
  g: ATOMS.g,
  l: ATOMS.l,
  L: ATOMS.l,
  C: ATOMS.C,
  F: ATOMS.F,
  "°C": ATOMS.C,
  "°F": ATOMS.F,
  "'": ATOMS.ft,
  '"': ATOMS.inch,
};

/** Case-insensitive aliases (looked up lowercased). */
const LOOSE: Record<string, Atom> = {
  mm: ATOMS.mm,
  cm: ATOMS.cm,
  km: ATOMS.km,
  meter: ATOMS.m,
  meters: ATOMS.m,
  metre: ATOMS.m,
  metres: ATOMS.m,
  inch: ATOMS.inch,
  inches: ATOMS.inch,
  ft: ATOMS.ft,
  foot: ATOMS.ft,
  feet: ATOMS.ft,
  yd: ATOMS.yd,
  yard: ATOMS.yd,
  yards: ATOMS.yd,
  mi: ATOMS.mi,
  mile: ATOMS.mi,
  miles: ATOMS.mi,

  mg: ATOMS.mg,
  gram: ATOMS.g,
  grams: ATOMS.g,
  kg: ATOMS.kg,
  kgs: ATOMS.kg,
  kilo: ATOMS.kg,
  kilos: ATOMS.kg,
  oz: ATOMS.oz,
  ounce: ATOMS.oz,
  ounces: ATOMS.oz,
  lb: ATOMS.lb,
  lbs: ATOMS.lb,
  pound: ATOMS.lb,
  pounds: ATOMS.lb,
  ton: ATOMS.ton,
  tons: ATOMS.ton,

  ml: ATOMS.ml,
  liter: ATOMS.l,
  liters: ATOMS.l,
  litre: ATOMS.l,
  litres: ATOMS.l,
  tsp: ATOMS.tsp,
  tbsp: ATOMS.tbsp,
  cup: ATOMS.cup,
  cups: ATOMS.cup,
  floz: ATOMS.floz,
  pt: ATOMS.pt,
  pint: ATOMS.pt,
  pints: ATOMS.pt,
  qt: ATOMS.qt,
  quart: ATOMS.qt,
  quarts: ATOMS.qt,
  gal: ATOMS.gal,
  gallon: ATOMS.gal,
  gallons: ATOMS.gal,

  celsius: ATOMS.C,
  fahrenheit: ATOMS.F,
  kelvin: ATOMS.K,

  sec: ATOMS.s,
  secs: ATOMS.s,
  second: ATOMS.s,
  seconds: ATOMS.s,
  min: ATOMS.min,
  mins: ATOMS.min,
  minute: ATOMS.min,
  minutes: ATOMS.min,
  hr: ATOMS.h,
  hrs: ATOMS.h,
  hour: ATOMS.h,
  hours: ATOMS.h,
  day: ATOMS.day,
  days: ATOMS.day,
  week: ATOMS.week,
  weeks: ATOMS.week,
  wk: ATOMS.week,
  wks: ATOMS.week,
  mo: ATOMS.mo,
  month: ATOMS.mo,
  months: ATOMS.mo,
  yr: ATOMS.yr,
  yrs: ATOMS.yr,
  year: ATOMS.yr,
  years: ATOMS.yr,

  byte: ATOMS.byte,
  bytes: ATOMS.byte,
  kb: ATOMS.KBd,
  mb: ATOMS.MBd,
  gb: ATOMS.GBd,
  tb: ATOMS.TBd,
  kib: ATOMS.KiB,
  mib: ATOMS.MiB,
  gib: ATOMS.GiB,
  tib: ATOMS.TiB,

  sqm: ATOMS.sqm,
  sqft: ATOMS.sqft,
  acre: ATOMS.acre,
  acres: ATOMS.acre,

  dozen: ATOMS.dozen,

  usd: ATOMS.USD,
  eur: ATOMS.EUR,
  euro: ATOMS.EUR,
  euros: ATOMS.EUR,
  gbp: ATOMS.GBP,
  jpy: ATOMS.JPY,
  yen: ATOMS.JPY,
  cad: ATOMS.CAD,
  aud: ATOMS.AUD,
  chf: ATOMS.CHF,
  cny: ATOMS.CNY,
  inr: ATOMS.INR,
  mxn: ATOMS.MXN,
  brl: ATOMS.BRL,
  krw: ATOMS.KRW,
  dollar: ATOMS.USD,
  dollars: ATOMS.USD,
};

/** Currency symbols that prefix a number, e.g. "$12.50". */
export const CUR_SYMBOLS: Record<string, Atom> = {
  $: ATOMS.USD,
  "€": ATOMS.EUR,
  "£": ATOMS.GBP,
  "¥": ATOMS.JPY,
};

/** Compound presets, looked up case-insensitively. */
const COMPOUNDS: Record<string, CompoundPreset> = {
  mph: { num: ATOMS.mi, den: ATOMS.h },
  kph: { num: ATOMS.km, den: ATOMS.h },
  kmh: { num: ATOMS.km, den: ATOMS.h },
  mpg: { num: ATOMS.mi, den: ATOMS.gal },
};

export function lookupAtom(word: string): Atom | null {
  if (Object.prototype.hasOwnProperty.call(EXACT, word)) return EXACT[word];
  const lower = word.toLowerCase();
  if (word.length >= 2 && Object.prototype.hasOwnProperty.call(LOOSE, lower)) {
    return LOOSE[lower];
  }
  return null;
}

export function lookupCompound(word: string): CompoundPreset | null {
  const lower = word.toLowerCase();
  return Object.prototype.hasOwnProperty.call(COMPOUNDS, lower)
    ? COMPOUNDS[lower]
    : null;
}

/** True when the word is a unit, currency code, or compound preset. */
export function isUnitWord(word: string): boolean {
  return lookupAtom(word) !== null || lookupCompound(word) !== null;
}

/** Temperature conversion via face values. */
export function convertTemp(n: number, from: Atom, to: Atom): number {
  if (from.id === to.id) return n;
  // to Celsius first
  let c: number;
  if (from.id === "C") c = n;
  else if (from.id === "F") c = ((n - 32) * 5) / 9;
  else c = n - 273.15; // K
  if (to.id === "C") return c;
  if (to.id === "F") return (c * 9) / 5 + 32;
  return c + 273.15; // K
}
