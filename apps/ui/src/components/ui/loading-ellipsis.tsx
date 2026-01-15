import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '~/lib/utils';

const loadingEllipsisVariants = cva('relative inline-block', {
  variants: {
    size: {
      sm: 'w-8',
      default: 'w-12',
      lg: 'w-16',
    },
    variant: {
      primary: 'text-(--primary)',
      secondary: 'text-(--secondary-foreground)',
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'primary',
  },
});

export interface LoadingEllipsisProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingEllipsisVariants> {}

export function LoadingEllipsis({
  className,
  size,
  variant,
  ...props
}: LoadingEllipsisProps) {
  const counts = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        loadingEllipsisVariants({ size, variant }),
        'h-2',
        className
      )}
      {...props}
    >
      {Array.from({ length: counts }, (_, i) => (
        <span
          key={i}
          className={cn(
            'absolute top-1/2 rounded-full bg-current',
            'size-2',
            '-translate-y-1/2',
            i === 0 && 'left-2 animate-ellipsis-scale-in',
            i === 1 && 'left-2 animate-ellipsis-move',
            i === 2 && 'left-6',
            i === 3 && 'left-10',
            i === 4 && 'left-14',
            i > 0 && i < counts - 1 && 'animate-ellipsis-move',
            i === counts - 1 && 'animate-ellipsis-scale-out'
          )}
        />
      ))}
    </div>
  );
}
