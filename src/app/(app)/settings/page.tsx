import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import {
  CompanyProfileForm,
  AiProviderForm,
} from "@/components/settings/settings-forms";
import { TeamManager, type TeamMember } from "@/components/settings/team-manager";
import { getCurrentUser, roleCan } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/constants";
import { initials, enumLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const canManage = roleCan(user.role, "settings.manage");
  const canManageUsers = roleCan(user.role, "users.manage");

  const settings = await loadSettings();
  const users: TeamMember[] = canManageUsers
    ? await prisma.user.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          imageUrl: true,
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, company details, AI provider and team." />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
          <TabsTrigger value="ai">AI Provider</TabsTrigger>
          {canManageUsers && <TabsTrigger value="team">Team &amp; Roles</TabsTrigger>}
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
                  <AvatarFallback className="text-base">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge variant="secondary">{enumLabel(user.role)}</Badge>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Profile details are managed through your sign-in provider. Contact an administrator
                to change your role.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Profile */}
        <TabsContent value="company">
          <CompanyProfileForm initial={settings.companyProfile} disabled={!canManage} />
        </TabsContent>

        {/* AI Provider */}
        <TabsContent value="ai">
          <AiProviderForm initialProvider={settings.aiProvider} disabled={!canManage} />
        </TabsContent>

        {/* Team & Roles */}
        {canManageUsers && (
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team &amp; Roles</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Assign roles and toggle access. You cannot change your own role or deactivate
                  yourself.
                </p>
              </CardHeader>
              <CardContent>
                <TeamManager users={users} currentUserId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* About */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About {BRAND.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{BRAND.name} {BRAND.productName}</span>{" "}
                helps sales teams research, score and pursue prospects using AI-driven insights.
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Website:</span> {BRAND.website}
                </p>
                <p>
                  <span className="font-medium text-foreground">Contact:</span> {BRAND.email}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-xs">
                <p className="mb-1 font-medium text-foreground">Ethical use</p>
                <p>
                  This platform uses only publicly available information (company websites, public
                  directories, published listings). Employee counts, revenue, budgets and scores are
                  AI estimates derived from public signals — always flagged as estimates, never
                  presented as verified facts.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
