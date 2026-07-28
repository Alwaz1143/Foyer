"use client";

import { useState, useEffect } from "react";

export interface CalendarDay {
  day: number;
  currentMonth: boolean;
  today: boolean;
}

export function useCalendar() {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [monthName, setMonthName] = useState("");

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    setMonthName(now.toLocaleDateString([], { month: "long", year: "numeric" }));

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const result: CalendarDay[] = [];

    for (let i = 0; i < firstDay; i++) {
      result.push({ day: daysInPrev - firstDay + 1 + i, currentMonth: false, today: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, currentMonth: true, today: d === today });
    }

    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        result.push({ day: d, currentMonth: false, today: false });
      }
    }

    setDays(result);
  }, []);

  return { days, monthName };
}
