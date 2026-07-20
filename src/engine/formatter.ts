// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { Val } from "./evaluator";
import { Atom, ATOMS } from "./units";

/** Displayed magnitude of a value, in its own display units. */
export function displayNumber(v: Val): number {
  if (v.pct) return v.n * 100;
  if (!v.num) return v.n;
  if (v.num.dim === "temp") return v.n;
  const numF = v.num.factor;
  const denF = v.den ? v.den.factor : 1;
  return (v.n / numF) * denF;
}

function group(n: number, maxDp: number, minDp = 0): string {
  if (!Number.isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-4)) {
    return n.toExponential(4).replace(/(\.\d*?)0+e/, "$1e").replace(/\.e/, "e");
  }
  const rounded = Number(n.toFixed(maxDp));
  if (rounded === 0 && n !== 0) {
    return Number(n.toPrecision(3)).toString();
  }
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: minDp,
    maximumFractionDigits: maxDp,
  });
}

function unitLabel(atom: Atom, magnitude: number): string {
  const singulars: Record<string, string> = {
    days: "day",
    weeks: "week",
    acres: "acre",
    bytes: "byte",
  };
  if (Math.abs(magnitude) === 1 && singulars[atom.label]) return singulars[atom.label];
  return atom.label;
}

function fmtClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const totalMin = Math.round(Math.abs(seconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

/** Pretty compound durations: 3 h 45 min, 2 days 6 h, 1 min 30 s. */
function fmtDuration(v: Val): string {
  const atom = v.num!;
  const sign = v.n < 0 ? "-" : "";
  const abs = Math.abs(v.n); // seconds
  const disp = abs / atom.factor;

  const compound = (
    bigF: number,
    bigL: string,
    bigLs: string,
    smallF: number,
    smallL: string,
  ): string => {
    const big = Math.floor(abs / bigF);
    const small = Math.round((abs - big * bigF) / smallF);
    if (small === 0) return `${sign}${group(big, 0)} ${big === 1 ? bigL : bigLs}`;
    if (big === 0) return `${sign}${group(small, 0)} ${smallL}`;
    return `${sign}${group(big, 0)} ${big === 1 ? bigL : bigLs} ${group(small, 0)} ${smallL}`;
  };

  if (Number.isInteger(Number(disp.toFixed(6)))) {
    const whole = Math.round(disp);
    return `${sign}${group(whole, 0)} ${unitLabel(atom, whole)}`;
  }
  if (atom.id === "h") return compound(3600, "h", "h", 60, "min");
  if (atom.id === "min") return compound(60, "min", "min", 1, "s");
  if (atom.id === "day") return compound(86400, "day", "days", 3600, "h");
  return `${sign}${group(disp, 2)} ${atom.label}`;
}

function fmtMoney(atom: Atom, n: number): string {
  const body = group(Math.abs(n), 2, 2);
  const sign = n < 0 ? "-" : "";
  if (atom.sym) return `${sign}${atom.sym}${body}`;
  return `${sign}${body} ${atom.code}`;
}

/** Human-facing answer string for a value. */
export function formatVal(v: Val): string {
  if (v.pct) {
    return `${group(v.n * 100, 2)}%`;
  }
  if (!v.num && !v.den) {
    return group(v.n, 2);
  }

  // rate
  if (v.num && v.den) {
    const disp = displayNumber(v);
    if (v.num.dim === "currency") {
      return `${fmtMoney(v.num, disp)}/${v.den.label}`;
    }
    return `${group(disp, 2)} ${v.num.label}/${v.den.label}`;
  }

  const atom = v.num!;
  if (atom.dim === "currency") return fmtMoney(atom, v.n);
  if (atom.dim === "temp") return `${group(v.n, 2)} ${atom.label}`;
  if (atom.dim === "time") {
    if (v.clock) return fmtClock(v.n);
    return fmtDuration(v);
  }

  const disp = displayNumber(v);
  return `${group(disp, 2)} ${unitLabel(atom, Number(disp.toFixed(2)))}`;
}

/** Full-precision string for tooltips / copy of raw magnitude. */
export function fullPrecision(v: Val): string {
  const disp = displayNumber(v);
  const s = String(disp);
  return v.pct ? `${s}%` : s;
}

export { ATOMS };
