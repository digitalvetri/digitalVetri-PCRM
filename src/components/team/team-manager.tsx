"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  code: string;
  designation: string | null;
  department: string | null;
  joinDate: string | null;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export function TeamManager({ employees }: { employees: EmployeeRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((o) => !o)}>
          <UserPlus className="h-4 w-4" /> {open ? "Close" : "Add employee"}
        </Button>
      </div>

      {open && <AddEmployeeForm onDone={() => { setOpen(false); router.refresh(); }} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No employees yet. Add your first one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Code</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Designation</th>
                    <th className="py-2">Department</th>
                    <th className="py-2">Joined</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{e.code}</td>
                      <td className="py-2 font-medium">{e.name}</td>
                      <td className="py-2 text-muted-foreground">{e.email}</td>
                      <td className="py-2">{e.designation ?? "—"}</td>
                      <td className="py-2">{e.department ?? "—"}</td>
                      <td className="py-2">{fmtDate(e.joinDate)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={e.active ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"}>
                          {e.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddEmployeeForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({
    name: "",
    email: "",
    password: "",
    employeeCode: "",
    designation: "",
    department: "",
    phone: "",
    joinDate: "",
    baseSalary: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.email || !f.password || !f.employeeCode) {
      toast.error("Name, email, password and employee code are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/team/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name,
          email: f.email,
          password: f.password,
          employeeCode: f.employeeCode,
          designation: f.designation || undefined,
          department: f.department || undefined,
          phone: f.phone || undefined,
          joinDate: f.joinDate || undefined,
          baseSalary: f.baseSalary ? Number(f.baseSalary) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create employee");
      toast.success(`${f.name} can now sign in with their email and this password.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New employee</CardTitle>
        <p className="text-xs text-muted-foreground">
          You set the starting email &amp; password — the employee can change their password after signing in.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name *" value={f.name} onChange={set("name")} />
          <Field label="Email (login) *" type="email" value={f.email} onChange={set("email")} />
          <Field label="Temporary password *" type="text" value={f.password} onChange={set("password")} placeholder="min 8 characters" />
          <Field label="Employee code *" value={f.employeeCode} onChange={set("employeeCode")} placeholder="e.g. DV-E-001" />
          <Field label="Designation" value={f.designation} onChange={set("designation")} />
          <Field label="Department" value={f.department} onChange={set("department")} />
          <Field label="Phone" value={f.phone} onChange={set("phone")} />
          <Field label="Join date" type="date" value={f.joinDate} onChange={set("joinDate")} />
          <Field label="Base salary (₹/month)" type="number" value={f.baseSalary} onChange={set("baseSalary")} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create employee
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
