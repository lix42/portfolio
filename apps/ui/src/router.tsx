import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { routeTree } from './routeTree.gen';

function NotFound() {
  return (
    <div className="p-4">
      <h2>Page not found</h2>
    </div>
  );
}

export function getRouter() {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
