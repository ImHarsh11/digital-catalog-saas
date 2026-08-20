import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMe, login as loginRequest } from '@/services/auth';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';
import { AuthContext } from './authContextObject';
import type { User } from '@/types/auth';
import type { ShopBrief } from '@/types/shop';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<ShopBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me.user);
          setShop(me.shop);
        }
      } catch {
        // Expired/invalid token -- treat as logged out.
        clearToken();
        if (!cancelled) {
          setUser(null);
          setShop(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { access_token } = await loginRequest({ email, password });
    setToken(access_token);
    const me = await getMe();
    setUser(me.user);
    setShop(me.shop);
    return me.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setShop(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{ user, shop, isLoading, isAuthenticated: user !== null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
