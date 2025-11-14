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
    <section className="health">
      <p className="health__message">{message}</p>
      <dl className="health__details" aria-label="Service health information">
        <div className="health__row">
          <dt>Status</dt>
          <dd className={health.ok ? 'health__value health__value--ok' : 'health__value health__value--error'}>
            {health.ok ? 'Healthy' : 'Unavailable'}
          </dd>
        </div>
        <div className="health__row">
          <dt>Version</dt>
          <dd className="health__value">{health.version}</dd>
        </div>
        {health.error ? (
          <div className="health__row">
            <dt>Error</dt>
            <dd className="health__value health__value--error">{health.error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
