import { CheckCircle2, XCircle, Loader2, Shirt } from 'lucide-react';
import { useHealth } from '@/hooks/useHealth';

function App() {
  const { data, isLoading, isError, error } = useHealth();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center">
          <Shirt className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">
          Digital Catalog SaaS
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Phase 1 &mdash; project scaffold
        </p>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Backend health check
          </p>

          {isLoading && (
            <div className="mt-2 flex items-center gap-2 text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking API&hellip;</span>
            </div>
          )}

          {isError && (
            <div className="mt-2 flex items-start gap-2 text-red-600">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="text-sm">
                Unable to reach the API.{' '}
                {error instanceof Error ? error.message : 'Please try again.'}
              </span>
            </div>
          )}

          {data && (
            <div className="mt-2 flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">
                {data.service} is {data.status} (v{data.version})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
