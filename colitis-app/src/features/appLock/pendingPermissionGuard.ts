let isPending = false;

export function beginPendingPermissionRequest(): void {
  isPending = true;
}

export function endPendingPermissionRequest(): void {
  isPending = false;
}

export function isPermissionRequestPending(): boolean {
  return isPending;
}
