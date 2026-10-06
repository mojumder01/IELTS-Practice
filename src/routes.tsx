import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/AppShell';
import { AuthGuard } from './components/AuthGuard';
import { ExamRoute } from './pages/Exam';
import { Bands } from './pages/Bands';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Library } from './pages/Library';
import { Results } from './pages/Results';
import { SignIn } from './pages/SignIn';
import { Vocabulary } from './pages/Vocabulary';

export const routes: RouteObject[] = [
  { path: '/signin', element: <SignIn /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: '/library', element: <Library /> },
          { path: '/history', element: <History /> },
          { path: '/bands', element: <Bands /> },
          { path: '/vocabulary', element: <Vocabulary /> },
          { path: '/results/:attemptId', element: <Results /> },
        ],
      },
      { path: '/test/:testId/:module', element: <ExamRoute /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
