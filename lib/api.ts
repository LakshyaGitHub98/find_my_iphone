export interface Device {
  id: string;
  name: string;
  model: string;
  deviceClass: string;
  batteryLevel: number;
  batteryPercent: string | null;
  isOnline: boolean;
  deviceStatus: string;
  activationLocked: boolean;
  isLocating: boolean;
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  horizontalAccuracy: number | null;
  positionType: string | null;
  isOld: boolean;
}

export interface TwoFactorMethod {
  type: "trusted_device" | "phone";
  id: string;
  label: string;
}

export interface LoginResponse {
  status: "ok" | "needs_2fa";
  token?: string;
  methods?: TwoFactorMethod[];
}

export interface DeviceDetail extends Device {
  status: Record<string, unknown>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  auth: {
    login: (appleId: string, password: string) =>
      request<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ apple_id: appleId, password }),
      }),

    send2FA: (token: string, methodId: string) =>
      request<{ status: string }>("/api/auth/2fa/send", {
        method: "POST",
        body: JSON.stringify({ token, method_id: methodId }),
      }),

    verify2FA: (token: string, methodId: string, code: string) =>
      request<{ status: string }>("/api/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ token, method_id: methodId, code }),
      }),

    verify2FADirect: (token: string, code: string) =>
      request<{ status: string }>("/api/auth/2fa/verify-direct", {
        method: "POST",
        body: JSON.stringify({ token, code }),
      }),

    checkSession: () =>
      request<{ authenticated: boolean }>("/api/auth/session"),

    logout: () =>
      request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  },

  devices: {
    list: () => request<Device[]>("/api/devices"),

    get: (id: string) => request<DeviceDetail>(`/api/devices/${id}`),

    location: (id: string) =>
      request<DeviceLocation>(`/api/devices/${id}/location`),

    playSound: (id: string, message = "Find My iPhone Alert") =>
      request<{ status: string }>(`/api/devices/${id}/sound`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),

    lostMode: (
      id: string,
      number: string,
      message = "This iPhone has been lost. Please call me.",
      passcode = "",
    ) =>
      request<{ status: string }>(`/api/devices/${id}/lost`, {
        method: "POST",
        body: JSON.stringify({ number, message, passcode }),
      }),
  },
};
