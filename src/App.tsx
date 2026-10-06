import { useState } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AuthContext, type AuthStore } from './lib/auth';
import { routes } from './routes';

export function App({ authStore }: { authStore: AuthStore }) {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AuthContext value={authStore}>
      <RouterProvider router={router} />
    </AuthContext>
  );
}
