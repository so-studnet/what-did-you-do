import type { Metadata } from "next";
import { TagManager } from "@/components/tag-manager";

export const metadata: Metadata = { title: "タグ | What did you do" };

export default function TagsPage() {
  return (
    <>
      <h1 className="text-xl font-bold">タグ</h1>
      <TagManager />
    </>
  );
}
