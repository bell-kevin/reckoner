// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect, useRef } from "react";
import { LineOut } from "../engine";

interface Props {
  text: string;
  results: LineOut[];
  onChange: (text: string) => void;
  onCopy: (what: string) => void;
}

export default function Editor({ text, results, onChange, onCopy }: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text]);

  const copy = (s: string) => {
    const done = () => onCopy(s);
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(s).then(done, done);
        return;
      }
    } catch {
      // fall through
    }
    done();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: s, selectionEnd: en, value } = ta;
      const next = value.slice(0, s) + "  " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 2;
      });
    }
  };

  const focusEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
  };

  return (
    <div className="sheet" role="region" aria-label="Sheet" onClick={focusEnd}>
      <div className="cols" onClick={focusEnd}>
        <textarea
          ref={taRef}
          className="input"
          value={text}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={"Type notes and numbers.\nAnything that's math gets an answer."}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Notepad"
        />
        <div className="answers" aria-label="Answers">
          {results.map((r, i) => {
            if (r.kind === "value") {
              const neg = r.display!.startsWith("-");
              return (
                <button
                  key={i}
                  type="button"
                  className={neg ? "ans val neg" : "ans val"}
                  title={`${r.full} — click to copy`}
                  onClick={() => copy(r.display!)}
                >
                  {r.display}
                </button>
              );
            }
            if (r.kind === "error") {
              return (
                <span key={i} className="ans err" title={r.error}>
                  !
                </span>
              );
            }
            return <div key={i} className="ans pad" aria-hidden="true" />;
          })}
        </div>
      </div>
    </div>
  );
}
