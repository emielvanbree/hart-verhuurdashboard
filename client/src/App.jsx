import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { auth } from './api.js';

import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reservations from './pages/Reservations.jsx';
import ReservationNew from './pages/ReservationNew.jsx';
import ReservationDetail from './pages/ReservationDetail.jsx';
import WalkIn from './pages/WalkIn.jsx';
import RentalDetail from './pages/RentalDetail.jsx';
import Articles from './pages/Articles.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Waitlist from './pages/Waitlist.jsx';
import ChangePassword from './pages/ChangePassword.jsx';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reservations" element={<Reservations />} />
                  <Route path="/reservations/new" element={<ReservationNew />} />
                  <Route path="/reservations/:id" element={<ReservationDetail />} />
                  <Route path="/walk-in" element={<WalkIn />} />
                  <Route path="/rentals/:id" element={<RentalDetail />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="/articles" element={<RequireAdmin><Articles /></RequireAdmin>} />
                  <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
                  <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
                </Routes>
              </Layout>
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
