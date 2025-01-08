import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('locations');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      const response = await api.get(`/api/admin/search?query=${searchQuery}&type=${searchType}`);
      setSearchResults(response.data);
    } catch (err) {
      setError('Search failed');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user and all their content?')) {
      try {
        await api.delete(`/api/admin/users/${userId}`);
        loadUsers();
      } catch (err) {
        setError('Failed to delete user');
      }
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      
      <div className="search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search content..."
        />
        <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
          <option value="locations">Locations</option>
        </select>
        <button onClick={handleSearch}>Search</button>
      </div>

      <div className="users-section">
        <h3>Users</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Credits</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.profile?.name || 'N/A'}</td>
                <td>{user.credits}</td>
                <td>{user.isAdmin ? '✓' : ''}</td>
                <td>
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <h3>Search Results</h3>
          {searchResults.map(result => (
            <div key={result.id} className="result-item">
              <p>{result.content.text}</p>
              <small>Posted by: {result.creator.email}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 