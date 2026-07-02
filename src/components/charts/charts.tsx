"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Brand-aligned categorical palette (indigo primary → red accent), tuned to
// stay distinguishable and legible in both light and dark mode.
const CHART_COLORS = ["#4557d6", "#12a3b4", "#7c5cf0", "#f59e0b", "#e0483b", "#0ea5e9", "#10b981", "#f43f5e"];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "12px",
    color: "hsl(var(--popover-foreground))",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function VerticalBarChart({
  data,
  color = "#4557d6",
  height = 280,
}: {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({
  data,
  color = "#4557d6",
  height = 280,
}: {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendAreaChart({
  data,
  dataKeys,
  height = 300,
}: {
  data: Record<string, unknown>[];
  dataKeys: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -12, right: 8 }}>
        <defs>
          {dataKeys.map((dk, i) => (
            <linearGradient key={dk.key} id={`grad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={dk.color ?? CHART_COLORS[i]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={dk.color ?? CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <Tooltip {...tooltipStyle} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />}
        {dataKeys.map((dk, i) => (
          <Area
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.label}
            stroke={dk.color ?? CHART_COLORS[i]}
            fill={`url(#grad-${dk.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLineChart({
  data,
  dataKeys,
  height = 300,
}: {
  data: Record<string, unknown>[];
  dataKeys: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
        {dataKeys.map((dk, i) => (
          <Line
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.label}
            stroke={dk.color ?? CHART_COLORS[i]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SalesFunnelChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip {...tooltipStyle} />
        <Funnel dataKey="value" data={data} isAnimationActive>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
          <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={11} />
          <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={12} fontWeight={600} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      No data to display yet.
    </div>
  );
}
