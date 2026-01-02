import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export type ServiceHealth = {
  ok: boolean;
  version: string;
  error: string | null;
};

export interface HealthStatusProps {
  message: string;
  health: ServiceHealth;
}

export function HealthStatus({ message, health }: HealthStatusProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Service Health Check</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Status</div>
            <div className="text-xs text-muted-foreground">
              Current service availability
            </div>
          </div>
          <Badge variant={health.ok ? 'default' : 'destructive'}>
            {health.ok ? 'Healthy' : 'Unavailable'}
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Version</div>
            <div className="text-xs text-muted-foreground">
              Service version number
            </div>
          </div>
          <Badge variant="outline">{health.version}</Badge>
        </div>

        {health.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium text-destructive">
                  Error Details
                </div>
                <div className="text-sm text-muted-foreground">
                  {health.error}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
