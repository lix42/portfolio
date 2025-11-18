import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

function DefaultError({ error }: { error: Error }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Page not found</h2>
    </div>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultError,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
