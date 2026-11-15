"use client";

import { type FormEvent, useState } from "react";
import { MAX_PLANNED_MIN, type StartInput, validateStartInput } from "@/lib/domain/activity";
import type { Tag } from "@/lib/domain/tag";
import { TagPicker } from "./tag-picker";

// 予定時間は必須。「なし」は置かず、最初は何も選ばれていない状態にする（作業への時間の意識を持つため）
const PRESETS: { label: string; min: number }[] = [
  { label: "15分", min: 15 },
  { label: "30分", min: 30 },
  { label: "1時間", min: 60 },
  { label: "2時間", min: 120 },
];

export function StartForm({
  tags,
  onStart,
}: {
  tags: readonly Tag[];
  onStart: (input: StartInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [planned, setPlanned] = useState(""); // 空 = まだ選んでいない
  // 予定時間を選ばずに開始を押したとき、選ぶ欄を目立たせる
  const [plannedMissing, setPlannedMissing] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 開始のたびにタグ選択欄を作り直して閉じる
  const [resetCount, setResetCount] = useState(0);

  const plannedMin = planned === "" ? null : Number(planned);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateStartInput({ title, plannedMin, tagIds });
    if (!result.ok) {
      setError(result.error);
      setPlannedMissing(plannedMin === null && title.trim() !== "");
      return;
    }
    onStart(result.value);
    setTitle("");
    setPlanned("");
    setPlannedMissing(false);
    setTagIds([]);
    setResetCount((n) => n + 1);
    setError(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="何をする？"
          aria-label="作業内容"
          enterKeyHint="go"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-3 text-base outline-none focus:border-blue-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white active:bg-blue-700"
        >
          開始
        </button>
      </div>

      <fieldset
        aria-invalid={plannedMissing}
        className={`flex flex-wrap items-center gap-2 rounded-xl text-sm ${
          plannedMissing ? "-m-2 bg-red-50 p-2 ring-2 ring-red-500 dark:bg-red-950/40" : ""
        }`}
      >
        <legend className={`mb-1 ${plannedMissing ? "font-bold text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
          予定時間{plannedMissing && "（選んでください）"}
        </legend>
        {PRESETS.map((p) => {
          const selected = plannedMin === p.min;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setPlanned(String(p.min));
                setPlannedMissing(false);
                setError(null);
              }}
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <label className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_PLANNED_MIN}
            value={planned}
            onChange={(e) => {
              setPlanned(e.target.value);
              setPlannedMissing(false);
            }}
            placeholder="—"
            aria-label="予定時間（分）"
            className="w-16 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-right dark:border-zinc-700"
          />
          分
        </label>
      </fieldset>

      <TagPicker key={resetCount} tags={tags} value={tagIds} onChange={setTagIds} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
