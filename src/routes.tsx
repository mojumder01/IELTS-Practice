import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/AppShell';
import { AuthGuard } from './components/AuthGuard';
import { ExamRoute } from './pages/Exam';
import { Hello } from './pages/Hello';
import { Results } from './pages/Results';
import { SignIn } from './pages/SignIn';

export const routes: RouteObject[] = [
  { path: '/signin', element: <SignIn /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Hello /> },
          { path: '/results/:attemptId', element: <Results /> },
        ],
      },
      { path: '/test/:testId/:module', element: <ExamRoute /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
