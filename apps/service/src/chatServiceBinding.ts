import type { answerQuestion } from './chat';

export interface ChatServiceBinding {
  fetch(request: Request): Response | Promise<Response>;
  health(): Promise<{
    ok: boolean;
  }>;
  chat(message: string): ReturnType<typeof answerQuestion>;
}
