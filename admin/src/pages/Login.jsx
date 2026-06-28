import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/api'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(phone, password)
      const { token, role } = res.data

      if (role !== 'superadmin') {
        setError('Esta cuenta no tiene acceso al panel de administración.')
        return
      }

      localStorage.setItem('ADMIN_TOKEN', token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <span style={styles.logoA}>A</span>
          <span style={styles.logoText}>gendi</span>
        </div>
        <p style={styles.subtitle}>Panel de administración</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div className="error-msg">{error}</div>}

          <div>
            <label>Teléfono</label>
            <input
              type="tel"
              placeholder="+57 300 000 0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24
  },
  box: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 40,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  logo: {
    textAlign: 'center',
    marginBottom: 4
  },
  logoA: {
    fontSize: 42,
    fontWeight: 700,
    color: 'var(--gold)',
    lineHeight: 1
  },
  logoText: {
    fontSize: 32,
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: 2
  },
  subtitle: {
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: 13,
    marginBottom: 24
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  }
}
