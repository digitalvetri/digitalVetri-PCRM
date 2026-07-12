import { redirect } from "next/navigation";
import { getCurrentUser, roleCan } from "@/lib/rbac";
import { listEmployees } from "@/lib/hr";
import { PageHeader } from "@/components/shared/page-header";
import { TeamManager } from "@/components/team/team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!roleCan(user.role, "hr.manage")) redirect("/");

  const employees = await listEmployees();
  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    active: e.isActive,
    code: e.employeeProfile?.employeeCode ?? "—",
    designation: e.employeeProfile?.designation ?? null,
    department: e.employeeProfile?.department ?? null,
    joinDate: e.employeeProfile?.joinDate?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Create employee logins and manage your team. Employees sign in to their own private workspace." />
      <TeamManager employees={rows} />
    </div>
  );
}
