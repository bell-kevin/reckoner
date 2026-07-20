// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "./components/Editor";
import Help from "./components/Help";
import { evaluateSheet } from "./engine";
import { load, save, SheetT, Theme, uid } from "./lib/storage";
import { decodeShare, encodeShare } from "./lib/share";

const WELCOME = `✳ Welcome to reckoner
A plain-text notepad where math answers itself.
Notes stay notes — anything that parses, computes.
Click an answer to copy it. Everything stays on this device.

— Split the check —
dinner = $86.40
tip = 18% of dinner
dinner + tip
prev / 3

— Percents, plainly —
$1,299 - 20%
15% of 240
32 as % of 80

— Units that convert —
5 km in mi
350 F in C
6 ft 2 in in cm
2 TB / 4.7 GB

— Time is math too —
9:30am + 3h 45m
11h 20m - 5h 5m
3 h in min

— Rates —
$18 / 2.5 h
62 mph * 3.5 h

— Lists add themselves —
28.50
41.25
12.99
sum
avg

Edit anything — answers update live.
The ? button has the full guide.`;

function freshState() {
  const first: SheetT = {
    id: uid(),
    name: "Welcome",
    text: WELCOME,
    updated: Date.now(),
  };
  return { sheets: [first], activeId: first.id, theme: "auto" as Theme };
}

export default function App() {
  const [state, setState] = useState(() => load() ?? freshState());
  const [helpOpen, setHelpOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const active =
    state.sheets.find((s) => s.id === state.activeId) ?? state.sheets[0];

  const results = useMemo(() => evaluateSheet(active.text), [active.text]);
  const answerCount = useMemo(
    () => results.filter((r) => r.kind === "value").length,
    [results],
  );

  // persist (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => save(state), 250);
    return () => window.clearTimeout(t);
  }, [state]);

  // theme attribute
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  // import a shared sheet from the URL fragment
  useEffect(() => {
    const h = window.location.hash;
    if (!h.startsWith("#s=")) return;
    const payload = decodeURIComponent(h.slice(3));
    decodeShare(payload).then((text) => {
      if (text === null) {
        flash("That share link couldn't be read");
        return;
      }
      const firstLine =
        text.split("\n").find((l) => l.trim().length > 0)?.trim().slice(0, 28) ??
        "Shared sheet";
      const sheet: SheetT = {
        id: uid(),
        name: firstLine,
        text,
        updated: Date.now(),
      };
      setState((p) => ({ ...p, sheets: [sheet, ...p.sheets], activeId: sheet.id }));
      flash("Sheet opened from link");
    });
    history.replaceState(null, "", window.location.pathname + window.location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl/Cmd+S reassurance
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flash("Already saved — reckoner autosaves locally");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }

  const setText = (text: string) =>
    setState((p) => ({
      ...p,
      sheets: p.sheets.map((s) =>
        s.id === p.activeId ? { ...s, text, updated: Date.now() } : s,
      ),
    }));

  const rename = (name: string) =>
    setState((p) => ({
      ...p,
      sheets: p.sheets.map((s) =>
        s.id === p.activeId ? { ...s, name } : s,
      ),
    }));

  const newSheet = () => {
    const n = state.sheets.length + 1;
    const sheet: SheetT = {
      id: uid(),
      name: `Sheet ${n}`,
      text: "",
      updated: Date.now(),
    };
    setState((p) => ({ ...p, sheets: [sheet, ...p.sheets], activeId: sheet.id }));
  };

  const selectSheet = (id: string) => {
    setState((p) => ({ ...p, activeId: id }));
    setSideOpen(false);
  };

  const deleteSheet = (id: string) => {
    const doomed = state.sheets.find((s) => s.id === id);
    if (!doomed) return;
    if (!window.confirm(`Delete "${doomed.name}"? This can't be undone.`)) return;
    setState((p) => {
      const sheets = p.sheets.filter((s) => s.id !== id);
      if (sheets.length === 0) return freshState();
      const activeId = p.activeId === id ? sheets[0].id : p.activeId;
      return { ...p, sheets, activeId };
    });
  };

  const shareSheet = async () => {
    const payload = await encodeShare(active.text);
    const url = `${window.location.origin}${window.location.pathname}#s=${payload}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied — the sheet travels inside the URL");
    } catch {
      window.prompt("Copy this share link:", url);
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([active.text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${active.name.replace(/[^\w\- ]+/g, "").trim() || "sheet"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cycleTheme = () => {
    const order: Theme[] = ["auto", "light", "dark"];
    const nextT = order[(order.indexOf(state.theme) + 1) % order.length];
    setState((p) => ({ ...p, theme: nextT }));
    flash(`Theme: ${nextT}`);
  };

  return (
    <div className="app">
      <header className="top">
        <button
          type="button"
          className="btn ghost side-toggle"
          onClick={() => setSideOpen((v) => !v)}
          aria-expanded={sideOpen}
          aria-label="Sheets"
        >
          ☰
        </button>
        <div className="wordmark" aria-hidden="true">
          reckoner<span className="spark">✳</span>
        </div>
        <input
          className="sheet-name"
          value={active.name}
          onChange={(e) => rename(e.target.value)}
          aria-label="Sheet name"
        />
        <div className="top-actions">
          <button type="button" className="btn" onClick={newSheet}>
            New
          </button>
          <button type="button" className="btn" onClick={shareSheet}>
            Share
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setHelpOpen(true)}
            aria-label="Syntax guide"
          >
            ?
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={cycleTheme}
            aria-label={`Theme: ${state.theme}`}
            title={`Theme: ${state.theme}`}
          >
            ◐
          </button>
        </div>
      </header>

      <div className="body">
        <nav className={sideOpen ? "side open" : "side"} aria-label="Sheets">
          <div className="side-head">Sheets</div>
          <ul>
            {state.sheets.map((s) => (
              <li key={s.id} className={s.id === state.activeId ? "cur" : ""}>
                <button
                  type="button"
                  className="side-item"
                  onClick={() => selectSheet(s.id)}
                >
                  {s.name || "Untitled"}
                </button>
                <button
                  type="button"
                  className="side-del"
                  onClick={() => deleteSheet(s.id)}
                  aria-label={`Delete ${s.name}`}
                  title="Delete sheet"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="side-foot">
            <button type="button" className="btn ghost" onClick={downloadTxt}>
              Download .txt
            </button>
          </div>
        </nav>

        <main className="main">
          <Editor
            text={active.text}
            results={results}
            onChange={setText}
            onCopy={(s) => flash(`Copied ${s}`)}
          />
        </main>
      </div>

      <footer className="foot">
        <span>All data stays in this browser · autosaves · AGPL-3.0</span>
        <span>
          {answerCount} answer{answerCount === 1 ? "" : "s"}
        </span>
      </footer>

      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
