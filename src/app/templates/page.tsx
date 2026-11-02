import type { Metadata } from "next";
import { TemplateManager } from "@/components/template-manager";

export const metadata: Metadata = { title: "テンプレート | What did you do" };

export default function TemplatesPage() {
  return (
    <>
      <h1 className="text-xl font-bold">テンプレート</h1>
      <TemplateManager />
    </>
  );
}
