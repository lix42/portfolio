import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

const loadingEllipsisVariants = cva("relative inline-block h-2 -mb-2", {
  variants: {
    size: {
      sm: "w-8",
      default: "w-12",
      lg: "w-16",
    },
    variant: {
      primary: "text-(--primary)",
      secondary: "text-(--secondary-foreground)",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "primary",
  },
});

export interface LoadingEllipsisProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingEllipsisVariants> {}

export function LoadingEllipsis({
  className,
  size,
  variant,
  ...props
}: LoadingEllipsisProps) {
  const counts = size === "sm" ? 3 : size === "lg" ? 5 : 4;
  const positionClasses = ["left-2", "left-6", "left-10", "left-14"];
  const spotClasses =
    "absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-current";
  return (
    // biome-ignore lint/a11y/useSemanticElements: Using div with role for styling flexibility
    <div
      role="status"
      aria-label="Loading"
      className={cn(loadingEllipsisVariants({ size, variant }), className)}
      {...props}
    >
      {/* first dot scaling in */}
      <span
        className={cn(
          spotClasses,
          positionClasses[0],
          "animate-ellipsis-scale-in",
        )}
      />
      {/* moving dots */}
      {Array.from({ length: counts - 2 }, (_, i) => {
        const positionClass = positionClasses[i];
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: Static array with fixed order
            key={i}
            className={cn(spotClasses, positionClass, "animate-ellipsis-move")}
          />
        );
      })}
      {/* last dot scaling out */}
      <span
        className={cn(
          spotClasses,
          positionClasses[counts - 1 - 1],
          "animate-ellipsis-scale-out",
        )}
      />
    </div>
  );
}
