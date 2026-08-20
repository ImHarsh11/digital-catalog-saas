import { AxiosError } from 'axios';

/** FastAPI's 422 validation error shape: {"detail": [{"loc": [...], "msg": "...", ...}]} */
interface ValidationErrorItem {
  msg?: string;
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

export function getApiErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (error instanceof AxiosError) {
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as ValidationErrorItem;
      if (typeof first?.msg === 'string' && first.msg.trim()) {
        return first.msg;
      }
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to reach the server. Please check your connection and try again.';
    }
  }
  return fallback;
}
