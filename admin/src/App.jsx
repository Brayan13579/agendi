import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TenantDetail from './pages/TenantDetail'
import CreateTenant from './pages/CreateTenant'

function PrivateRoute({ children }) {
  return localStorage.getItem('ADMIN_TOKEN') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/tenants/new" element={<PrivateRoute><CreateTenant /></PrivateRoute>} />
        <Route path="/tenants/:id" element={<PrivateRoute><TenantDetail /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
