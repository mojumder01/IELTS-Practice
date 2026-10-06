import { useState } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AuthContext, type AuthStore } from './lib/auth';
import { ServicesContext, type Services } from './lib/services';
import { routes } from './routes';

export function App({ authStore, services }: { authStore: AuthStore; services: Services }) {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AuthContext value={authStore}>
      <ServicesContext value={services}>
        <RouterProvider router={router} />
      </ServicesContext>
    </AuthContext>
  );
}
