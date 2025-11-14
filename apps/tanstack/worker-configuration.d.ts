interface ChatServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare namespace Cloudflare {
  interface Env {
    VALUE_FROM_CLOUDFLARE: string;
    CHAT_SERVICE: ChatServiceBinding;
  }
}

interface Env extends Cloudflare.Env {}

declare module 'cloudflare:workers' {
  export const env: Env;
}
