export type OrganizationRoleType = "member" | "admin" | "owner";

export interface OrganizationInfo {
  id: string;
  name: string;
  role: OrganizationRoleType;
}

// Full user data as stored in database (includes provider info)
export interface DatabaseUser {
  sub: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  developerMode: boolean;
  organization: OrganizationInfo;
  provider: AuthProvider;
}

// User data stored in JWT tokens (includes provider for frontend logic)
export interface AuthUser {
  sub: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  developerMode: boolean;
  organization: OrganizationInfo;
  provider: AuthProvider;
}

// JWT payload structure (AuthUser + standard JWT fields)
export interface JWTTokenPayload extends AuthUser {
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export type AuthProvider = "github" | "google" | "local";

export interface AuthSetupStatusResponse {
  hasUsers: boolean;
}

export interface AuthCheckResponse {
  ok: boolean;
}

export interface PasswordLoginRequest {
  email: string;
  password: string;
}

export interface PasswordRegisterRequest {
  email: string;
  password: string;
}

export interface AuthErrorResponse {
  error: string;
  code?: string;
}

export interface PasswordAuthResponse {
  success: boolean;
  user: JWTTokenPayload;
}

export interface UserResponse {
  user: DatabaseUser;
}
