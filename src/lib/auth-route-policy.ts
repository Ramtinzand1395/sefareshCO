export type RouteSessionUser = {
  onboardingCompleted: boolean;
  isAdmin: boolean;
  destination: "/onboarding" | "/cafe" | "/supplier" | "/admin";
};

export function getAuthRedirect(pathname: string, user: RouteSessionUser | null) {
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isOnboarding = pathname === "/onboarding";

  if (!user) {
    if (isAuthPage) return null;
    return `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  }
  if (!user.onboardingCompleted) {
    return isOnboarding ? null : "/onboarding";
  }
  if (isOnboarding && user.destination === "/onboarding") return null;
  if (isOnboarding || isAuthPage) return user.destination || "/cafe";
  const portalPath = (["/cafe", "/supplier", "/admin"] as const).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (portalPath && portalPath !== user.destination) {
    return user.destination || "/cafe";
  }
  return null;
}
