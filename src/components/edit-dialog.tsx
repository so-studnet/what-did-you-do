"use client";

import { type FormEvent, useState } from "react";
import {
  type Activity,
  type ActivityDraft,
  MAX_PLANNED_MIN,
  type StartInput,
  validateDraft,
  validateStartInput,
} from "@/lib/domain/activity";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/domain/datetime-local";
import type { Tag } from "@/lib/domain/tag";
import { DeleteButton, Modal, closeEnclosingDialog, inputClass } from "./modal";
import { TagPicker } from "./tag-picker";

export type EditTarget =
  | { kind: "edit"; activity: Activity }
  | { kind: "add"; startedAt: Date; endedAt: Date };

export function EditDialog({
  target,
  tags,
  onSave,
  onDelete,
  onSaveAsTemplate,
  onClose,
}: {
  target: EditTarget;
  tags: readonly Tag[];
  onSave: (draft: ActivityDraft) => void;
  onDelete?: () => void;
  onSaveAsTemplate?: (input: StartInput) => void;
  onClose: () => void;
}) {
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
  const [tagIds, setTagIds] = useState<string[]>(isEdit ? target.activity.tagIds : []);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
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
      tagIds,
    };
    const result = validateDraft(draft, new Date(), { requireEnd: !isRunning });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.value);
    closeEnclosingDialog(e);
  };

  return (
    <Modal title={isEdit ? "記録を編集" : "記録を追加"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-1 text-sm">
          タグ
          <TagPicker tags={tags} value={tagIds} onChange={setTagIds} />
        </div>

        {onSaveAsTemplate && (
          <button
            type="button"
            disabled={templateSaved}
            onClick={() => {
              const r = validateStartInput({
                title,
                plannedMin: planned === "" ? null : Number(planned),
                tagIds,
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              onSaveAsTemplate(r.value);
              setError(null);
              setTemplateSaved(true);
            }}
            className="self-start text-sm text-blue-600 underline disabled:text-zinc-500 disabled:no-underline"
          >
            {templateSaved ? "テンプレートに保存しました" : "この内容をテンプレートにする"}
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {onDelete ? (
            <DeleteButton
              confirming={confirmingDelete}
              onClick={(e) => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                onDelete();
                closeEnclosingDialog(e);
              }}
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={closeEnclosingDialog} className="rounded-xl px-4 py-2 text-sm">
              キャンセル
            </button>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white">
              保存
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
