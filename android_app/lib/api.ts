import { getToken } from './auth';

// Change this to your machine's local IP when testing on physical device
// e.g., 'http://192.168.1.5:5000/api'
// Or use a deployed URL for production
export const API_BASE = 'http://10.42.32.32:5000/api'; // Wi-Fi IP of this PC + Flask port

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiCall<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  data?: any,
  auth: boolean = false,
  isFormData: boolean = false
): Promise<T> {
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const opts: RequestInit = { method, headers };
  if (data) {
    opts.body = isFormData ? data : JSON.stringify(data);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return payload ?? ({} as T);
}

// ── Typed API methods ──────────────────────────────────────────────────

// AUTH
export const authApi = {
  login: (email: string, password: string) =>
    apiCall('POST', '/auth/login', { email, password }),
  register: (data: object) =>
    apiCall('POST', '/auth/register', data),
  me: () =>
    apiCall('GET', '/auth/me', undefined, true),
  updateMe: (data: object) =>
    apiCall('PUT', '/auth/me', data, true),
  registerOwner: (data: object) =>
    apiCall('POST', '/auth/register-owner', data),
};

// EQUIPMENT
export const equipmentApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiCall('GET', `/equipment${qs}`, undefined, true);
  },
  detail: (id: string) =>
    apiCall('GET', `/equipment/${id}`, undefined, true),
  create: (data: FormData) =>
    apiCall('POST', '/equipment', data, true, true),
  update: (id: string, data: FormData) =>
    apiCall('PUT', `/equipment/${id}`, data, true, true),
  delete: (id: string) =>
    apiCall('DELETE', `/equipment/${id}`, undefined, true),
  myEquipment: () =>
    apiCall('GET', '/equipment/my', undefined, true),
  availability: (id: string, start: string, end: string) =>
    apiCall('GET', `/equipment/${id}/availability?start=${start}&end=${end}`, undefined, true),
};

// RENTALS
export const rentalsApi = {
  create: (data: object) =>
    apiCall('POST', '/rentals', data, true),
  myRentals: () =>
    apiCall('GET', '/rentals/my', undefined, true),
  ownerRentals: () =>
    apiCall('GET', '/rentals/owner', undefined, true),
  detail: (id: string) =>
    apiCall('GET', `/rentals/${id}`, undefined, true),
  cancel: (id: string) =>
    apiCall('POST', `/rentals/${id}/cancel`, undefined, true),
  review: (id: string, rating: number, review: string) =>
    apiCall('POST', `/rentals/${id}/review`, { rating, review }, true),
  verifyPayment: (id: string, data: object) =>
    apiCall('POST', `/rentals/${id}/verify-payment`, data, true),
  createOrder: (id: string) =>
    apiCall('POST', `/rentals/${id}/create-order`, undefined, true),
};

// KYC
export const kycApi = {
  submit: (data: FormData) =>
    apiCall('POST', '/auth/kyc', data, true, true),
  status: () =>
    apiCall('GET', '/auth/kyc/status', undefined, true),
};

// CONTACT
export const contactApi = {
  submit: (data: object) =>
    apiCall('POST', '/contact', data),
};

// ADMIN
export const adminApi = {
  pendingKyc: () =>
    apiCall('GET', '/admin/kyc/pending', undefined, true),
  approveKyc: (ownerId: string) =>
    apiCall('POST', `/admin/kyc/${ownerId}/approve`, undefined, true),
  rejectKyc: (ownerId: string, reason: string) =>
    apiCall('POST', `/admin/kyc/${ownerId}/reject`, { reason }, true),
  allEquipment: () =>
    apiCall('GET', '/admin/equipment', undefined, true),
  toggleEquipment: (id: string) =>
    apiCall('POST', `/admin/equipment/${id}/toggle`, undefined, true),
  stats: () =>
    apiCall('GET', '/admin/stats', undefined, true),
};
