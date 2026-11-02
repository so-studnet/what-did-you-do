import type { Metadata } from "next";
import { SummaryView } from "@/components/summary-view";

export const metadata: Metadata = { title: "集計 | What did you do" };

export default function SummaryPage() {
  return (
    <>
      <h1 className="text-xl font-bold">集計</h1>
      <SummaryView />
    </>
  );
}
