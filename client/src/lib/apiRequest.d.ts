interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
}

export function apiRequest<T = any>(method: ApiRequestOptions['method'], url: string, data?: any): Promise<T>; 