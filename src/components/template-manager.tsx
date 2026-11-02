"use client";

import { type FormEvent, useState } from "react";
import { MAX_PLANNED_MIN, type StartInput, validateStartInput } from "@/lib/domain/activity";
import type { Tag } from "@/lib/domain/tag";
import type { Template } from "@/lib/domain/template";
import { useAppData } from "@/lib/hooks/use-app-data";
import { formatMinutes } from "@/lib/format";
import { DeleteButton, Modal, closeEnclosingDialog, inputClass } from "./modal";
import { TagChips } from "./tag-chips";
import { TagPicker } from "./tag-picker";

type DialogState = { kind: "create" } | { kind: "edit"; template: Template };

export function TemplateManager() {
  const { data, actions } = useAppData();
  const { templates, tags } = data;
  const [dialog, setDialog] = useState<DialogState | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        テンプレートはホーム画面に並び、ワンタップで開始できます。記録の編集画面からも作れます。
      </p>
      {templates.length === 0 ? (
        <p className="text-sm text-zinc-500">テンプレートはまだありません</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {templates.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate">{t.title}</p>
                <p className="text-xs text-zinc-500">
                  {t.plannedMin === null ? "予定時間なし" : `予定 ${formatMinutes(t.plannedMin)}`}
                </p>
                <div className="mt-1">
                  <TagChips tags={tags} tagIds={t.tagIds} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => actions.moveTemplate(t.id, -1)}
                  disabled={i === 0}
                  aria-label={`「${t.title}」を上へ`}
                  className="rounded-lg px-2 py-1 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => actions.moveTemplate(t.id, 1)}
                  disabled={i === templates.length - 1}
                  aria-label={`「${t.title}」を下へ`}
                  className="rounded-lg px-2 py-1 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "edit", template: t })}
                  aria-label={`「${t.title}」を編集`}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                >
                  編集
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setDialog({ kind: "create" })}
        className="self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
      >
        ＋ テンプレートを追加
      </button>

      {dialog && (
        <TemplateDialog
          key={dialog.kind === "edit" ? dialog.template.id : "new"}
          template={dialog.kind === "edit" ? dialog.template : null}
          tags={tags}
          onClose={() => setDialog(null)}
          onSave={(input) =>
            dialog.kind === "edit"
              ? actions.updateTemplate(dialog.template.id, input)
              : actions.createTemplate(input)
          }
          onDelete={dialog.kind === "edit" ? () => actions.deleteTemplate(dialog.template.id) : undefined}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  template,
  tags,
  onSave,
  onDelete,
  onClose,
}: {
  template: Template | null;
  tags: readonly Tag[];
  onSave: (input: StartInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [planned, setPlanned] = useState(template?.plannedMin == null ? "" : String(template.plannedMin));
  const [tagIds, setTagIds] = useState<string[]>(template?.tagIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = validateStartInput({ title, plannedMin: planned === "" ? null : Number(planned), tagIds });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onSave(r.value);
    closeEnclosingDialog(e);
  };

  return (
    <Modal title={template ? "テンプレートを編集" : "テンプレートを追加"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          作業内容
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
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
