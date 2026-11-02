"use client";

import { type FormEvent, useState } from "react";
import {
  MAX_TAG_NAME_LENGTH,
  TAG_COLORS,
  type Tag,
  descendantIds,
  flattenTagTree,
  formatTagPath,
  validateTagInput,
} from "@/lib/domain/tag";
import { useAppData } from "@/lib/hooks/use-app-data";
import { DeleteButton, Modal, closeEnclosingDialog, inputClass } from "./modal";

type DialogState = { kind: "create"; parentId: string | null } | { kind: "edit"; tag: Tag };

export function TagManager() {
  const { data, actions } = useAppData();
  const { tags } = data;
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const rows = flattenTagTree(tags);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        タグは「仕事 &gt; 会議」のように階層にできます。集計では子タグの時間が親タグにも合算されます。
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">タグはまだありません</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map(({ tag, depth }) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 py-1.5 pr-2"
              style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
            >
              {depth > 0 && <span className="text-zinc-400">└</span>}
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="min-w-0 flex-1 truncate">{tag.name}</span>
              <button
                type="button"
                onClick={() => setDialog({ kind: "create", parentId: tag.id })}
                aria-label={`「${tag.name}」に子タグを追加`}
                className="rounded-lg px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400"
              >
                ＋子タグ
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: "edit", tag })}
                aria-label={`「${tag.name}」を編集`}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
              >
                編集
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setDialog({ kind: "create", parentId: null })}
        className="self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
      >
        ＋ タグを追加
      </button>

      {dialog && (
        <TagDialog
          key={dialog.kind === "edit" ? dialog.tag.id : `new-${dialog.parentId}`}
          state={dialog}
          tags={tags}
          onClose={() => setDialog(null)}
          onSave={(input) =>
            dialog.kind === "edit" ? actions.updateTag(dialog.tag.id, input) : actions.createTag(input)
          }
          onDelete={dialog.kind === "edit" ? () => actions.deleteTag(dialog.tag.id) : undefined}
        />
      )}
    </div>
  );
}

function TagDialog({
  state,
  tags,
  onSave,
  onDelete,
  onClose,
}: {
  state: DialogState;
  tags: readonly Tag[];
  onSave: (input: { name: string; parentId: string | null; color: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const editing = state.kind === "edit" ? state.tag : null;
  const initialParent = editing ? editing.parentId : state.kind === "create" ? state.parentId : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(initialParent);
  const [color, setColor] = useState(
    editing?.color ?? tags.find((t) => t.id === initialParent)?.color ?? TAG_COLORS[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // 自分自身と子孫は親の候補から外す
  const excluded = editing ? new Set([editing.id, ...descendantIds(tags, editing.id)]) : new Set<string>();
  const parentOptions = flattenTagTree(tags).filter(({ tag }) => !excluded.has(tag.id));
  const childCount = editing ? tags.filter((t) => t.parentId === editing.id).length : 0;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = { name, parentId, color };
    const r = validateTagInput(tags, input, editing?.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onSave(r.value);
    closeEnclosingDialog(e);
  };

  return (
    <Modal title={editing ? "タグを編集" : "タグを追加"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          タグ名
          <input
            type="text"
            value={name}
            maxLength={MAX_TAG_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          親タグ
          <select
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value === "" ? null : e.target.value)}
            className={inputClass}
          >
            <option value="">（なし・いちばん上の階層）</option>
            {parentOptions.map(({ tag }) => (
              <option key={tag.id} value={tag.id}>
                {formatTagPath(tags, tag.id)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">色</legend>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="tag-color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="peer sr-only"
                />
                <span
                  aria-label={c}
                  className="block size-8 rounded-full ring-offset-2 ring-offset-white peer-checked:ring-2 peer-checked:ring-zinc-900 peer-focus-visible:ring-2 dark:ring-offset-zinc-900 dark:peer-checked:ring-zinc-100"
                  style={{ backgroundColor: c }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {confirmingDelete && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            このタグは記録とテンプレートから外れます。
            {childCount > 0 && `子タグ ${childCount} 個は1つ上の階層に移ります。`}
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
