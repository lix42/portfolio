import type { HealthResponse } from '@portfolio/shared';

interface ServiceStatus {
  ok: boolean;
  message?: string;
}

async function checkD1(db: D1Database): Promise<ServiceStatus> {
  try {
    await db.prepare('SELECT 1').first();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'D1 check failed',
    };
  }
}

async function checkR2(bucket: R2Bucket): Promise<ServiceStatus> {
  try {
    // List with limit 1 to minimize overhead
    await bucket.list({ limit: 1 });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'R2 check failed',
    };
  }
}

async function checkVectorize(index: VectorizeIndex): Promise<ServiceStatus> {
  try {
    // Describe the index to verify connectivity
    await index.describe();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Vectorize check failed',
    };
  }
}

export async function health(env: CloudflareBindings): Promise<HealthResponse> {
  const version = JSON.stringify(env.CF_VERSION_METADATA);

  const [d1Status, r2Status, vectorizeStatus] = await Promise.all([
    checkD1(env.DB),
    checkR2(env.DOCUMENTS),
    checkVectorize(env.VECTORIZE),
  ]);

  const allHealthy = d1Status.ok && r2Status.ok && vectorizeStatus.ok;

  return {
    ok: allHealthy,
    version,
    services: {
      d1: d1Status,
      r2: r2Status,
      vectorize: vectorizeStatus,
    },
  };
}
