import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: Tag = "section",
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "dp-card rounded-card border border-line bg-surface shadow-soft",
        "transition-colors duration-200",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5 sm:py-5", className)}>{children}</div>;
}
