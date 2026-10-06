import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { FullPageStatus } from './FullPageStatus';

/** Every route except /signin sits behind this: only the owner's account gets through. */
export function AuthGuard() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <FullPageStatus label="Checking sign-in…" />;
  if (state.status !== 'owner') {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
