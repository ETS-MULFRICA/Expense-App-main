// Setup authentication and session middleware before routes
// Import Express framework and TypeScript types
import express, { type Request, Response, NextFunction } from "express";
// Import our custom API routes
import { registerRoutes } from "./routes";
// Import Vite development server setup and static file serving
import { setupVite, serveStatic, log } from "./vite";
import { runMigrationScript } from "./db";

import dotenv from 'dotenv';
dotenv.config();

// Create Express application instance
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());
// Middleware to parse URL-encoded form data
app.use(express.urlencoded({ extended: false }));

// Setup authentication and session middleware before routes
import { setupAuth } from "./auth";
setupAuth(app);

/**
 * Request Logging Middleware
 * Logs API requests with timing information and response data
 * - Captures request start time
 * - Intercepts JSON responses to log response data
 * - Calculates and logs request duration
 * - Only logs API routes (paths starting with /api)
 * - Truncates long log lines to keep output readable
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Override res.json to capture response data
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log when response is finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Truncate long log lines for readability
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Server Initialization Function
 * Sets up the entire server with routes, error handling, and static serving
 * - Registers API routes
 * - Sets up error handling middleware
 * - Configures development/production serving
 * - Starts server on port 5000
 */
(async () => {
  // Register all API routes and get HTTP server instance
  const server = await registerRoutes(app);

  /**
   * Global Error Handler Middleware
   * Catches all errors thrown by route handlers
   * - Extracts status code (defaults to 500)
   * - Extracts error message (defaults to "Internal Server Error")
   * - Sends JSON error response
   * - Re-throws error for logging/debugging
   */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Configure serving strategy based on environment
  if (app.get("env") === "development") {
    // Development: Setup Vite dev server for hot reloading
    await setupVite(app, server);
  } else {
    // Production: Serve pre-built static files
    serveStatic(app);
  }

  /**
   * Server Startup
   * Starts the HTTP server on port 5000
   * - Serves both API and client on the same port
   * - Uses 0.0.0.0 to accept connections from any IP
   * - Enables port reuse for development restarts
   */
  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    runMigrationScript();
  });
})();
export default app;