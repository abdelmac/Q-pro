export interface PortalProfile {
  display_name: string | null;
  portal_role: 'researcher' | 'doctor' | 'professor';
  can_edit: boolean;
  can_publish: boolean;
}

/** Parse only the server profile RPC, never JWT metadata or login form values. */
export function parsePortalProfile(value: unknown): PortalProfile | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const authorized = record.authorized === undefined ? record.is_researcher : record.authorized;
  if (authorized !== true) return null;
  if (record.portal_role !== undefined && record.role !== undefined && record.portal_role !== record.role) return null;
  const role = record.portal_role ?? record.role;
  if (role !== 'researcher' && role !== 'doctor' && role !== 'professor') return null;
  // A researcher cannot acquire administrative access through inconsistent flags.
  const editGrant = record.can_edit === undefined ? record.can_edit_catalog : record.can_edit;
  const publishGrant = record.can_publish === undefined ? record.can_publish_catalog : record.can_publish;
  const canEdit = role !== 'researcher' && editGrant === true;
  return {
    display_name: typeof record.display_name === 'string' ? record.display_name : null,
    portal_role: role,
    can_edit: canEdit,
    can_publish: role === 'professor' && canEdit && publishGrant === true,
  };
}

/** Existing researcher accounts enter the professor's non-administrative workspace. */
export function isProfessorWorkspace(profile: PortalProfile | null): boolean {
  return profile?.portal_role === 'researcher';
}
