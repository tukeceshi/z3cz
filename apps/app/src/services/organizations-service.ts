import type {
  CreateSubAccountInvitationRequest,
  CreateSubAccountInvitationResponse,
  DeleteInvitationResponse,
  Invitation,
  ListInvitationsResponse,
  ListMembershipsResponse,
  ListOrganizationsResponse,
  RemoveMembershipRequest,
  RemoveMembershipResponse,
  SubAccountPermissions,
  UpdateMembershipPermissionsRequest,
  UpdateMembershipPermissionsResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const API_ENDPOINT_BASE = "/organizations";

interface UseOrganizations {
  organizations: Array<{
    id: string;
    name: string;
    role: "member" | "owner";
    createdAt: Date;
    updatedAt: Date;
  }>;
  organizationsError: Error | null;
  isOrganizationsLoading: boolean;
  mutateOrganizations: () => Promise<unknown>;
}

export const useOrganizations = (enabled: boolean = true): UseOrganizations => {
  const swrKey = enabled ? API_ENDPOINT_BASE : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, async () => {
    const response =
      await makeRequest<ListOrganizationsResponse>(API_ENDPOINT_BASE);
    return response.organizations;
  });

  return {
    organizations: data || [],
    organizationsError: error || null,
    isOrganizationsLoading: isLoading,
    mutateOrganizations: mutate,
  };
};

export const updateOrganization = async (
  organizationId: string,
  request: UpdateOrganizationRequest
): Promise<UpdateOrganizationResponse> => {
  return makeRequest<UpdateOrganizationResponse>(
    `${API_ENDPOINT_BASE}/${organizationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(request),
    }
  );
};

interface MembershipRow {
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
}

interface UseMemberships {
  memberships: MembershipRow[];
  membershipsError: Error | null;
  isMembershipsLoading: boolean;
  mutateMemberships: () => Promise<unknown>;
}

export const useMemberships = (organizationId: string): UseMemberships => {
  const swrKey = organizationId
    ? `${API_ENDPOINT_BASE}/${organizationId}/memberships`
    : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, async () => {
    const response = await makeRequest<ListMembershipsResponse>(swrKey!);
    return response.memberships;
  });

  return {
    memberships: data || [],
    membershipsError: error || null,
    isMembershipsLoading: isLoading,
    mutateMemberships: mutate,
  };
};

export const updateMembershipPermissions = async (
  organizationId: string,
  request: Omit<UpdateMembershipPermissionsRequest, "organizationId">
): Promise<UpdateMembershipPermissionsResponse> => {
  return makeRequest<UpdateMembershipPermissionsResponse>(
    `${API_ENDPOINT_BASE}/${organizationId}/memberships/permissions`,
    {
      method: "PATCH",
      body: JSON.stringify(request),
    }
  );
};

export const removeMembership = async (
  organizationId: string,
  request: Omit<RemoveMembershipRequest, "organizationId">
): Promise<boolean> => {
  const response = await makeRequest<RemoveMembershipResponse>(
    `${API_ENDPOINT_BASE}/${organizationId}/memberships`,
    {
      method: "DELETE",
      body: JSON.stringify(request),
    }
  );

  return response.success;
};

interface UseInvitations {
  invitations: Invitation[];
  invitationsError: Error | null;
  isInvitationsLoading: boolean;
  mutateInvitations: () => Promise<unknown>;
}

export const useInvitations = (organizationId: string): UseInvitations => {
  const swrKey = organizationId
    ? `${API_ENDPOINT_BASE}/${organizationId}/invitations`
    : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, async () => {
    const response = await makeRequest<ListInvitationsResponse>(swrKey!);
    return response.invitations;
  });

  return {
    invitations: data || [],
    invitationsError: error || null,
    isInvitationsLoading: isLoading,
    mutateInvitations: mutate,
  };
};

export const createSubAccountInvitation = async (
  organizationId: string,
  request: CreateSubAccountInvitationRequest
): Promise<CreateSubAccountInvitationResponse> => {
  return makeRequest<CreateSubAccountInvitationResponse>(
    `${API_ENDPOINT_BASE}/${organizationId}/invitations`,
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
};

export const deleteInvitation = async (
  organizationId: string,
  invitationId: string
): Promise<boolean> => {
  const response = await makeRequest<DeleteInvitationResponse>(
    `${API_ENDPOINT_BASE}/${organizationId}/invitations/${invitationId}`,
    {
      method: "DELETE",
    }
  );

  return response.success;
};
