"use client";

import { useCalendar } from "@/hooks/useCalendar";

const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarWidget() {
  const { days, monthName } = useCalendar();
  if (!days.length) return null;

  return (
    <div className="widget widget-calendar">
      <div className="calendar-month">{monthName}</div>
      <div className="calendar-grid">
        {DAY_NAMES.map((d, i) => (
          <div key={`dn-${i}`} className="calendar-day-name">{d}</div>
        ))}
        {days.map((d, i) => (
          <div
            key={i}
            className={`calendar-day${d.today ? " today" : ""}${!d.currentMonth ? " other-month" : ""}`}
          >
            {d.day}
          </div>
        ))}
      </div>
    </div>
  );
}
