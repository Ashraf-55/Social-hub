import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardChrome } from "@/components/layout/DashboardChrome";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardChrome>{children}</DashboardChrome>;
}
