import type { HealthResponse } from '@portfolio/shared';

import { Button } from './ui/button';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from './ui/item';
import { LoadingEllipsis } from './ui/loading-ellipsis';

import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { cn } from '~/lib/utils';

export interface HealthStatusProps {
  message: string;
  errorMessage?: string;
  health: HealthResponse;
  refetch: () => void;
  isLoading?: boolean;
}

export function HealthStatus({
  message,
  health,
  errorMessage,
  refetch,
  isLoading = false,
}: HealthStatusProps) {
  return (
    <Card className="w-full max-w-2xl">
      {isLoading && <LoadingEllipsis className="self-center -mb-6" />}
      <CardHeader>
        <CardTitle>Service Health Check</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Status</ItemTitle>
              <ItemDescription>Current service availability</ItemDescription>
            </ItemContent>
            <ItemContent>
              <Badge variant={health.ok ? 'default' : 'destructive'}>
                {health.ok ? 'Healthy' : 'Unavailable'}
              </Badge>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Version</ItemTitle>
              <ItemDescription>Service version number</ItemDescription>
            </ItemContent>
            <ItemContent>
              <Badge variant="outline">{health.version}</Badge>
            </ItemContent>
          </Item>
          {errorMessage && (
            <Item
              variant="outline"
              className="border-destructive/50 bg-destructive/10"
            >
              <ItemContent>
                <ItemTitle>Error</ItemTitle>
                <ItemDescription className="text-destructive">
                  {errorMessage}
                </ItemDescription>
              </ItemContent>
            </Item>
          )}
          <ItemSeparator />
          <ItemGroup>
            <Item
              variant="outline"
              size="sm"
              className={cn(
                !health.services.d1.ok &&
                  'border-destructive/50 bg-destructive/10'
              )}
            >
              <ItemContent>
                <ItemTitle>D1</ItemTitle>
                {!health.services.d1.ok && (
                  <ItemDescription className={'text-destructive'}>
                    {health.services.d1.message}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemContent>
                <Badge
                  variant={health.services.d1.ok ? 'default' : 'destructive'}
                >
                  {health.services.d1.ok ? 'Healthy' : 'Unavailable'}
                </Badge>
              </ItemContent>
            </Item>

            <Item
              variant="outline"
              size="sm"
              className={cn(
                !health.services.r2.ok &&
                  'border-destructive/50 bg-destructive/10'
              )}
            >
              <ItemContent>
                <ItemTitle>R2</ItemTitle>
                {!health.services.r2.ok && (
                  <ItemDescription className={'text-destructive'}>
                    {health.services.r2.message}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemContent>
                <Badge
                  variant={health.services.r2.ok ? 'default' : 'destructive'}
                >
                  {health.services.r2.ok ? 'Healthy' : 'Unavailable'}
                </Badge>
              </ItemContent>
            </Item>

            <Item
              variant="outline"
              size="sm"
              className={cn(
                !health.services.vectorize.ok &&
                  'border-destructive/50 bg-destructive/10'
              )}
            >
              <ItemContent>
                <ItemTitle>Vectorize</ItemTitle>
                {!health.services.vectorize.ok && (
                  <ItemDescription className={'text-destructive'}>
                    {health.services.vectorize.message}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemContent>
                <Badge
                  variant={
                    health.services.vectorize.ok ? 'default' : 'destructive'
                  }
                >
                  {health.services.vectorize.ok ? 'Healthy' : 'Unavailable'}
                </Badge>
              </ItemContent>
            </Item>
          </ItemGroup>
        </ItemGroup>
      </CardContent>
      <CardFooter>
        <Button variant="default" onClick={() => refetch()}>
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
