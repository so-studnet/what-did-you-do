import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">What did you do</h1>
      <Dashboard />
    </main>
  );
}
