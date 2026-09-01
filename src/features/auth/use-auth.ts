import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-provider';

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth() wymaga <AuthProvider> wyżej w drzewie.');
  }
  return value;
}
