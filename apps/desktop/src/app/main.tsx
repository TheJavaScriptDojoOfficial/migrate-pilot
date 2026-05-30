import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { router } from '@routes/router';
import '@app/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local-first app: no aggressive refetching.
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
