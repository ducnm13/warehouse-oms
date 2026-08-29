export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}