import { create } from 'zustand';

interface User {
  username: string;
  displayName: string;
  role: 'ops' | 'dev' | 'mgmt';
  avatar?: string;
}

interface AuthState {
  user: User;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const defaultUser: User = { username: 'admin', displayName: '运维管理员', role: 'ops' };

export const useAuthStore = create<AuthState>()((set) => ({
  user: defaultUser,
  isAuthenticated: true,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: defaultUser, isAuthenticated: false }),
}));
