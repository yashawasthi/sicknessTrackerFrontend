import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

function toDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLabel(entry) {
  if (!entry) return 'No entry';
  if (!entry.isSick) return 'Healthy';
  return `Sick (${entry.severity}/5)`;
}

function entryToScale(entry) {
  if (!entry) return 0;
  if (!entry.isSick) return 1;
  return Math.min(6, Math.max(2, (entry.severity || 1) + 1));
}

export default function YearHeatmap({ year, entries, onDayClick, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(980);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entriesList) => {
      const nextWidth = entriesList[0]?.contentRect?.width;
      if (typeof nextWidth === 'number' && nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isTiny = containerWidth < 760;
  const horizontalPadding = isTiny ? 28 : 44;
  const calendarLeft = isTiny ? 10 : 16;
  const usableWidth = Math.max(320, containerWidth - horizontalPadding);
  const cellSize = Math.max(6, usableWidth / 53);
  const calendarWidth = cellSize * 53;
  const calendarHeight = cellSize * 7;
  const calendarTop = isTiny ? 30 : 34;
  const calendarBottom = isTiny ? 30 : 34;
  const monthGapWidth = 3;

  const { dataPoints, detailsMap } = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      map[entry.dateKey] = entry;
    });

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const points = [];

    let dayCounter = 1;
    for (let date = new Date(yearStart); date < nextYearStart; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = toDateKey(date);
      const entry = map[key] || null;
      points.push([key, entryToScale(entry), dayCounter]);
      dayCounter += 1;
    }

    return { dataPoints: points, detailsMap: map };
  }, [year, entries]);

  const monthBoundaryWeeks = useMemo(() => {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const offset = jan1.getUTCDay();
    const boundaries = new Set();

    for (let month = 1; month < 12; month += 1) {
      const monthStart = new Date(Date.UTC(year, month, 1));
      const dayIndex = Math.floor((monthStart.getTime() - jan1.getTime()) / 86400000);
      const weekIndex = Math.floor((offset + dayIndex) / 7);
      boundaries.add(weekIndex);
    }

    return [...boundaries].sort((a, b) => a - b);
  }, [year]);

  const option = useMemo(
    () => ({
      animation: true,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: isDark ? '#0f1a31' : '#ffffff',
        borderColor: isDark ? '#2a3f68' : '#c8d7ef',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e8eefb' : '#162744' },
        formatter(params) {
          const dateKey = Array.isArray(params.value) ? params.value[0] : '';
          const entry = detailsMap[dateKey] || null;
          return `${dateKey.split('-').reverse().join('/')}<br/>${formatLabel(entry)}`;
        }
      },
      visualMap: {
        show: false,
        type: 'piecewise',
        dimension: 1,
        pieces: [
          { value: 0, color: '#ffffff' },
          { value: 1, color: '#2ecc71' },
          { value: 2, color: '#f6b1b1' },
          { value: 3, color: '#ef8a8a' },
          { value: 4, color: '#e35d5d' },
          { value: 5, color: '#ce3030' },
          { value: 6, color: '#990f0f' }
        ]
      },
      calendar: {
        top: calendarTop,
        left: calendarLeft,
        bottom: calendarBottom,
        width: calendarWidth,
        height: calendarHeight,
        range: `${year}`,
        cellSize: [cellSize, cellSize],
        splitLine: {
          show: true,
          lineStyle: {
            color: isDark ? '#172a49' : '#e8effa',
            width: 1
          }
        },
        itemStyle: {
          borderColor: isDark ? '#172a49' : '#e8effa',
          borderWidth: 1
        },
        yearLabel: { show: false },
        dayLabel: {
          show: !isTiny,
          firstDay: 0,
          nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
          color: isDark ? '#93a7cb' : '#6078a4',
          margin: 10
        },
        monthLabel: {
          show: true,
          nameMap: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          position: 'end',
          color: isDark ? '#b7c7e6' : '#4a638d',
          margin: isTiny ? 10 : 14
        }
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: dataPoints,
          label: {
            show: true,
            position: 'inside',
            formatter(params) {
              return Array.isArray(params.value) ? String(params.value[2]) : '';
            },
            color: isDark ? '#9aa7bf' : '#6f7f9b',
            fontSize: Math.max(5, Math.floor(cellSize * 0.4)),
            fontWeight: 400,
            fontFamily: "'Courier New', 'Consolas', monospace"
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: isDark ? 'rgba(87, 125, 196, 0.45)' : 'rgba(62, 92, 147, 0.35)'
            }
          }
        }
      ],
      graphic: [
        {
          type: 'rect',
          silent: true,
          z: 25,
          zlevel: 2,
          left: calendarLeft - monthGapWidth / 2,
          top: calendarTop,
          shape: { width: monthGapWidth, height: calendarHeight },
          style: {
            fill: isDark ? '#10203e' : '#ffffff',
            stroke: 'rgba(0, 0, 0, 0)',
            lineWidth: 0
          }
        },
        ...monthBoundaryWeeks.map((weekIndex) => ({
          type: 'rect',
          silent: true,
          z: 25,
          zlevel: 2,
          left: calendarLeft + weekIndex * cellSize - monthGapWidth / 2,
          top: calendarTop,
          shape: {
            width: monthGapWidth,
            height: calendarHeight
          },
          style: {
            fill: isDark ? '#10203e' : '#ffffff',
            stroke: 'rgba(0, 0, 0, 0)',
            lineWidth: 0
          }
        })),
        {
          type: 'rect',
          silent: true,
          z: 25,
          zlevel: 2,
          left: calendarLeft + calendarWidth - monthGapWidth / 2,
          top: calendarTop,
          shape: { width: monthGapWidth, height: calendarHeight },
          style: {
            fill: isDark ? '#10203e' : '#ffffff',
            stroke: 'rgba(0, 0, 0, 0)',
            lineWidth: 0
          }
        }
      ]
    }),
    [
      year,
      dataPoints,
      detailsMap,
      isDark,
      isTiny,
      cellSize,
      calendarWidth,
      calendarHeight,
      calendarTop,
      calendarBottom,
      calendarLeft,
      monthGapWidth,
      monthBoundaryWeeks
    ]
  );

  const onEvents = {
    click(params) {
      if (!onDayClick) return;
      if (params.componentType !== 'series' || params.seriesType !== 'heatmap') return;
      if (!Array.isArray(params.value) || typeof params.value[0] !== 'string') return;
      onDayClick(new Date(`${params.value[0]}T00:00:00.000Z`));
    }
  };

  return (
    <div ref={containerRef} className="heatmap-echart-wrap">
      <ReactECharts
        option={option}
        opts={{ renderer: 'svg' }}
        onEvents={onEvents}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
