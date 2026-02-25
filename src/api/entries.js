const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchYears(token) {
  const response = await fetch(`${API_URL}/entries/years`, {
    headers: { ...authHeaders(token) }
  });

  if (!response.ok) throw new Error('Failed to fetch years');
  return response.json();
}

export async function fetchEntriesByYear(year, token) {
  const response = await fetch(`${API_URL}/entries/year/${year}`, {
    headers: { ...authHeaders(token) }
  });

  if (!response.ok) throw new Error('Failed to fetch entries');
  return response.json();
}

export async function saveEntry(payload, token) {
  const response = await fetch(`${API_URL}/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to save entry');
  }

  return response.json();
}
