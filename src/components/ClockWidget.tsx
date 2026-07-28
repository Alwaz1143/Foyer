"use client";

import { useClock } from "@/hooks/useClock";

const STATIC_CHARS = new Set([":", " ", "A", "P", "M"]);

export default function ClockWidget() {
  const time = useClock();
  const timeStr = time || "";
  if (!time) return null;

  return (
    <div className="clock-widget">
      {timeStr.split("").map((char, i) => {
        const isAmpm = (char === "A" || char === "P") && i > 0 && timeStr[i - 1] === " ";
        return (
          <span
            key={`${i}-${char}`}
            className={`clock-digit${STATIC_CHARS.has(char) ? " static" : ""}${isAmpm ? " clock-ampm" : ""}`}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
