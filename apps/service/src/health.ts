// Health check function
export const health = (version: string = 'unknown') => {
  return { ok: true, version };
};

export type HealthResponse = ReturnType<typeof health>;
