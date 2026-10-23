export function communityAccountRedirect(recovery = false): string {
  // Never accept an untrusted returnTo URL; preserve the reviewed build base.
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('community', 'account');
  if (recovery) url.searchParams.set('recovery', '1');
  return url.toString();
}
