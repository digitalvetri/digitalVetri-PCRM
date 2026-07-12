"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/misc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { initials } from "@/lib/utils";

type Role = "ADMIN" | "MANAGER" | "SALES" | "VIEWER" | "EMPLOYEE";

// EMPLOYEE is intentionally not assignable here — employees are created and
// managed in the Team module (with a login), not via this role dropdown.
const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES", "VIEWER"];

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  imageUrl: string | null;
}

export function TeamManager({
  users,
  currentUserId,
}: {
  users: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function patchUser(id: string, body: Partial<Pick<TeamMember, "role" | "isActive">>) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success("Team member updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const busy = pendingId === u.id;
          return (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    {u.imageUrl && <AvatarImage src={u.imageUrl} alt={u.name} />}
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.name}
                      {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                      {!u.isActive && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Pending approval
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  disabled={busy || isSelf}
                  onValueChange={(v) => patchUser(u.id, { role: v as Role })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <Switch
                  aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.name}`}
                  checked={u.isActive}
                  disabled={busy || isSelf}
                  onCheckedChange={(checked) => patchUser(u.id, { isActive: checked })}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
