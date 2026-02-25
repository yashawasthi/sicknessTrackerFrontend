const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

async function handleResponse(response, fallbackMessage) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || fallbackMessage);
  }
  return response.json();
}

export async function signup(payload) {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return handleResponse(response, 'Failed to sign up');
}

export async function login(payload) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return handleResponse(response, 'Failed to login');
}

export async function getMe(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return handleResponse(response, 'Failed to validate session');
}
