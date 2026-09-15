import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { APP_CONFIG } from './config';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">{APP_CONFIG.initial}</div>
          <div>
            <div className="brand-title">{APP_CONFIG.name}</div>
            <div className="brand-sub">{APP_CONFIG.description}</div>
          </div>
        </div>

        <nav className="nav-tabs">
          <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            智能客服
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
            管理后台
          </NavLink>
        </nav>

        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{APP_CONFIG.project} · v{APP_CONFIG.version}</span>
      </header>

      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
