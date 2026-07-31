import type {
  AuthSetupStatusResponse,
  GetSubAccountInvitationPreviewResponse,
  JWTTokenPayload,
  OrganizationInfo,
  PasswordAuthResponse,
  SendRegistrationCodeResponse,
} from "@dafthunk/types";
import { githubAuth } from "@hono/oauth-providers/github";
import { googleAuth } from "@hono/oauth-providers/google";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { ApiContext } from "./context";
import { LAZY_ROUTE_ORG_HEADER } from "./lazy-route";
import {
  createDatabase,
  EmailAlreadyRegisteredError,
  getLocalUserByEmail,
  getPublicSiteSettings,
  getSubAccountInvitationPreview,
  hasAnyUsers,
  OrganizationRole,
  registerLocalUser,
  registerSubAccountFromInvitation,
  resolveAuthProvider,
  saveUser,
  SubAccountInvitationError,
  userExists,
  users,
  verifyApiKey,
  getAuthConfig,
} from "./db";
import type { UserData } from "./db/queries";
import { memberships, organizations } from "./db/schema";
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
  verifyPassword,
} from "./auth/password";
import { validateJwtSecret } from "./auth/jwt-config";
import { resolveOAuthCredentials } from "./services/auth-config";
import {
  generateRegistrationVerificationCode,
  getRegistrationCodeCooldownRemaining,
  markRegistrationCodeSent,
  storeRegistrationVerificationCode,
  verifyRegistrationVerificationCode,
} from "./services/registration-verification";
import { sendRegistrationVerificationEmail } from "./services/send-registration-verification-email";
import { sendWelcomeEmail } from "./services/welcome-email";
import { buildOrganizationInfo } from "./utils/sub-account-permissions";

// Constants
export const JWT_ACCESS_TOKEN_NAME = "access_token";
const JWT_REFRESH_TOKEN_NAME = "refresh_token";
const JWT_ACCESS_TOKEN_DURATION = 900; // 15 minutes
const JWT_REFRESH_TOKEN_DURATION = 86400; // 1 days
const JWT_REFRESH_THRESHOLD = 60; // Refresh during the final minute
const OAUTH_RETURN_TO_COOKIE = "oauth_return_to";
const OAUTH_RETURN_TO_MAX_AGE = 300; // 5 minutes
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const EMAIL_NOT_FOUND_CODE = "EMAIL_NOT_FOUND";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(255);

const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

const passwordRegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  verificationCode: z.string().trim().length(6).optional(),
});

const sendRegistrationCodeSchema = z.object({
  email: emailSchema,
});

const subAccountRegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  invitationId: z.string().uuid(),
  verificationCode: z.string().trim().length(6).optional(),
});

const isJwtConfigError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("JWT_SECRET");

async function loadOrganizationInfoForUser(
  db: ReturnType<typeof createDatabase>,
  userId: string,
  organizationId: string
): Promise<OrganizationInfo | null> {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return null;
  }

  const [membership] = await db
    .select({
      role: memberships.role,
      permissions: memberships.permissions,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  return buildOrganizationInfo(organization, membership);
}

// Utility functions
const createAccessToken = async (
  payload: JWTTokenPayload,
  jwtSecret: string
): Promise<string> => {
  validateJwtSecret(jwtSecret);
  const secret = new TextEncoder().encode(jwtSecret);
  const expirationTime =
    Math.floor(Date.now() / 1000) + JWT_ACCESS_TOKEN_DURATION;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
};

const createRefreshToken = async (
  payload: { sub: string; organization: { id: string } },
  jwtSecret: string
): Promise<string> => {
  validateJwtSecret(jwtSecret);
  const secret = new TextEncoder().encode(jwtSecret);
  const expirationTime =
    Math.floor(Date.now() / 1000) + JWT_REFRESH_TOKEN_DURATION;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
};

const verifyToken = async (token: string, jwtSecret: string) => {
  validateJwtSecret(jwtSecret);
  const secret = new TextEncoder().encode(jwtSecret);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    // Log security event without exposing details
    console.warn(
      "Token verification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
};

export const verifyTokenForRateLimit = async (
  token: string,
  jwtSecret: string
): Promise<JWTTokenPayload | null> => {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTTokenPayload;
  } catch {
    return null;
  }
};

const urlToTopLevelDomain = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.hostname.split(".");

    // For localhost development
    if (
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1"
    ) {
      return parsedUrl.hostname;
    }

    // Validate hostname format
    if (parts.length < 2) {
      throw new Error("Invalid hostname format");
    }

    // Extract top-level domain (last two parts)
    return parts.slice(-2).join(".");
  } catch (error) {
    console.error("Invalid URL for domain extraction:", url, error);
    throw new Error("Invalid web host URL");
  }
};

