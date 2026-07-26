/**
 * Organization-related types for API requests and responses
 */

import type { SubAccountPermissions } from "./sub-account-permissions";

export interface CreateOrganizationRequest {
  name: string;
}

export interface CreateOrganizationResponse {
  organization: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface UpdateOrganizationRequest {
  name: string;
}

export interface UpdateOrganizationResponse {
  organization: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface DeleteOrganizationResponse {
  success: boolean;
}

export interface ListOrganizationsResponse {
  organizations: Array<{
    id: string;
    name: string;
    role: "member" | "owner";
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface ListMembershipsRequest {
  organizationId: string;
}

export interface ListMembershipsResponse {
  memberships: Array<{
    userId: string;
    organizationId: string;
    role: "member" | "owner";
    permissions: SubAccountPermissions | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email?: string;
      avatarUrl?: string;
    };
  }>;
}

export interface RemoveMembershipRequest {
  organizationId: string;
  email: string;
}

export interface RemoveMembershipResponse {
  success: boolean;
}

export interface UpdateMembershipPermissionsRequest {
  organizationId: string;
  email: string;
  permissions: Partial<SubAccountPermissions>;
}

export interface UpdateMembershipPermissionsResponse {
  membership: {
    userId: string;
    organizationId: string;
    role: "member" | "owner";
    permissions: SubAccountPermissions | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Sub-account invitation types
 */

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  permissions: SubAccountPermissions;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  inviter: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
}

export interface CreateSubAccountInvitationRequest {
  email: string;
  permissions?: Partial<SubAccountPermissions>;
}

export interface CreateSubAccountInvitationResponse {
  invitation: Invitation;
}

export interface ListInvitationsResponse {
  invitations: Invitation[];
}

export interface GetSubAccountInvitationPreviewResponse {
  invitation: {
    id: string;
    email: string;
    organizationName: string;
    expiresAt: Date;
  };
}

export interface RegisterSubAccountRequest {
  email: string;
  password: string;
  invitationId: string;
  verificationCode?: string;
}

export interface DeleteInvitationResponse {
  success: boolean;
}

export interface AcceptInvitationResponse {
  membership: {
    userId: string;
    organizationId: string;
    role: "member" | "owner";
    permissions: SubAccountPermissions | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface DeclineInvitationResponse {
  success: boolean;
}

/** @deprecated Sub-accounts register via invitation link; kept for API compatibility. */
export interface AddMembershipRequest {
  organizationId: string;
  email: string;
  role: "member";
}

/** @deprecated */
export interface AddMembershipResponse {
  membership: {
    userId: string;
    organizationId: string;
    role: "member" | "owner";
    createdAt: Date;
    updatedAt: Date;
  };
}

/** @deprecated */
export interface UpdateMembershipRequest {
  organizationId: string;
  email: string;
  role: "member";
}

/** @deprecated */
export interface UpdateMembershipResponse {
  membership: {
    userId: string;
    organizationId: string;
    role: "member" | "owner";
    createdAt: Date;
    updatedAt: Date;
  };
}

/** @deprecated */
export interface UserInvitation {
  id: string;
  email: string;
  role: "member";
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
  };
  inviter: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

/** @deprecated */
export interface CreateInvitationRequest {
  email: string;
  role: "member";
}

/** @deprecated */
export interface CreateInvitationResponse {
  invitation: Invitation;
}

/** @deprecated */
export interface ListUserInvitationsResponse {
  invitations: UserInvitation[];
}
