export class WorkerEntrypoint<Env = unknown> {
  env: Env;
  ctx: ExecutionContext;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
