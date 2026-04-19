"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

type ChartConfigItem = {
  label?: React.ReactNode;
  icon?: React.ComponentType;
} & (
  | { color?: string; theme?: never }
  | { color?: never; theme: Record<"light" | "dark", string> }
);

export type ChartConfig = Record<string, ChartConfigItem>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }

  return context;
}

function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactNode;
}) {
  const colorStyles = Object.entries(config).reduce<Record<string, string>>(
    (acc, [key, item]) => {
      acc[`--color-${key}`] = item.color ?? "var(--chart-1)";
      return acc;
    },
    {},
  );

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        style={colorStyles as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent(props: {
  active?: boolean;
  payload?: Array<{
    value?: unknown;
    name?: string;
    dataKey?: string | number;
    color?: string;
  }>;
  label?: unknown;
  className?: string;
  hideLabel?: boolean;
  labelFormatter?: (label: unknown, payload: unknown[]) => React.ReactNode;
  formatter?: (
    value: unknown,
    name: string,
    item: unknown,
    index: number,
  ) => React.ReactNode;
}) {
  const {
    active,
    payload,
    label,
    className,
    labelFormatter,
    formatter,
    hideLabel = false,
  } = props;
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const labelNode = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/95 px-3 py-2 shadow-xl backdrop-blur",
        className,
      )}
    >
      {!hideLabel && labelNode != null ? (
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
          {labelNode as React.ReactNode}
        </div>
      ) : null}
      <div className="space-y-1">
        {payload.map((item, index) => {
          const key = item.dataKey
            ? String(item.dataKey)
            : String(item.name ?? index);
          const configItem = config[key];
          const color = item.color ?? configItem?.color ?? "var(--chart-1)";
          const itemLabel = configItem?.label ?? item.name ?? key;
          const value = formatter
            ? formatter(item.value, String(item.name ?? key), item, index)
            : item.value;

          return (
            <div
              key={`${key}-${index}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{itemLabel}</span>
              </div>
              <span className="font-medium text-foreground">
                {value as React.ReactNode}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegendContent({
  payload,
  className,
}: React.ComponentProps<"div"> & {
  payload?: Array<{
    value?: string;
    color?: string;
    dataKey?: string | number;
  }>;
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {payload.map((item) => {
        const key = item.dataKey
          ? String(item.dataKey)
          : String(item.value ?? "");
        const configItem = config[key];
        const color = item.color ?? configItem?.color ?? "var(--chart-1)";
        const label = configItem?.label ?? item.value ?? key;

        return (
          <div
            key={key}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
};
