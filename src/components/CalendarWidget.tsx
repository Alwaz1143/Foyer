"use client";

import { useCalendar } from "@/hooks/useCalendar";

const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarWidget() {
  const { days, monthName, prevMonth, nextMonth } = useCalendar();
  if (!days.length) return null;

  return (
    <div className="widget widget-calendar">
      <div className="calendar-header">
        <button className="calendar-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
        <div className="calendar-month">{monthName}</div>
        <button className="calendar-nav" onClick={nextMonth} aria-label="Next month">›</button>
      </div>
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
