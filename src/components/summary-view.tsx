"use client";

import { useState } from "react";
import { type PeriodKind, periodRange } from "@/lib/domain/period";
import { summarize } from "@/lib/domain/summary";
import { addDays } from "@/lib/domain/datetime-local";
import { useAppData } from "@/lib/hooks/use-app-data";
import { useNow } from "@/lib/hooks/use-now";
import { formatClock, formatDay, formatHm, formatMonth } from "@/lib/format";
import { PeriodNav } from "./period-nav";

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "day", label: "日" },
  { kind: "week", label: "週" },
  { kind: "month", label: "月" },
];
const NEUTRAL = "#94a3b8";
const TITLE_LIMIT = 10;

export function SummaryView() {
  const { data } = useAppData();
  const now = useNow();
  const [kind, setKind] = useState<PeriodKind>("day");
  const [offset, setOffset] = useState(0);
  const [showAllTitles, setShowAllTitles] = useState(false);

  if (!now) return null;

  const range = periodRange(kind, now, offset);
  const s = summarize(data.activities, data.tags, range, now);
  const label =
    kind === "day"
      ? `${offset === 0 ? "今日 " : ""}${formatDay(range.start)}`
      : kind === "week"
        ? `${formatDay(range.start)}〜${formatDay(addDays(range.end, -1))}`
        : formatMonth(range.start);
  // バーの長さは「記録の合計」に対する割合
  const pct = (ms: number) => (s.totalMs === 0 ? 0 : (ms / s.totalMs) * 100);
  const titles = showAllTitles ? s.byTitle : s.byTitle.slice(0, TITLE_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="集計の単位" className="flex rounded-xl bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              aria-pressed={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setOffset(0);
              }}
              className={`rounded-lg px-4 py-1 ${
                kind === k.kind ? "bg-white font-bold shadow-sm dark:bg-zinc-950" : "text-zinc-500"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <PeriodNav label={label} offset={offset} onChange={setOffset} />
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Stat label="記録の合計" value={formatHm(s.totalMs)} note={`${s.activityCount}件`} />
        <Stat label="実時間（重なりを除く）" value={formatHm(s.coveredMs)} />
        <Stat
          label="予定超過"
          value={`${s.overruns.length}回`}
          note={s.overruns.length > 0 ? `合計 ${formatHm(s.overrunTotalMs)}` : undefined}
          alert={s.overruns.length > 0}
        />
        <Stat label="並行作業" value={formatHm(s.totalMs - s.coveredMs)} note="重なっていた時間" />
      </dl>

      {s.activityCount === 0 ? (
        <p className="text-sm text-zinc-500">この期間の記録はありません</p>
      ) : (
        <>
          <section aria-labelledby="by-tag" className="flex flex-col gap-2">
            <h2 id="by-tag" className="text-sm font-bold text-zinc-500">
              タグ別（子タグは親にも合算）
            </h2>
            <ul className="flex flex-col gap-2">
              {s.byTag.map((row) => (
                <BarRow
                  key={row.tag.id}
                  label={row.tag.name}
                  indent={row.depth}
                  color={row.tag.color}
                  ms={row.totalMs}
                  percent={pct(row.totalMs)}
                />
              ))}
              {s.untaggedMs > 0 && (
                <BarRow label="タグなし" indent={0} color={NEUTRAL} ms={s.untaggedMs} percent={pct(s.untaggedMs)} muted />
              )}
            </ul>
          </section>

          <section aria-labelledby="by-title" className="flex flex-col gap-2">
            <h2 id="by-title" className="text-sm font-bold text-zinc-500">
              作業別
            </h2>
            <ul className="flex flex-col gap-2">
              {titles.map((row) => (
                <BarRow
                  key={row.title}
                  label={row.title}
                  sublabel={`${row.count}回`}
                  indent={0}
                  color="#2563eb"
                  ms={row.totalMs}
                  percent={pct(row.totalMs)}
                  showDot={false}
                />
              ))}
            </ul>
            {s.byTitle.length > TITLE_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllTitles((v) => !v)}
                className="self-start text-sm text-blue-600"
              >
                {showAllTitles ? "上位だけ表示" : `すべて表示（${s.byTitle.length}件）`}
              </button>
            )}
          </section>

          <section aria-labelledby="overruns" className="flex flex-col gap-2">
            <h2 id="overruns" className="text-sm font-bold text-zinc-500">
              予定を超過した作業
            </h2>
            {s.overruns.length === 0 ? (
              <p className="text-sm text-zinc-500">超過はありません。この調子！</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {s.overruns.map(({ activity, overrunMs }) => (
                  <li key={activity.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{activity.title}</p>
                      <p className="text-xs text-zinc-500">
                        {formatDay(new Date(activity.startedAt))} {formatClock(activity.startedAt)}〜
                        {activity.endedAt ? formatClock(activity.endedAt) : "実行中"}・予定{" "}
                        {formatHm((activity.plannedMin ?? 0) * 60_000)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-red-600 tabular-nums dark:text-red-400">
                      +{formatHm(overrunMs)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-2xl border p-3 ${
        alert ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`text-xl font-bold tabular-nums ${alert ? "text-red-600 dark:text-red-400" : ""}`}>{value}</dd>
      {note && <dd className="text-xs text-zinc-500">{note}</dd>}
    </div>
  );
}

function BarRow({
  label,
  sublabel,
  indent,
  color,
  ms,
  percent,
  muted = false,
  showDot = true,
}: {
  label: string;
  sublabel?: string;
  indent: number;
  color: string;
  ms: number;
  percent: number;
  muted?: boolean;
  showDot?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1" style={{ paddingLeft: `${indent * 1.25}rem` }}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={`flex min-w-0 items-center gap-1.5 ${muted ? "text-zinc-500" : ""}`}>
          {indent > 0 && <span className="text-zinc-400">└</span>}
          {showDot && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
          <span className="truncate">{label}</span>
          {sublabel && <span className="shrink-0 text-xs text-zinc-500">{sublabel}</span>}
        </span>
        <span className="shrink-0 tabular-nums">
          {formatHm(ms)}
          <span className="ml-1.5 inline-block w-10 text-right text-xs text-zinc-500">{Math.round(percent)}%</span>
        </span>
      </div>
      <div className="h-2 rounded-r bg-zinc-100 dark:bg-zinc-800" aria-hidden>
        <div className="h-full rounded-r" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }} />
      </div>
    </li>
  );
}
