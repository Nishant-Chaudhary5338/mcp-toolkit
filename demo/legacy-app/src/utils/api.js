const BASE_URL = 'https://api.example.com';

export async function fetchUsers() {
  const response = await fetch(`${BASE_URL}/users`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export async function fetchUser(id) {
  const response = await fetch(`${BASE_URL}/users/${id}`);
  if (!response.ok) throw new Error('User not found');
  return response.json();
}

export async function createUser(data) {
  const response = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
