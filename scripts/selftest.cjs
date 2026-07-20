// reckoner engine self-test — Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */
"use strict";

const { evaluateSheet } = require("../.selftest/index.js");

let pass = 0;
let fail = 0;

function lineOut(text) {
  const rs = evaluateSheet(text);
  return rs[rs.length - 1];
}

function eq(input, expected, label) {
  const out = lineOut(input);
  const got = out.kind === "value" ? out.display : `<${out.kind}${out.error ? ": " + out.error : ""}>`;
  if (got === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL ${label || input}\n  input:    ${JSON.stringify(input)}\n  expected: ${expected}\n  got:      ${got}`);
  }
}

function kindIs(input, kind, label) {
  const out = lineOut(input);
  if (out.kind === kind) pass++;
  else {
    fail++;
    console.error(`FAIL ${label || input}: expected kind ${kind}, got ${out.kind} (${out.display || out.error || ""})`);
  }
}

// ---- plain arithmetic ----
eq("2 + 2 * 2", "6");
eq("(2 + 3) ^ 2", "25");
eq("10 / 4", "2.5");
eq("2 ^ 10", "1,024");
eq("-5 + 12", "7");
eq("1e3 + 1", "1,001");
eq(".5 + .25", "0.75");
eq("1,299 + 1", "1,300");
eq("pi * 2", "6.28");
eq("sqrt(144)", "12");
eq("round(2.678, 1)", "2.7");
eq("min(3, 7, 2)", "2");
eq("max(3, 7, 2)", "7");
eq("floor(9.9)", "9");
eq("2 dozen * 3", "72");
eq("$5k + 8.25%", "$5,412.50");
eq("1.5M / 3", "500,000");

// ---- percentages ----
eq("15% of 240", "36");
eq("$1,299 - 20%", "$1,039.20");
eq("150 + 20%", "180");
eq("20% off 150", "120");
eq("20% on 150", "180");
eq("32 as % of 80", "40%");
eq("10% + 5%", "15%");
eq("(5 + 5)%", "10%");
eq("18% of $86.40", "$15.55");

// ---- units & conversions ----
eq("5 km in mi", "3.11 mi");
eq("350 F in C", "176.67 °C");
eq("0 C in F", "32 °F");
eq("6 ft 2 in in cm", "187.96 cm");
eq("5'10\" in cm", "177.8 cm");
eq("2 in in cm", "5.08 cm");
eq("5 mi + 3 km", "6.86 mi");
eq("2 TB / 4.7 GB", "425.53");
eq("1 GiB in MB", "1,073.74 MB");
eq("8 oz in g", "226.8 g");
eq("1 lb 4 oz in g", "566.99 g");
eq("2 cups in ml", "473.18 ml");
eq("1 acre in sqft", "43,560 sq ft");
eq("100 kg * 2", "200 kg");

// ---- time ----
eq("9:30am + 3h 45m", "13:15");
eq("11h 20m - 5h 5m", "6 h 15 min");
eq("3 h in min", "180 min");
eq("90 min in h", "1 h 30 min");
eq("1:15 + 0:50", "2:05");
eq("9pm + 5h", "26:00");
eq("1m 30s", "1 min 30 s");
eq("2.5 h", "2 h 30 min");
eq("45 min * 2", "90 min", "45 min * 2 keeps the written unit");

// ---- rates ----
eq("$18 / 2.5 h", "$7.20/h");
eq("62 mph * 3.5 h", "217 mi");
eq("$25/h * 8h", "$200.00");
eq("120 km / 2 h", "60 km/h");
eq("60 mph in km/h", "96.56 km/h");
eq("300 mi / 25 mpg", "12 gal");
eq("$4,000 per mo * 6 mo", "$24,000.00");

// ---- variables & prev ----
{
  const rs = evaluateSheet("x = 5\nx * 3\nprev + 1");
  const got = rs.map((r) => r.display).join("|");
  const want = "5|15|16";
  if (got === want) pass++;
  else {
    fail++;
    console.error(`FAIL variables/prev: got ${got}`);
  }
}

// ---- sum / avg / total with prose and blank boundaries ----
{
  const sheet = [
    "Groceries",
    "28.50",
    "41.25",
    "12.99",
    "sum",
    "avg",
    "",
    "Hardware",
    "10",
    "20",
    "sum",
    "",
    "total",
  ].join("\n");
  const rs = evaluateSheet(sheet);
  const get = (i) => rs[i].display;
  const checks = [
    [4, "82.74"],
    [5, "27.58"],
    [10, "30"],
    [12, "112.74"],
  ];
  for (const [i, want] of checks) {
    if (get(i) === want) pass++;
    else {
      fail++;
      console.error(`FAIL agg line ${i}: expected ${want}, got ${get(i)}`);
    }
  }
}

// currency sums keep their symbol; incompatible lines are skipped
{
  const sheet = ["$9.50", "$2.50", "3 people", "sum"].join("\n");
  const rs = evaluateSheet(sheet);
  const got = rs[3].display;
  if (got === "$12.00") pass++;
  else {
    fail++;
    console.error(`FAIL currency sum: got ${got}`);
  }
}

// ---- welcome-sheet block sanity ----
{
  const sheet = [
    "— Split the check —",
    "dinner = $86.40",
    "tip = 18% of dinner",
    "dinner + tip",
    "prev / 3",
  ].join("\n");
  const rs = evaluateSheet(sheet);
  const got = rs.slice(1).map((r) => r.display).join("|");
  const want = "$86.40|$15.55|$101.95|$33.98";
  if (got === want) pass++;
  else {
    fail++;
    console.error(`FAIL welcome check-split: got ${got}`);
  }
}

// ---- prose stays prose; semantic errors surface ----
kindIs("Meeting notes from Tuesday", "text");
kindIs("— Rates —", "text");
kindIs("groceries:", "text");
kindIs("100 USD + 5 EUR", "error", "cross-currency add");
kindIs("5 km + 3 kg", "error", "mixed dims");
kindIs("1 / 0", "error", "divide by zero");
kindIs("call Anna about 3 things", "text");
kindIs("", "blank");
kindIs("   ", "blank");
kindIs("x + 1", "text", "unknown ident is prose");
kindIs("72 in in cm", "value", "explicit inches conversion");
eq("72 in in cm", "182.88 cm");
kindIs("5 USD in EUR", "error", "fx conversion refused");

// comments
eq("10 * 2 // boxes", "20");
eq("10 * 2 # boxes", "20");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
