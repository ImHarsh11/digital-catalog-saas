import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-300">{title}</p>
        <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
