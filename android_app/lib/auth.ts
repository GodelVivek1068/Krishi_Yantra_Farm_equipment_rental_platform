import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'ky_token';
const USER_KEY = 'ky_user';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location?: string;
  role: 'farmer' | 'owner' | 'admin' | 'renter';
  kyc_status?: 'pending' | 'approved' | 'rejected';
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setAuth(token: string, user: User): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function setUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

export async function isOwner(): Promise<boolean> {
  const user = await getUser();
  return user?.role === 'owner';
}

export async function isFarmer(): Promise<boolean> {
  const user = await getUser();
  return user?.role === 'farmer' || user?.role === 'renter';
}

export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  return user?.role === 'admin';
}
