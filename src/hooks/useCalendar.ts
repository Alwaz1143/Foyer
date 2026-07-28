"use client";

import { useState, useEffect, useCallback } from "react";

export interface CalendarDay {
  day: number;
  currentMonth: boolean;
  today: boolean;
}

export function useCalendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [monthName, setMonthName] = useState("");

  const buildCalendar = useCallback(() => {
    const today = new Date().getDate();
    const todayMonth = new Date().getMonth();
    const todayYear = new Date().getFullYear();

    setMonthName(
      new Date(viewYear, viewMonth).toLocaleDateString([], { month: "long", year: "numeric" })
    );

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    const result: CalendarDay[] = [];

    for (let i = 0; i < firstDay; i++) {
      result.push({ day: daysInPrev - firstDay + 1 + i, currentMonth: false, today: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      result.push({
        day: d,
        currentMonth: true,
        today: d === today && viewMonth === todayMonth && viewYear === todayYear,
      });
    }

    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        result.push({ day: d, currentMonth: false, today: false });
      }
    }

    setDays(result);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    buildCalendar();
  }, [buildCalendar]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  return { days, monthName, prevMonth, nextMonth };
}
