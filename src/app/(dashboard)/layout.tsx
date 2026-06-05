import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ProfileProvider } from "@/lib/profile-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
