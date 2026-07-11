import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useTranslation } from "@/components/locale-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminStatsTimeseries } from "@/services/admin-service";

function formatTick(value: string): string {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function formatTooltipLabel(value: unknown): string {
  if (typeof value !== "string") return String(value);
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

interface AdminTrendsChartsProps {
  timeseries: AdminStatsTimeseries | null;
  isLoading: boolean;
  error?: Error | null;
}

export function AdminTrendsCharts({
  timeseries,
  isLoading,
  error,
}: AdminTrendsChartsProps) {
  const { t } = useTranslation();

  const signupsConfig = useMemo(
    () =>
      ({
        count: {
          label: t("admin.trends.chartSignups"),
          color: "hsl(var(--chart-1))",
        },
      }) satisfies ChartConfig,
    [t]
  );

  const workflowsConfig = useMemo(
    () =>
      ({
        count: {
          label: t("admin.trends.chartWorkflows"),
          color: "hsl(var(--chart-2))",
        },
      }) satisfies ChartConfig,
    [t]
  );

  const executionsConfig = useMemo(
    () =>
      ({
        successCount: {
          label: t("admin.trends.chartSucceeded"),
          color: "hsl(var(--chart-2))",
        },
        errorCount: {
          label: t("admin.trends.chartFailed"),
          color: "hsl(var(--chart-5))",
        },
      }) satisfies ChartConfig,
    [t]
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.trends.title")}</CardTitle>
          <CardDescription>
            {t("admin.trends.loadError")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {error.message}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !timeseries) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-video w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { signups, workflowsCreated, executions } = timeseries.series;
  const days = String(timeseries.range.days);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.trends.signups")}</CardTitle>
          <CardDescription>
            {t("admin.trends.signupsDesc", { days })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={signupsConfig}>
            <AreaChart data={signups} margin={{ left: 4, right: 4 }}>
              <defs>
                <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                width={32}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={formatTooltipLabel}
                  />
                }
              />
              <Area
                dataKey="count"
                type="monotone"
                fill="url(#fillSignups)"
                stroke="var(--color-count)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.trends.workflowsCreated")}</CardTitle>
          <CardDescription>
            {t("admin.trends.workflowsCreatedDesc", { days })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={workflowsConfig}>
            <AreaChart data={workflowsCreated} margin={{ left: 4, right: 4 }}>
              <defs>
                <linearGradient id="fillWorkflows" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                width={32}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={formatTooltipLabel}
                  />
                }
              />
              <Area
                dataKey="count"
                type="monotone"
                fill="url(#fillWorkflows)"
                stroke="var(--color-count)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.trends.executions")}</CardTitle>
          <CardDescription>
            {t("admin.trends.executionsDesc", { days })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={executionsConfig}>
            <AreaChart data={executions} margin={{ left: 4, right: 4 }}>
              <defs>
                <linearGradient id="fillSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-successCount)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-successCount)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillError" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-errorCount)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-errorCount)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                width={32}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={formatTooltipLabel}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="successCount"
                type="monotone"
                stackId="1"
                fill="url(#fillSuccess)"
                stroke="var(--color-successCount)"
                strokeWidth={2}
              />
              <Area
                dataKey="errorCount"
                type="monotone"
                stackId="1"
                fill="url(#fillError)"
                stroke="var(--color-errorCount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
