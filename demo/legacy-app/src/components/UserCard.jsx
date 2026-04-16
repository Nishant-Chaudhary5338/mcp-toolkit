import React from 'react';
import PropTypes from 'prop-types';

function UserCard(props) {
  const { user, onClick, loading } = props;

  if (loading) {
    return <div className="card loading">Loading...</div>;
  }

  return (
    <div className="card" onClick={onClick}>
      <img src={user.avatar} alt={user.name} />
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <span className="role">{user.role}</span>
    </div>
  );
}

UserCard.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    avatar: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
  onClick: PropTypes.func,
  loading: PropTypes.bool,
};

export default UserCard;
