export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  const token = localStorage.getItem('inv_auth_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
      localStorage.removeItem('inv_auth_token');
      window.dispatchEvent(new Event('auth_expired'));
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data;
    }

    const text = await res.text();
    return {
      success: res.ok,
      message: text || res.statusText,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal menghubungi server: ' + err.message,
    };
  }
}
