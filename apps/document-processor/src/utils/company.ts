/**
 * Get or create company by name
 */
export async function getOrCreateCompany(
  companyName: string,
  db: D1Database,
): Promise<number> {
  // Try to find existing company
  const existing = await db
    .prepare("SELECT id FROM companies WHERE name = ?")
    .bind(companyName)
    .first<{ id: number }>();

  if (existing) {
    return existing.id;
  }

  // Create new company with placeholder data
  const result = await db
    .prepare(
      `INSERT INTO companies (name, start_time, title, description, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       RETURNING id`,
    )
    .bind(
      companyName,
      "2020-01-01", // Placeholder start time
      "Unknown", // Placeholder title
      `Company entry auto-created for ${companyName}`, // Placeholder description
    )
    .first<{ id: number }>();

  if (!result) {
    throw new Error(`Failed to create company: ${companyName}`);
  }

  console.log(
    `Created new company ${companyName} with ID ${result.id} (placeholder data)`,
  );

  return result.id;
}
