import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="app">
      <Dashboard title="User Management" currentUser="Admin" />
    </div>
  );
}

export default App;
