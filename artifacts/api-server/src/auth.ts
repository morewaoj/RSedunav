import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@workspace/db";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Secure password hashing with scrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  if (!hashedPassword || !salt) {
    // No valid hash format - password is invalid
    return false;
  }
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashedPassword, "hex"), buf);
}

export function setupAuth(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === "production";
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: "sessionId", // Don't use default 'connect.sid' for security
    cookie: {
      httpOnly: true, // Prevents client-side JS from accessing cookie
      secure: isProduction, // HTTPS only in production
      sameSite: "lax", // Prevents CSRF attacks
      maxAge: sessionTtl,
      path: "/",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Login attempt for username: ${username}`);
        const user = await storage.getUserByUsername(username);
        console.log(`User found: ${user ? 'Yes' : 'No'}`);
        
        if (!user) {
          console.log(`No user found with username: ${username}`);
          return done(null, false);
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        console.log(`Password match: ${passwordMatch}`);
        
        if (!passwordMatch) {
          console.log(`Password mismatch for user: ${username}`);
          return done(null, false);
        }
        
        console.log(`Login successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        console.error("Login authentication error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      
      if (!username || !password) {
        res.status(400).json({ message: "Username and password are required" });
        return;
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        res.status(400).json({ message: "Username already exists" });
        return;
      }

      console.log(`Registration attempt for username: ${username}`);
      
      // Hash password before storing
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username,
        password: hashedPassword,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
    return;
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt for username:', req.body.username);
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login authentication error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Login failed - no user found or invalid credentials');
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Login session error:', loginErr);
          return next(loginErr);
        }
        
        console.log('Login successful for user:', user.id);
        res.status(200).json({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin || false,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
      return;
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      res.sendStatus(401);
      return;
    }
    res.json({
      id: req.user!.id,
      username: req.user!.username,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      isAdmin: req.user!.isAdmin || false,
    });
  });

  // Alias for /api/auth/user (frontend compatibility)
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.json({
      id: req.user!.id,
      username: req.user!.username,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      isAdmin: req.user!.isAdmin || false,
    });
  });
}

export const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};