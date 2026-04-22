import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { QueryProvider } from "@/components/providers/QueryProvider";

export default function DashboardPage() {
  return (
    <main className="w-full p-0">
      <QueryProvider>
        <DashboardClient />
      </QueryProvider>
    </main>
  );
}
