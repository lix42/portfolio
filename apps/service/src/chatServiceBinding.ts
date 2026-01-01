import type { HealthResponse } from '@portfolio/shared';

import type { answerQuestion } from './chat';

export interface ChatServiceBinding {
  fetch(request: Request | string | URL): Response | Promise<Response>;
  health(): Promise<HealthResponse>;
  chat(message: string): ReturnType<typeof answerQuestion>;
}
