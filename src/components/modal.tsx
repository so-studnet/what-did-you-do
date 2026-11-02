"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";

/** イベントが起きた要素を含むダイアログを閉じる */
export function closeEnclosingDialog(e: { currentTarget: Element }) {
  e.currentTarget.closest("dialog")?.close();
}

/** マウントすると開くモーダル。閉じるには closeEnclosingDialog を使う。 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-blue-500 dark:border-zinc-700";

/** 2回押すと実行される削除ボタン */
export function DeleteButton({
  confirming,
  onClick,
  confirmLabel = "本当に削除する",
}: {
  confirming: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  confirmLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-bold ${
        confirming ? "bg-red-600 text-white" : "text-red-600"
      }`}
    >
      {confirming ? confirmLabel : "削除"}
    </button>
  );
}
