/** Explicit opt-in for RBAC tests/future activation. Normal development and production builds stay unrestricted. */
export const RBAC_ENFORCEMENT_ENABLED = import.meta.env.VITE_RBAC_ENFORCEMENT === 'true'
