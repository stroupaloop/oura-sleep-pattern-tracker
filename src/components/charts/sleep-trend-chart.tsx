"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SleepData {
  day: string;
  hours: number;
  deep: number;
  rem: number;
  light: number;
  efficiency: number;
  hrv: number;
  hr: number;
}

export function SleepTrendChart({ data }: { data: SleepData[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sleep Duration</CardTitle>
          <CardDescription>Total hours by sleep stage (last 30 nights)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                fontSize={12}
              />
              <YAxis
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}h`}
                fontSize={12}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${Number(value).toFixed(1)}h`,
                  String(name).charAt(0).toUpperCase() + String(name).slice(1),
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="deep"
                stackId="1"
                stroke="#1e40af"
                fill="#3b82f6"
                name="Deep"
              />
              <Area
                type="monotone"
                dataKey="rem"
                stackId="1"
                stroke="#7c3aed"
                fill="#a78bfa"
                name="REM"
              />
              <Area
                type="monotone"
                dataKey="light"
                stackId="1"
                stroke="#0891b2"
                fill="#67e8f9"
                name="Light"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Heart Rate Variability</CardTitle>
            <CardDescription>Average HRV during sleep (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${Number(value).toFixed(0)} ms`, "HRV"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="hrv"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="HRV"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resting Heart Rate</CardTitle>
            <CardDescription>Average HR during sleep (bpm)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    `${Number(value).toFixed(0)} bpm`,
                    "Heart Rate",
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="Heart Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
