import type { answerQuestion } from './chat';
import type { HealthResponse } from './health';

export interface ChatServiceBinding {
  fetch(request: Request | string | URL): Response | Promise<Response>;
  health(): Promise<HealthResponse>;
  chat(message: string): ReturnType<typeof answerQuestion>;
}
