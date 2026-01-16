/**
 * R2 Reconciliation Worker
 *
 * Self-healing system that discovers and processes documents
 * that were missed by R2 event notifications.
 *
 * Runs daily at 2 AM UTC via cron trigger, or manually via POST /reconcile
 */

import { reconcileR2Documents } from "./reconcile";

export default {
  /**
   * Scheduled cron handler - runs daily at 2 AM UTC
   */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log("Starting scheduled reconciliation...");

    ctx.waitUntil(
      reconcileR2Documents(env).catch((error) => {
        console.error("Reconciliation failed:", error);
      }),
    );
  },

  /**
   * HTTP fetch handler for manual triggers and health checks
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "r2-reconciliation",
          version: "1.0.0",
          environment: env.ENVIRONMENT,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Manual reconciliation trigger
    if (url.pathname === "/reconcile" && request.method === "POST") {
      console.log("Starting manual reconciliation...");

      // Run reconciliation in the background
      const resultPromise = reconcileR2Documents(env);
      ctx.waitUntil(resultPromise);

      // Wait for result to return it in response
      try {
        const result = await resultPromise;
        return new Response(
          JSON.stringify({
            status: "success",
            message: "Reconciliation completed",
            result,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Reconciliation failed:", error);
        return new Response(
          JSON.stringify({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
