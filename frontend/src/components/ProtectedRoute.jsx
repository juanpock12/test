import { Navigate } from 'react-router-dom';
import { getToken, getUser, homePathFor } from '../session';

export default function ProtectedRoute({ role, children }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return children;
}