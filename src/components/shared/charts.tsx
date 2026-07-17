import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Small dashboard charts (recharts), themed via CSS variables so they
 * recolor with the theme toggle.
 */

export function TrendAreaChart({ data }: { data: number[] }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={1} />
        <XAxis dataKey="i" hide />
        <YAxis hide domain={['dataMin - 2', 'dataMax + 1']} />
        <Area
          type="monotone"
          dataKey="v"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface WeekBar {
  label: string;
  value: number;
  current?: boolean;
}

export function WeeklyBarChart({ data, height = 150 }: { data: WeekBar[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--faint))', fontSize: 10.5 }}
        />
        <YAxis hide />
        <Bar dataKey="value" radius={[7, 7, 3, 3]} maxBarSize={34} isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position="top"
            style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
          />
          {data.map((d, i) => (
            <Cell key={i} fill={d.current ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
