// App.js
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { GoogleMap, useLoadScript, InfoWindow, Marker } from '@react-google-maps/api';
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom';
import ProfilePage from './components/ProfilePage';
import MapErrorBoundary from './components/MapErrorBoundary';

const LIBRARIES = ['places'];

// Create a context for Google Maps
const GoogleMapsContext = createContext(null);

function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  if (loadError) {
    console.error('Error loading maps:', loadError);
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading maps...</div>;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationData, setLocationData] = useState([]);
  const [contentForm, setContentForm] = useState({
    text: '',
    media: []
  });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);
  const [mapCenter] = useState({
    lat: 40.7128,
    lng: -74.0060
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);

  const mapStyles = {
    height: "100vh",
    width: "100%"
  };

  // Fetch locations when user changes
  useEffect(() => {
    if (user) {
      fetchLocations();
    }
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (!isRegistering) {
          localStorage.setItem('token', data.token);
          setUser({ 
            email: data.user.email,
            userId: data.user._id.toString()
          });
          console.log('Login successful!');
        } else {
          setIsRegistering(false);
          alert('Registration successful! Please login.');
        }
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Authentication failed');
    }
  };

  const handleMapClick = (event) => {
    if (!user) return;
    const clickedLat = event.latLng.lat();
    const clickedLng = event.latLng.lng();
    console.log('Map clicked at:', { lat: clickedLat, lng: clickedLng });
    
    setSelectedLocation({
      lat: clickedLat,
      lng: clickedLng
    });
    
    // Close any open InfoWindows when clicking on the map
    setSelectedMarker(null);
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const formData = new FormData();
      formData.append('latitude', selectedLocation.lat);
      formData.append('longitude', selectedLocation.lng);
      formData.append('text', contentForm.text);
      
      // Append each media file
      if (contentForm.media) {
        contentForm.media.forEach(file => {
          formData.append('media', file);
        });
      }

      console.log('Submitting location with data:', {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        text: contentForm.text,
        mediaCount: contentForm.media.length
      });

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/user/locations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const responseData = await response.json();
      console.log('Server response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save location');
      }

      // Clear form and selected location
      setContentForm({ text: '', media: [] });
      setSelectedLocation(null);
      setSelectedMarker(null);
      
      // Refresh locations
      fetchLocations();
      
    } catch (error) {
      console.error('Error submitting location data:', error);
      setError(error.message);
    }
  };

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching locations with token:', token?.substring(0, 20) + '...');

      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch('http://localhost:3000/api/user/locations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fetch error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw response data:', data);
      
      if (Array.isArray(data)) {
        console.log('Number of locations received:', data.length);
        if (data.length > 0) {
          console.log('First location:', JSON.stringify(data[0], null, 2));
        } else {
          console.log('No locations returned from API');
        }
        setLocationData(data);
      } else {
        console.error('Unexpected data format:', data);
      }
    } catch (error) {
      console.error('Error in fetchLocations:', error);
      // Don't rethrow the error, just log it
    }
  };

  useEffect(() => {
    console.log('LocationData updated:', locationData);
  }, [locationData]);

  const handleMapLoad = (mapInstance) => {
    console.log('Map loaded successfully');
    setMap(mapInstance);
  };

  const handleMapUnmount = () => {
    try {
      console.log('Map unmounting');
      setMap(null);
    } catch (error) {
      console.error('Error unmounting map:', error);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSelectedMarker(null);
        fetchLocations();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete location');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  const renderAuthForm = () => (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <h2>{isRegistering ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleAuth}>
        {isRegistering && (
          <div>
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
        )}
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? 'Switch to Login' : 'Switch to Register'}
        </button>
      </form>
    </div>
  );

  // Only render the map when user is logged in
  if (!user) {
    return renderAuthForm();
  }

  const router = createBrowserRouter([
    {
      path: "/",
      element: (
        <div className="app">
          <div style={{ 
            position: 'absolute', 
            top: '10px', 
            right: '10px', 
            zIndex: 1,
            display: 'flex',
            gap: '10px',
            background: 'white',
            padding: '10px',
            borderRadius: '5px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <Link to="/profile">
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Profile</button>
            </Link>
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                setUser(null);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >Logout</button>
          </div>

          <MapErrorBoundary>
            <div className="map-container">
              <GoogleMap
                mapContainerStyle={mapStyles}
                zoom={13}
                center={mapCenter}
                onClick={handleMapClick}
                onLoad={handleMapLoad}
                onUnmount={handleMapUnmount}
                options={{
                  disableDefaultUI: true,
                  clickableIcons: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  streetViewControl: false
                }}
              >
                {locationData && locationData.map(location => (
                  <Marker
                    key={location._id}
                    position={{
                      lat: parseFloat(location.location.coordinates[1]),
                      lng: parseFloat(location.location.coordinates[0])
                    }}
                    onClick={(e) => {
                      if (e) {
                        e.domEvent.stopPropagation();
                        e.stop();
                      }
                      setSelectedLocation(null);
                      setSelectedMarker(location);
                    }}
                  />
                ))}

                {selectedLocation && (
                  <Marker
                    position={selectedLocation}
                    onClick={(e) => {
                      if (e) {
                        e.domEvent.stopPropagation();
                        e.stop();
                      }
                    }}
                  />
                )}

                {selectedMarker && (
                  <InfoWindow
                    position={{
                      lat: parseFloat(selectedMarker.location.coordinates[1]),
                      lng: parseFloat(selectedMarker.location.coordinates[0])
                    }}
                    onCloseClick={() => {
                      setSelectedMarker(null);
                    }}
                  >
                    <div style={{ padding: '10px' }}>
                      <h3 style={{ margin: '0 0 10px 0' }}>Location Details</h3>
                      <p style={{ margin: '0 0 10px 0' }}>{selectedMarker.content.text}</p>
                      {selectedMarker.content.mediaUrls && 
                        selectedMarker.content.mediaUrls.map((url, index) => (
                          <img 
                            key={index}
                            src={`http://localhost:3000/${url}`}
                            alt="Location media"
                            style={{ 
                              maxWidth: '200px', 
                              maxHeight: '200px',
                              display: 'block',
                              margin: '10px 0'
                            }}
                          />
                        ))
                      }
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </div>
          </MapErrorBoundary>

          {selectedLocation && (
            <div style={{ 
              position: 'absolute', 
              bottom: '20px', 
              left: '50%', 
              transform: 'translateX(-50%)',
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}>
              <form onSubmit={handleLocationSubmit}>
                <textarea
                  value={contentForm.text}
                  onChange={e => setContentForm({ ...contentForm, text: e.target.value })}
                  placeholder="Enter location description"
                  style={{ width: '100%', marginBottom: '10px' }}
                />
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={e => setContentForm({ ...contentForm, media: Array.from(e.target.files) })}
                />
                <button type="submit">Save Location Data</button>
              </form>
            </div>
          )}
        </div>
      )
    },
    {
      path: "/profile",
      element: <ProfilePage user={user} />
    }
  ]);

  return (
    <ErrorBoundary>
      <GoogleMapsProvider>
        <RouterProvider router={router} />
      </GoogleMapsProvider>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Map Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong with the map. Please refresh the page.</div>;
    }

    return this.props.children;
  }
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}