import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { HealthStatus } from "~/components/HealthStatus";
import { healthQueryOptions } from "~/lib/health";

export const Route = createFileRoute("/health/")({
  component: Health,
});

function Health() {
  const { data, isFetching, refetch } = useSuspenseQuery(healthQueryOptions);

  return (
    <HealthStatus
      message={data.message}
      health={data.health}
      errorMessage={data.errorMessage}
      isLoading={isFetching}
      refetch={refetch}
    />
  );
}
