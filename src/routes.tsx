import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/AppShell';
import { AuthGuard } from './components/AuthGuard';
import { Hello } from './pages/Hello';
import { SignIn } from './pages/SignIn';

export const routes: RouteObject[] = [
  { path: '/signin', element: <SignIn /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [{ index: true, element: <Hello /> }],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
