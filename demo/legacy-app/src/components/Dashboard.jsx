import React, { useState, useEffect } from 'react';
import UserCard from './UserCard';
import { fetchUsers } from '../utils/api';

function Dashboard(props) {
  const { title, currentUser } = props;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers()
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function handleUserClick(user) {
    console.log('Selected user:', user.name);
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="dashboard">
      <header>
        <h1>{title}</h1>
        <span>Welcome, {currentUser}</span>
      </header>
      <div className="grid">
        {users.map(user => (
          <UserCard
            key={user.id}
            user={user}
            loading={loading}
            onClick={() => handleUserClick(user)}
          />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
