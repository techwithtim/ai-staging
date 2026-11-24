export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupDatabase } = await import("./lib/db/setup");
    await setupDatabase();
  }
}
