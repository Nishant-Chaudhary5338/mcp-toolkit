import { useState, useEffect } from 'react';
import { fetchUsers } from '../utils/api';

export function useUsers(filter) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUsers()
      .then(data => {
        const filtered = filter ? data.filter(u => u.role === filter) : data;
        setUsers(filtered);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [filter]);

  return { users, loading, error };
}

export function useUserById(id) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(data => { setUser(data); setLoading(false); });
  }, [id]);

  return { user, loading };
}
