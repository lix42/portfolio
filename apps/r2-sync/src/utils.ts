/**
 * Helper function to limit concurrent operations
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (x: T) => Promise<R>
): Promise<R[]> {
  const out: Array<R | undefined> = new Array(items.length);
  let i = 0;
  const workers = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    });
  await Promise.all(workers);
  return out.filter((x): x is R => x !== undefined);
}
