import type { FastAPIContainer } from './src/worker';

export interface CloudflareContainerBindings {
  MY_FASTAPI_CONTAINER: DurableObjectNamespace<FastAPIContainer>;
  OPENAI_API_KEY: string;
}
