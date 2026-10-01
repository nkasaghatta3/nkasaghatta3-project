let authToken: string | null = null;

export function getToken() {
  return authToken;
}

export function setToken(token: string) {
  authToken = token;
}

export function clearToken() {
  authToken = null;
}
