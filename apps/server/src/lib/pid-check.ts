/**
 * Check if a process is alive using signal 0 (no-op signal).
 * Returns true if process exists and we have permission to signal it.
 * Returns false if process does not exist (ESRCH).
 * Returns true for permission errors (EPERM) — process exists but belongs to another user.
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') {
      // Process exists but we lack permission — still alive
      return true;
    }
    // ESRCH — no such process
    return false;
  }
}
