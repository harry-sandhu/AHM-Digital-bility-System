import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rankSuggestions, type Suggestion } from "../utils/suggest";

type AutoSuggestProps = {
  /** Current text of the wrapped field — the suggestions filter on this. */
  query: string;
  suggestions: Suggestion[];
  /** Called with the picked suggestion's index in `suggestions`. */
  onPick: (suggestion: Suggestion) => void;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps a text field and shows a ranked, filtered dropdown under it while it
 * has focus. The list is portaled to <body> and positioned with `fixed`,
 * because the bilty layout's boxes are all `overflow-hidden` and would clip
 * a normally-positioned dropdown. Never rendered in print (`no-print`).
 */
const AutoSuggest: React.FC<AutoSuggestProps> = ({
  query,
  suggestions,
  onPick,
  className = "",
  children,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const matches = isFocused ? rankSuggestions(suggestions, query) : [];
  const isOpen = matches.length > 0 && rect !== null;

  useLayoutEffect(() => {
    if (!isFocused) {
      return;
    }

    const update = () => {
      if (wrapperRef.current) {
        setRect(wrapperRef.current.getBoundingClientRect());
      }
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isFocused, query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const pick = (suggestion: Suggestion) => {
    onPick(suggestion);
    setIsFocused(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? matches.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      // Only hijack Enter once the user has arrowed onto a suggestion, so
      // plain Enter in a multi-line address box still inserts a newline.
      event.preventDefault();
      pick(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setIsFocused(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
    >
      {children}
      {isOpen && rect
        ? createPortal(
            <ul
              role="listbox"
              className="no-print fixed z-50 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left text-sm shadow-lg"
              style={{
                top: rect.bottom + 2,
                left: rect.left,
                minWidth: Math.max(rect.width, 220),
                maxWidth: "min(90vw, 28rem)",
              }}
            >
              {matches.map((suggestion, index) => (
                <li
                  key={`${suggestion.text}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown (not click) + preventDefault keeps the field
                  // focused so blur doesn't close the list before the pick.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`cursor-pointer px-3 py-2 leading-snug ${
                    index === activeIndex ? "bg-brand-50" : ""
                  }`}
                >
                  <span className="block whitespace-pre-line font-medium text-slate-800">
                    {suggestion.text}
                  </span>
                  {suggestion.sub ? (
                    <span className="block text-xs text-slate-500">{suggestion.sub}</span>
                  ) : null}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
};

export default AutoSuggest;
