import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { useI18n } from "@/i18n/react";
export default function LatencyChart({
  chart,
}: {
  chart: Array<{ n: number; ms: number }>;
}) {
  const { t } = useI18n();
  return (
    <div style={{ height: 125, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart}>
          <defs>
            <linearGradient id="latency-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="n" hide />
          <Tooltip
            formatter={(value) => [value + " ms", t("Round trip")]}
            contentStyle={{
              background: "var(--surface)",
              borderColor: "var(--line)",
              color: "var(--text)",
              borderRadius: 6,
            }}
            itemStyle={{ color: "var(--accent)" }}
          />
          <Area
            type="monotone"
            dataKey="ms"
            stroke="var(--accent)"
            fill="url(#latency-fill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
