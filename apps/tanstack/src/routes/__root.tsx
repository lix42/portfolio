/// <reference types="vite/client" />

import { TanStackDevtools } from '@tanstack/react-devtools';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import { ModeToggle } from '~/components/ModeToggler';
import appCss from '~/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        name: 'description',
        content:
          'TanStack Start prototype that calls the @portfolio/service health endpoint.',
      },
      { title: 'Portfolio TanStack Start Prototype' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background">
        <header className="border-b relative">
          <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-wider text-foreground">
              Portfolio
            </h1>
            <p className="mt-2 text-muted-foreground">
              Tanstack Start Prototype
            </p>
          </div>
          <div className="absolute top-2 end-2">
            <ModeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        {import.meta.env.DEV ? (
          <>
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
                // {
                //   name: 'TanStack Query',
                //   render: <ReactQueryDevtoolsPanel />,
                // },
              ]}
            />
          </>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
