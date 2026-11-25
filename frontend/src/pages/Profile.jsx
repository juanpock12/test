import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import { getToken, getUser, homePathFor } from '../session';

export default function Profile() {
  const user = getUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`${API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Could not load profile');
          return;
        }

        setEmail(data.email);
        setName(data.name || '');
        setPhone(data.phone || '');
      } catch (err) {
        setError('Could not reach the server');
      }
    }
    loadProfile();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const body = { name };
    if (phone.trim() !== '') {
      body.phone = phone.trim();
    }

    try {
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not save profile');
        return;
      }

      setMessage('Profile saved');
    } catch (err) {
      setError('Could not reach the server');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <h1>Your profile</h1>
      <p>Email: {email}</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="submit">Save</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
      <p>
        <Link to={homePathFor(user?.role)}>Back to home</Link>
      </p>
    </div>
  );
}