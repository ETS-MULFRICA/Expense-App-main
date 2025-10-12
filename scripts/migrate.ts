import { runMigrationScript } from "../api/db";

runMigrationScript()
  .then(() => {
    console.log("Migrations applied successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
