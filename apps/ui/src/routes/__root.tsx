/// <reference types="vite/client" />
import {
  HealthIcon,
  HeartCheckIcon,
  HeartRemoveIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ModeToggle } from "~/components/ModeToggler";
import { Button } from "~/components/ui/button";
import { healthQueryOptions } from "~/lib/health";
import { cn } from "~/lib/utils";
import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "TanStack Start prototype that calls the @portfolio/service health endpoint.",
      },
      { title: "Portfolio TanStack Start Prototype" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(healthQueryOptions);
  },
  component: RootDocument,
});

function RootDocument() {
  const { data } = useQuery(healthQueryOptions);
  const healthOK = data?.health?.ok;
  const healthIcon = healthOK
    ? HeartCheckIcon
    : healthOK === false
      ? HeartRemoveIcon
      : HealthIcon;
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background">
        <header className="border-b relative">
          <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Link to="/">
              <h1 className="text-3xl font-bold tracking-wider text-foreground">
                Portfolio
              </h1>
            </Link>
          </div>
          <div className="absolute top-2 end-2 flex gap-1">
            <Button
              render={
                <Link
                  to="/health"
                  className={cn([
                    healthOK && "text-primary",
                    healthOK === false && "text-destructive",
                  ])}
                />
              }
              variant="ghost"
              aria-label="health"
            >
              <HugeiconsIcon icon={healthIcon} />
            </Button>
            <ModeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              {
                name: "TanStack Query",
                render: <ReactQueryDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
