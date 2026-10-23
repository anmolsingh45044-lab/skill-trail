import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, googleClientId: null });

  useEffect(() => {
    setUnauthorizedHandler(() => setState((s) => ({ ...s, user: null })));
    Promise.all([
      api.get('/auth/config').catch(() => ({ googleClientId: null })),
      api.get('/auth/me').catch(() => null),
    ]).then(([config, me]) => setState({ loading: false, user: me?.user ?? null, googleClientId: config.googleClientId }));
  }, []);

  const value = useMemo(() => {
    const signedIn = ({ user }) => setState((s) => ({ ...s, user }));
    return {
      ...state,
      login: (email, password) => api.post('/auth/login', { email, password }).then(signedIn),
      register: (name, email, password) => api.post('/auth/register', { name, email, password }).then(signedIn),
      loginWithGoogle: (credential) => api.post('/auth/google', { credential }).then(signedIn),
      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        setState((s) => ({ ...s, user: null }));
      },
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
