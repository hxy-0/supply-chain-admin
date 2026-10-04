/** Only restore internal application pages, never auth callbacks or external URLs. */
export function isRestorablePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/^\/(?:login|oauth|redirect|access-denied|server-error|error)(?:[/?#]|$)/.test(
      path
    ) &&
    path !== "/"
  );
}

export function loginDestination(redirect: unknown, lastPage: unknown): string {
  if (isRestorablePath(redirect)) return redirect;
  return isRestorablePath(lastPage) ? lastPage : "/welcome";
}

export const lastPageKey = (username: string) => `last-page:${username}`;
