import type { answerQuestion } from './chat';

export interface ChatServiceBinding {
  fetch(request: Request | string | URL): Response | Promise<Response>;
  health(): Promise<{
    ok: boolean;
    version: string;
  }>;
  chat(message: string): ReturnType<typeof answerQuestion>;
}
