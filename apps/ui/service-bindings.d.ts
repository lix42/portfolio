/**
 * Service Bindings Type Definitions
 *
 * This file provides type references for Cloudflare Worker service bindings.
 * It includes the service worker's type definitions to ensure CloudflareBindings
 * is available when TypeScript resolves service binding types.
 *
 * This is a workaround for a known wrangler types issue:
 * https://github.com/cloudflare/workers-sdk/issues/8902
 *
 * Unlike worker-configuration.d.ts (which is auto-generated), this file is
 * manually maintained and won't be overwritten by `wrangler types`.
 */

/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../service/worker-configuration.d.ts" />
