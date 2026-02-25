import React, { useMemo } from 'react';

function toDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfYearUtc(year) {
  return new Date(Date.UTC(year, 0, 1));
}

function startOfNextYearUtc(year) {
  return new Date(Date.UTC(year + 1, 0, 1));
}

function dayDiffUtc(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function monthName(month) {
  return new Date(Date.UTC(2020, month, 1)).toLocaleString('en-US', { month: 'short' });
}

function colorForEntry(entry) {
  if (!entry) return '#ffffff';
  if (!entry.isSick) return '#2ecc71';

  const shades = {
    1: '#f6b1b1',
    2: '#ef8a8a',
    3: '#e35d5d',
    4: '#ce3030',
    5: '#990f0f'
  };

  return shades[entry.severity] || shades[1];
}

function labelForEntry(entry) {
  if (!entry) return 'No entry';
  if (!entry.isSick) return 'Healthy';
  return `Sick (${entry.severity}/5)`;
}

export default function YearHeatmap({ year, entries, onDayClick }) {
  const entriesByKey = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      map[entry.dateKey] = entry;
    });
    return map;
  }, [entries]);

  const { weeks, monthLayout } = useMemo(() => {
    const jan1 = startOfYearUtc(year);
    const nextJan1 = startOfNextYearUtc(year);
    const totalDays = dayDiffUtc(jan1, nextJan1);
    const offset = jan1.getUTCDay();
    const totalCells = offset + totalDays;
    const weekCount = Math.ceil(totalCells / 7);

    const monthStarts = new Set();
    const monthLayoutData = [];

    for (let m = 0; m < 12; m += 1) {
      const monthStart = new Date(Date.UTC(year, m, 1));
      const monthEnd = m === 11 ? nextJan1 : new Date(Date.UTC(year, m + 1, 1));
      const monthStartDay = dayDiffUtc(jan1, monthStart);
      const monthEndDay = dayDiffUtc(jan1, monthEnd);
      const startFlat = offset + monthStartDay;
      const endFlatExclusive = offset + monthEndDay;
      const startWeek = Math.floor(startFlat / 7);
      const endWeek = Math.ceil(endFlatExclusive / 7);

      if (startWeek > 0) monthStarts.add(startWeek);

      monthLayoutData.push({
        label: monthName(m),
        startWeek,
        spanWeeks: Math.max(1, endWeek - startWeek)
      });
    }

    const weekColumns = [];

    for (let w = 0; w < weekCount; w += 1) {
      const days = [];
      for (let d = 0; d < 7; d += 1) {
        const flatIndex = w * 7 + d;
        const dayIndex = flatIndex - offset;

        if (dayIndex < 0 || dayIndex >= totalDays) {
          days.push(null);
          continue;
        }

        const date = new Date(Date.UTC(year, 0, 1 + dayIndex));
        const dateKey = toDateKey(date);
        const entry = entriesByKey[dateKey] || null;

        days.push({ date, dateKey, entry });
      }

      weekColumns.push({
        index: w,
        days,
        monthBreakBefore: monthStarts.has(w)
      });
    }

    return { weeks: weekColumns, monthLayout: monthLayoutData };
  }, [year, entriesByKey]);

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-grid" role="grid" aria-label={`Health heatmap for ${year}`}>
        {weeks.map((week) => (
          <div
            key={`week-${week.index}`}
            className={`heatmap-week ${week.monthBreakBefore ? 'month-break' : ''}`}
          >
            {week.days.map((day, index) => {
              if (!day) return <div key={`empty-${week.index}-${index}`} className="heatmap-cell empty" />;

              const fill = colorForEntry(day.entry);
              const title = `${day.date.toLocaleDateString('en-GB')}: ${labelForEntry(day.entry)}`;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  className="heatmap-cell"
                  style={{ backgroundColor: fill }}
                  title={title}
                  onClick={() => onDayClick?.(day.date)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-month-row">
        {monthLayout.map((month) => (
          <div
            key={month.label}
            className="month-label"
            style={{ gridColumn: `${month.startWeek + 1} / span ${month.spanWeeks}` }}
          >
            {month.label}
          </div>
        ))}
      </div>
    </div>
  );
}
