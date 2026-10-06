/**
 * Reads the backend error contract `{ message: string }` and nothing else.
 *
 * Only the backend-supplied `message` is ever surfaced: transport details,
 * response URLs and stack traces are intentionally dropped so a failed request
 * cannot leak internals into the UI.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === 'TimeoutError') return 'หมดเวลารอระบบ หากเป็นการบันทึก กรุณารีเฟรชตรวจสอบผลก่อนลองใหม่';
  if (error !== null && typeof error === 'object') {
    const body = (error as { error?: unknown }).error;
    if (body !== null && typeof body === 'object') {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  return fallback;
}
