"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { type Activity, type ActivityDraft, MAX_PLANNED_MIN, validateDraft } from "@/lib/domain/activity";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/domain/datetime-local";

export type EditTarget =
  | { kind: "edit"; activity: Activity }
  | { kind: "add"; startedAt: Date; endedAt: Date };

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-blue-500 dark:border-zinc-700";

export function EditDialog({
  target,
  onSave,
  onDelete,
  onClose,
}: {
  target: EditTarget;
  onSave: (draft: ActivityDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEdit = target.kind === "edit";
  const isRunning = isEdit && target.activity.endedAt === null;

  const [title, setTitle] = useState(isEdit ? target.activity.title : "");
  const [start, setStart] = useState(
    toDateTimeLocal(isEdit ? new Date(target.activity.startedAt) : target.startedAt),
  );
  const [end, setEnd] = useState(() => {
    if (!isEdit) return toDateTimeLocal(target.endedAt);
    return target.activity.endedAt === null ? "" : toDateTimeLocal(new Date(target.activity.endedAt));
  });
  const [planned, setPlanned] = useState(
    isEdit && target.activity.plannedMin !== null ? String(target.activity.plannedMin) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const original = isEdit ? target.activity : null;
    // 分単位の入力欄なので、変更していない時刻は元の秒単位の値を保つ
    const keep = (iso: string | null, value: string) =>
      iso !== null && value === toDateTimeLocal(new Date(iso)) ? new Date(iso) : fromDateTimeLocal(value);
    const draft: ActivityDraft = {
      title,
      startedAt: keep(original?.startedAt ?? null, start),
      endedAt: end === "" ? null : keep(original?.endedAt ?? null, end),
      plannedMin: planned === "" ? null : Number(planned),
    };
    const result = validateDraft(draft, new Date(), { requireEnd: !isRunning });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.value);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="edit-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <h2 id="edit-dialog-title" className="text-lg font-bold">
          {isEdit ? "記録を編集" : "記録を追加"}
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          作業内容
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          開始時刻
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {isRunning ? "終了時刻（空欄なら実行中のまま）" : "終了時刻"}
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          予定時間（分・空欄なら無制限）
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_PLANNED_MIN}
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                onDelete();
                dialogRef.current?.close();
              }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${
                confirmingDelete ? "bg-red-600 text-white" : "text-red-600"
              }`}
            >
              {confirmingDelete ? "本当に削除する" : "削除"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl px-4 py-2 text-sm"
            >
              キャンセル
            </button>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white">
              保存
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
