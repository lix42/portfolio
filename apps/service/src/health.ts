// Health check function
export const health = (version = 'unknown') => {
  return { ok: true, version };
};

export type HealthResponse = ReturnType<typeof health>;
