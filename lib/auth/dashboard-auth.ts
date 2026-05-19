import { cookies } from "next/headers";

export const DASHBOARD_AUTH_COOKIE = "dashboard_auth";

/** True when dashboard password is not set, or the request has a valid session cookie. */
export async function isDashboardAuthenticated(): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return true;

  const store = await cookies();
  return store.get(DASHBOARD_AUTH_COOKIE)?.value === expected;
}
