"use client";

/** ◀ 日付 ▶ の切り替え。offset は今日からの差（0 = 今日、負 = 過去）。未来には進めない。 */
export function PeriodNav({
  label,
  offset,
  onChange,
  prevLabel = "前へ",
  nextLabel = "次へ",
}: {
  label: string;
  offset: number;
  onChange: (offset: number) => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => onChange(offset - 1)}
        aria-label={prevLabel}
        className="rounded-lg px-2 py-1 active:bg-zinc-100 dark:active:bg-zinc-800"
      >
        ◀
      </button>
      <span className="min-w-20 text-center font-bold" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(0, offset + 1))}
        disabled={offset >= 0}
        aria-label={nextLabel}
        className="rounded-lg px-2 py-1 active:bg-zinc-100 disabled:opacity-30 dark:active:bg-zinc-800"
      >
        ▶
      </button>
      {offset < 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-1 rounded-lg border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
        >
          今日
        </button>
      )}
    </div>
  );
}
