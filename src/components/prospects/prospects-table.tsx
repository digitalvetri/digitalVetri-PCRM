"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type ColumnDef,
  type RowSelectionState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Prospect, Company, CompanyAnalysis, DecisionMaker, User } from "@prisma/client";
import { MoreHorizontal, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScoreBar } from "@/components/shared/score";
import { GradeBadge, StatusBadge } from "@/components/shared/grade-badge";
import { formatDate, formatINR } from "@/lib/utils";
import { PROSPECT_STATUSES, INDUSTRIES } from "@/lib/constants";

export type ProspectRow = Prospect & {
  company: Company & {
    analysis: CompanyAnalysis | null;
    decisionMakers: DecisionMaker[];
  };
  assignedTo: User | null;
};

export function ProspectsTable({ prospects }: { prospects: ProspectRow[] }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [industryFilter, setIndustryFilter] = React.useState("ALL");
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [applying, setApplying] = React.useState(false);

  const filtered = React.useMemo(() => {
    return prospects.filter((p) => {
      if (search && !p.company.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (industryFilter !== "ALL" && p.company.industry !== industryFilter) return false;
      return true;
    });
  }, [prospects, search, statusFilter, industryFilter]);

  const columns = React.useMemo<ColumnDef<ProspectRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "prospectId",
        header: "Prospect ID",
        cell: ({ row }) => (
          <Link
            href={`/prospects/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.prospectId}
          </Link>
        ),
      },
      {
        id: "company",
        header: "Company",
        accessorFn: (r) => r.company.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.company.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.company.industry ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "location",
        header: "City / State",
        cell: ({ row }) => (
          <span className="text-sm">
            {[row.original.company.city, row.original.company.state].filter(Boolean).join(", ") || "—"}
          </span>
        ),
      },
      {
        id: "employees",
        header: "Employees",
        accessorFn: (r) => r.company.employeeEstimate ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.company.employeeEstimate ?? "—"}</span>
        ),
      },
      {
        id: "leadScore",
        header: "Lead Score",
        accessorFn: (r) => r.company.analysis?.leadScore ?? 0,
        cell: ({ row }) => {
          const a = row.original.company.analysis;
          if (!a) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-2">
              <div className="w-24">
                <ScoreBar score={a.leadScore} />
              </div>
              <GradeBadge grade={a.leadGrade} />
            </div>
          );
        },
      },
      {
        id: "crmScore",
        header: "CRM Score",
        accessorFn: (r) => r.company.analysis?.crmOpportunityScore ?? 0,
        cell: ({ row }) => {
          const a = row.original.company.analysis;
          return a ? (
            <div className="w-20">
              <ScoreBar score={a.crmOpportunityScore} />
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "automationScore",
        header: "Automation",
        accessorFn: (r) => r.company.analysis?.automationScore ?? 0,
        cell: ({ row }) => {
          const a = row.original.company.analysis;
          return a ? (
            <div className="w-20">
              <ScoreBar score={a.automationScore} />
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "assignedTo",
        header: "Assigned To",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.assignedTo?.name ?? "Unassigned"}</span>
        ),
      },
      {
        id: "nextFollowUp",
        header: "Next Follow-up",
        cell: ({ row }) => (
          <span className="text-sm">{formatDate(row.original.nextFollowUpDate)}</span>
        ),
      },
      {
        id: "proposalValue",
        header: "Proposal Value",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatINR(row.original.proposalValue)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/prospects/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { rowSelection, columnFilters },
    getRowId: (row) => row.id,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id);

  async function applyBulk() {
    if (!bulkStatus || selectedIds.length === 0) {
      toast.error("Select prospects and a status first.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/prospects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, data: { status: bulkStatus } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bulk update failed");
      toast.success(`Updated ${json.count} prospect${json.count === 1 ? "" : "s"}.`);
      setRowSelection({});
      setBulkStatus("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company name…"
            aria-label="Search prospects by company name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {PROSPECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Industries</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="flex flex-1 items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Change status to…" />
              </SelectTrigger>
              <SelectContent>
                {PROSPECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={applyBulk} disabled={applying || !bulkStatus} size="sm">
              {applying ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No prospects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} prospect
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