// Input validation helpers
const validateUserData = (user: any, provider: string) => {
  const requiredFields = ["id", "name"];
  const missing = requiredFields.filter((field) => !user[field]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required fields from ${provider}: ${missing.join(", ")}`
    );
  }

  // Sanitize name to prevent potential injection
  if (typeof user.name !== "string" || user.name.length > 255) {
    throw new Error(`Invalid name format from ${provider}`);
  }

  // Validate email format if provided
  if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    console.warn(`Invalid email format from ${provider}:`, user.email);
    user.email = undefined; // Clear invalid email
  }

  return user;
};

const getAuthCookiePath = (): string => "/";

const deleteCookieOptions = (c: Context<ApiContext>) => {
  const hostname = new URL(c.env.WEB_HOST).hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    path: getAuthCookiePath(),
    ...(isLocalhost ? {} : { domain: urlToTopLevelDomain(c.env.WEB_HOST) }),
  };
};

const setCookieOptions = (c: Context<ApiContext>, maxAge: number) => {
  const hostname = new URL(c.env.WEB_HOST).hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    httpOnly: true,
    secure: isLocalhost ? false : c.env.CLOUDFLARE_ENV !== "development",
    sameSite: "Lax" as const,
    ...(isLocalhost ? {} : { domain: urlToTopLevelDomain(c.env.WEB_HOST) }),
    maxAge,
    path: getAuthCookiePath(),
  };
};

const clearAuthCookies = (c: Context<ApiContext>): void => {
  const cookieOptions = deleteCookieOptions(c);
  deleteCookie(c, JWT_ACCESS_TOKEN_NAME, cookieOptions);
  deleteCookie(c, JWT_REFRESH_TOKEN_NAME, cookieOptions);
};

// Validate returnTo is a safe relative path (prevents open redirects)
const isValidReturnTo = (returnTo: string): boolean => {
  return (
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("://")
  );
};

// Store returnTo in a cookie before OAuth redirect
const storeReturnTo = (c: Context<ApiContext>) => {
  const returnTo = c.req.query("returnTo");
  if (returnTo && isValidReturnTo(returnTo)) {
    setCookie(c, OAUTH_RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: c.env.CLOUDFLARE_ENV !== "development",
      sameSite: "Lax",
      maxAge: OAUTH_RETURN_TO_MAX_AGE,
      path: "/",
    });
  }
};

// Read and clear returnTo cookie, returning the redirect URL
const consumeReturnTo = (c: Context<ApiContext>): string => {
  const returnTo = getCookie(c, OAUTH_RETURN_TO_COOKIE);
  if (returnTo) {
    deleteCookie(c, OAUTH_RETURN_TO_COOKIE, { path: "/" });
    if (isValidReturnTo(returnTo)) {
      return c.env.WEB_HOST + returnTo;
    }
  }
  return c.env.WEB_HOST;
};

// Auth middleware
export const jwtMiddleware = async (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  const accessToken =
    getCookie(c, JWT_ACCESS_TOKEN_NAME) ?? c.req.query("access_token");

  if (!accessToken) {
    return c.json({ error: "No access token" }, 401);
  }

  const payload = (await verifyToken(
    accessToken,
    c.env.JWT_SECRET
  )) as JWTTokenPayload | null;

  if (!payload || !payload.sub) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Give the client time to refresh without refreshing every request.
  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp as number;

  if (exp - now < JWT_REFRESH_THRESHOLD) {
    c.header("X-Token-Refresh-Needed", "true");
  }

  c.set("jwtPayload", payload);

  const db = createDatabase(c.env);
  const organizationIdFromUrl =
    c.req.param("organizationId") ?? c.req.header(LAZY_ROUTE_ORG_HEADER);

  if (organizationIdFromUrl) {
    if (payload.organization?.id !== organizationIdFromUrl) {
      return c.json({ error: "Organization access denied" }, 403);
    }

    c.set("organizationId", organizationIdFromUrl);
  } else if (c.req.path.startsWith("/admin")) {
    // Platform admin routes are cross-tenant; org context is optional here.
  } else if (payload.organization?.id) {
    c.set("organizationId", payload.organization.id);
  } else {
    const [user] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user?.organizationId) {
      return c.json({ error: "Organization required" }, 400);
    }

    c.set("organizationId", user.organizationId);
  }

  await next();
};

/** Lightweight auth for WebSocket upgrades — avoids JSON 401 responses that break the WS handshake. */
export const wsUpgradeAuthMiddleware = async (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  const accessToken =
    getCookie(c, JWT_ACCESS_TOKEN_NAME) ?? c.req.query("access_token");

  if (!accessToken) {
    console.warn("[NodeWS] upgrade rejected: no access token");
    return c.body(null, 401);
  }

  const payload = (await verifyToken(
    accessToken,
    c.env.JWT_SECRET
  )) as JWTTokenPayload | null;

  if (!payload?.sub) {
    console.warn("[NodeWS] upgrade rejected: invalid token");
    return c.body(null, 401);
  }

  c.set("jwtPayload", payload);

  const organizationIdFromUrl =
    c.req.param("organizationId") ?? c.req.header(LAZY_ROUTE_ORG_HEADER);

  if (organizationIdFromUrl) {
    if (payload.organization?.id !== organizationIdFromUrl) {
      console.warn("[NodeWS] upgrade rejected: org access denied");
      return c.body(null, 403);
    }

    c.set("organizationId", organizationIdFromUrl);
    return next();
  }

  if (!payload.organization?.id) {
    return c.body(null, 400);
  }

  c.set("organizationId", payload.organization.id);
  await next();
};

// Optional auth middleware that doesn't require a token to be present
export const optionalJwtMiddleware = async (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  const accessToken = getCookie(c, JWT_ACCESS_TOKEN_NAME);

  if (accessToken) {
    const payload = (await verifyToken(
      accessToken,
      c.env.JWT_SECRET
    )) as JWTTokenPayload | null;

    if (payload && payload.organization?.id) {
      // Give the client time to refresh without refreshing every request.
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp as number;

      if (exp - now < JWT_REFRESH_THRESHOLD) {
        c.header("X-Token-Refresh-Needed", "true");
      }

      c.set("jwtPayload", payload);
      c.set("organizationId", payload.organization.id);
    }
  }

  await next();
};

// API key authentication middleware
export const apiKeyMiddleware = async (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  const authHeader = c.req.header("Authorization");
  const organizationIdFromUrl =
    c.req.param("organizationId") ?? c.req.header(LAZY_ROUTE_ORG_HEADER);

  if (!organizationIdFromUrl) {
    // This should ideally not happen if routes are configured correctly
    return c.json({ error: "Organization ID missing from URL" }, 400);
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "API key is required" }, 401);
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  const db = createDatabase(c.env);

  const validatedOrganizationId = await verifyApiKey(
    db,
    apiKey,
    organizationIdFromUrl
  );

  if (!validatedOrganizationId) {
    return c.json(
      { error: "Invalid API key for the specified organization" },
      401
    );
  }

  // Store the validated organization ID in the context for later use
  c.set("organizationId", validatedOrganizationId);

  await next();
};

// Middleware that allows either JWT or API key authentication
export const apiKeyOrJwtMiddleware = async (
  c: Context<ApiContext>,
  next: () => Promise<void>
) => {
  const authHeader = c.req.header("Authorization");
  const organizationIdFromUrl =
    c.req.param("organizationId") ?? c.req.header(LAZY_ROUTE_ORG_HEADER);

  // If Authorization header is present, try API key auth
  if (authHeader && authHeader.startsWith("Bearer ")) {
    if (!organizationIdFromUrl) {
      return c.json(
        {
          error: "Organization ID missing from URL for API key auth",
        },
        400
      );
    }
    return apiKeyMiddleware(c, next); // apiKeyMiddleware will handle org verification
  }

  // Otherwise, try JWT auth
  return jwtMiddleware(c, next);
};

// Helper function to set both tokens
const setAuthTokens = async (
  c: Context<ApiContext>,
  accessPayload: JWTTokenPayload,
  refreshPayload: { sub: string; organization: { id: string } }
) => {
  const accessToken = await createAccessToken(accessPayload, c.env.JWT_SECRET);
  const refreshToken = await createRefreshToken(
    refreshPayload,
    c.env.JWT_SECRET
  );

  setCookie(
    c,
    JWT_ACCESS_TOKEN_NAME,
    accessToken,
    setCookieOptions(c, JWT_ACCESS_TOKEN_DURATION)
  );

  setCookie(
    c,
    JWT_REFRESH_TOKEN_NAME,
    refreshToken,
    setCookieOptions(c, JWT_REFRESH_TOKEN_DURATION)
  );
};

// Create auth router
const auth = new Hono<ApiContext>();

const respondRefreshUnauthorized = (c: Context<ApiContext>) => {
  clearAuthCookies(c);
  return c.json({ error: "Authentication required" }, 401);
};

auth.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, JWT_REFRESH_TOKEN_NAME);

  if (!refreshToken) {
    return respondRefreshUnauthorized(c);
  }

  const rawPayload = await verifyToken(refreshToken, c.env.JWT_SECRET);
  const payload = rawPayload as JWTTokenPayload | null;

  const orgId = payload?.organization?.id;
  if (!payload || !payload.sub || !orgId) {
    console.warn("Invalid refresh token attempt", {
      hasPayload: !!payload,
      hasSub: !!payload?.sub,
      hasOrg: !!orgId,
    });
    return respondRefreshUnauthorized(c);
  }

  const db = createDatabase(c.env);

  try {
    // Get fresh user data
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub as string));

    if (userResults.length === 0) {
      console.warn("User not found during refresh", { userId: payload.sub });
      return respondRefreshUnauthorized(c);
    }
    const result = userResults[0];

    // Get organization data
    const orgResults = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (orgResults.length === 0) {
      console.warn("Organization not found during refresh", { orgId });
      return respondRefreshUnauthorized(c);
    }
    const orgResult = orgResults[0];

    // Verify user is still a member of the organization
    const membershipResults = await db
      .select({
        role: memberships.role,
        permissions: memberships.permissions,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, payload.sub as string),
          eq(memberships.organizationId, orgResult.id)
        )
      );

    if (membershipResults.length === 0) {
      console.warn("User no longer a member during refresh", {
        userId: payload.sub,
        orgId: orgResult.id,
      });
      return respondRefreshUnauthorized(c);
    }

    const membership = membershipResults[0];
    const organizationInfo = buildOrganizationInfo(orgResult, membership);

    const provider = resolveAuthProvider(result);

    const accessPayload: JWTTokenPayload = {
      sub: result.id,
      name: result.name,
      email: result.email ?? undefined,
      avatarUrl: result.avatarUrl ?? undefined,
      role: result.role,
      developerMode: result.developerMode,
      provider,
      organization: organizationInfo,
    };

    await setAuthTokens(c, accessPayload, {
      sub: result.id,
      organization: { id: orgResult.id },
    });

    return c.json({ success: true, user: accessPayload });
  } catch (error) {
    console.error("Error during token refresh:", error);
    return respondRefreshUnauthorized(c);
  }
});

auth.post("/logout", (c) => {
  clearAuthCookies(c);
  return c.redirect(c.env.WEB_HOST);
});

auth.post("/clear-session", (c) => {
  clearAuthCookies(c);
  return c.json({ ok: true });
});

/**
 * Complete the OAuth login flow: save user, send welcome email, set tokens, redirect.
 */
async function completeOAuthLogin(
  c: Context<ApiContext>,
  userData: UserData
): Promise<Response> {
  const db = createDatabase(c.env);
  const isNewUser = !(await userExists(
    db,
    userData.provider,
    userData.providerId
  ));
  const { user: savedUser, organization: savedOrganization } = await saveUser(
    db,
    userData
  );

  if (isNewUser && userData.email) {
    // Best-effort: never block login on a flaky welcome path.
    try {
      const result = await sendWelcomeEmail(db, c.env, c.executionCtx, {
        id: savedUser.id,
        email: userData.email,
        name: userData.name,
        organizationId: savedOrganization.id,
      });
      if (!result.ok) console.warn("[welcome] send failed:", result.error);
    } catch (error) {
      console.warn("[welcome] unexpected error:", error);
    }
  }

  const organizationInfo = await loadOrganizationInfoForUser(
    db,
    savedUser.id,
    savedOrganization.id
  );

  if (!organizationInfo) {
    return c.json({ error: "Organization membership not found" }, 500);
  }

  const accessPayload: JWTTokenPayload = {
    sub: savedUser.id,
    name: userData.name,
    email: userData.email,
    avatarUrl: userData.avatarUrl,
    role: savedUser.role,
    developerMode: savedUser.developerMode,
    provider: userData.provider,
    organization: organizationInfo,
  };

  const refreshPayload = {
    sub: savedUser.id,
    organization: { id: savedOrganization.id },
  };

  await setAuthTokens(c, accessPayload, refreshPayload);

  return c.redirect(consumeReturnTo(c));
}

async function completePasswordLogin(
  c: Context<ApiContext>,
  user: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    role: string;
    developerMode: boolean;
  },
  organization: OrganizationInfo
): Promise<Response> {
  const accessPayload: JWTTokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    developerMode: user.developerMode,
    provider: "local",
    organization,
  };

  await setAuthTokens(c, accessPayload, {
    sub: user.id,
    organization: { id: organization.id },
  });

  return c.json({
    success: true,
    user: accessPayload,
  } satisfies PasswordAuthResponse);
}

auth.get("/setup-status", async (c) => {
  const db = createDatabase(c.env);
  const hasUsers = await hasAnyUsers(db);
  return c.json({ hasUsers } satisfies AuthSetupStatusResponse);
});

auth.post(
  "/register/send-code",
  zValidator("json", sendRegistrationCodeSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = createDatabase(c.env);
    const authConfig = await getAuthConfig(db);

    if (!authConfig.email.requireVerificationOnRegister) {
      return c.json({ error: "Registration verification is not enabled" }, 400);
    }

    if (!(await hasAnyUsers(db))) {
      return c.json(
        { error: "Bootstrap registration does not require verification" },
        400
      );
    }

    const existingUser = await getLocalUserByEmail(db, email);
    if (existingUser) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const cooldown = await getRegistrationCodeCooldownRemaining(c.env, email);
    if (cooldown > 0) {
      return c.json(
        {
          error: `Please wait ${cooldown} seconds before requesting another code`,
          code: "COOLDOWN",
        },
        429
      );
    }

    const siteSettings = await getPublicSiteSettings(db);
    const code = generateRegistrationVerificationCode();
    const sendResult = await sendRegistrationVerificationEmail(
      c.env,
      authConfig,
      {
        to: email,
        code,
        siteName: siteSettings.siteName,
      }
    );

    if (!sendResult.ok) {
      return c.json(
        { error: sendResult.error ?? "Failed to send verification code" },
        502
      );
    }

    await storeRegistrationVerificationCode(c.env, email, code);
    await markRegistrationCodeSent(c.env, email);

    return c.json({ success: true } satisfies SendRegistrationCodeResponse);
  }
);

auth.post(
  "/register",
  zValidator("json", passwordRegisterSchema),
  async (c) => {
    const { email, password, verificationCode } = c.req.valid("json");
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return c.json({ error: passwordError }, 400);
    }

    const db = createDatabase(c.env);

    try {
      const authConfig = await getAuthConfig(db);
      const isBootstrap = !(await hasAnyUsers(db));

      if (authConfig.email.requireVerificationOnRegister && !isBootstrap) {
        if (!verificationCode) {
          return c.json(
            {
              error: "Verification code is required",
              code: "VERIFICATION_REQUIRED",
            },
            400
          );
        }

        const codeValid = await verifyRegistrationVerificationCode(
          c.env,
          email,
          verificationCode
        );
        if (!codeValid) {
          return c.json(
            {
              error: "Invalid or expired verification code",
              code: "INVALID_CODE",
            },
            400
          );
        }
      }

      const passwordHash = await hashPassword(password);
      const { user, organization } = await registerLocalUser(db, {
        email,
        passwordHash,
      });

      return completePasswordLogin(c, user, {
        id: organization.id,
        name: organization.name,
        role: OrganizationRole.OWNER,
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return c.json({ error: "Email already registered" }, 409);
      }
      if (isJwtConfigError(error)) {
        console.error("Registration JWT config error:", error);
        return c.json({ error: "Authentication service misconfigured" }, 503);
      }
      console.error("Registration error:", error);
      return c.json({ error: "Registration failed" }, 500);
    }
  }
);

auth.get("/sub-account-invitations/:id", async (c) => {
  const invitationId = c.req.param("id");
  const db = createDatabase(c.env);

  try {
    const preview = await getSubAccountInvitationPreview(db, invitationId);
    if (!preview) {
      return c.json({ error: "Invitation not found or expired" }, 404);
    }

    return c.json({
      invitation: {
        id: preview.id,
        email: preview.email,
        organizationName: preview.organizationName,
        expiresAt: preview.expiresAt.toISOString(),
      },
    } satisfies GetSubAccountInvitationPreviewResponse);
  } catch (error) {
    console.error("Sub-account invitation preview error:", error);
    return c.json({ error: "Failed to load invitation" }, 500);
  }
});

auth.post(
  "/register/sub-account",
  zValidator("json", subAccountRegisterSchema),
  async (c) => {
    const { email, password, invitationId, verificationCode } = c.req.valid("json");
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return c.json({ error: passwordError }, 400);
    }

    const db = createDatabase(c.env);

    try {
      const authConfig = await getAuthConfig(db);

      if (authConfig.email.requireVerificationOnRegister) {
        if (!verificationCode) {
          return c.json(
            {
              error: "Verification code is required",
              code: "VERIFICATION_REQUIRED",
            },
            400
          );
        }

        const codeValid = await verifyRegistrationVerificationCode(
          c.env,
          email,
          verificationCode
        );
        if (!codeValid) {
          return c.json(
            {
              error: "Invalid or expired verification code",
              code: "INVALID_CODE",
            },
            400
          );
        }
      }

      const passwordHash = await hashPassword(password);
      const { user, organization, membership } =
        await registerSubAccountFromInvitation(db, {
          email,
          passwordHash,
          invitationId,
        });

      const organizationInfo = buildOrganizationInfo(organization, membership);
      return completePasswordLogin(c, user, organizationInfo);
    } catch (error) {
      if (error instanceof SubAccountInvitationError) {
        return c.json({ error: error.message }, 400);
      }
      if (isJwtConfigError(error)) {
        console.error("Sub-account registration JWT config error:", error);
        return c.json({ error: "Authentication service misconfigured" }, 503);
      }
      console.error("Sub-account registration error:", error);
      return c.json({ error: "Registration failed" }, 500);
    }
  }
);

auth.post(
  "/login/password",
  zValidator("json", passwordLoginSchema),
  async (c) => {
    try {
      const { email, password } = c.req.valid("json");
      const db = createDatabase(c.env);
      const user = await getLocalUserByEmail(db, email);

      if (!user) {
        return c.json(
          {
            error: "Email not registered",
            code: EMAIL_NOT_FOUND_CODE,
          },
          404
        );
      }

      if (!user.passwordHash) {
        return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
      }

      const passwordValid = await verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
      }

      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.organizationId));

      if (!organization) {
        return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
      }

      const organizationInfo = await loadOrganizationInfoForUser(
        db,
        user.id,
        organization.id
      );

      if (!organizationInfo) {
        return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
      }

      return completePasswordLogin(c, user, organizationInfo);
    } catch (error) {
      if (isJwtConfigError(error)) {
        console.error("Password login JWT config error:", error);
        return c.json({ error: "Authentication service misconfigured" }, 503);
      }
      console.error("Password login error:", error);
      return c.json({ error: "Login failed" }, 500);
    }
  }
);

auth.get(
  "/login/github",
  async (c, next) => {
    const db = createDatabase(c.env);
    const authConfig = await getAuthConfig(db);
    const credentials = resolveOAuthCredentials("github", authConfig, c.env);
    if (!credentials) {
      return c.json({ error: "GitHub login is disabled" }, 403);
    }

    storeReturnTo(c);
    const githubAuthHandler = githubAuth({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: ["read:user", "user:email"],
      oauthApp: true,
    });
    return githubAuthHandler(c, next);
  },
  async (c) => {
    const user = c.get("user-github");
    if (!user) {
      return c.json({ error: "Authentication failed" }, 400);
    }

    try {
      const validatedUser = validateUserData(
        {
          id: user.id,
          name: user.name || user.login,
          email: user.email,
          avatar_url: user.avatar_url,
        },
        "GitHub"
      );

      return await completeOAuthLogin(c, {
        provider: "github",
        providerId: validatedUser.id.toString(),
        name: validatedUser.name,
        email: validatedUser.email || undefined,
        avatarUrl: validatedUser.avatar_url,
      });
    } catch (error) {
      console.error("GitHub authentication error:", error);
      return c.json({ error: "Authentication failed" }, 400);
    }
  }
);

auth.get(
  "/login/google",
  async (c, next) => {
    const db = createDatabase(c.env);
    const authConfig = await getAuthConfig(db);
    const credentials = resolveOAuthCredentials("google", authConfig, c.env);
    if (!credentials) {
      return c.json({ error: "Google login is disabled" }, 403);
    }

    storeReturnTo(c);
    const googleAuthHandler = googleAuth({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: ["openid", "email", "profile"],
    });
    return googleAuthHandler(c, next);
  },
  async (c) => {
    const user = c.get("user-google");
    if (!user) {
      return c.json({ error: "Authentication failed" }, 400);
    }

    try {
      const validatedUser = validateUserData(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.picture,
        },
        "Google"
      );

      return await completeOAuthLogin(c, {
        provider: "google",
        providerId: validatedUser.id.toString(),
        name: validatedUser.name,
        email: validatedUser.email as string | undefined,
        avatarUrl: validatedUser.avatar_url ?? undefined,
      });
    } catch (error) {
      console.error("Google authentication error:", error);
      return c.json({ error: "Authentication failed" }, 400);
    }
  }
);

auth.get("/protected", jwtMiddleware, (c) => {
  // If jwtAuth passes, user is authenticated
  return c.json({ ok: true }, 200);
});

auth.get("/user", jwtMiddleware, (c) => {
  return c.json({ user: c.get("jwtPayload") });
});

/** Short-lived access token for WebSocket query auth (httpOnly cookies are not always sent on WS upgrade). */
auth.get("/ws-token", jwtMiddleware, (c) => {
  const token =
    getCookie(c, JWT_ACCESS_TOKEN_NAME) ?? c.req.query("access_token");
  if (!token) {
    return c.json({ error: "No access token" }, 401);
  }
  return c.json({ token });
});

export default auth;
