import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { pool } from "./db";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: User;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("No SESSION_SECRET env var set, using a default value");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ExpenseTrack-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      } finally {
        // Release the client back to the pool
        client.release();
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      const user = result.rows[0];
      done(null, user);
    } catch (err) {
      done(err);
    } finally {
      // Release the client back to the pool
      client.release();
    }
  });

  app.post("/api/register", async (req, res, next) => {
    console.log("Register endpoint hit with data:", req.body);
    const client = await pool.connect();
    try {
      // Validate input
      const userData = insertUserSchema.parse(req.body);
      const { username, password, name, email } = userData;
      console.log("Validated user data:", userData);
      // Check for existing user
      const existingUserResult = await client.query('SELECT * FROM users WHERE username = $1', [username]);
      if (existingUserResult.rows.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }
      console.log("No existing user found, proceeding to create user",password);


      // Hash password and insert user
      const hashedPassword = await hashPassword(password);
      console.log(hashedPassword);
      console.log("Inserting user into database:", { username, name, email });
      const insertResult = await client.query(
        'INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING id, username, name, email',
        [username, hashedPassword, name, email]
      );
      const user = insertResult.rows[0];
      console.log("Created new user:", user);

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        next(error);
      }
    } finally {
      // Release the client back to the pool
      client.release();
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't return password in response
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Don't return password in response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}