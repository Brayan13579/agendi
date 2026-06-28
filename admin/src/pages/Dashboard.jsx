import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTenants, setTenantActive } from '../services/api'

export default function Dashboard() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchTenants() }, [])

  async function fetchTenants() {
    try {
      const res = await listTenants()
      setTenants(res.data.tenants)
    } catch {
      setError('Error cargando los negocios')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(tenant) {
    try {
      await setTenantActive(tenant.id, !tenant.active)
      setTenants(prev => prev.map(t =>
        t.id === tenant.id ? { ...t, active: !t.active } : t
      ))
    } catch {
      alert('Error actualizando el estado')
    }
  }

  function logout() {
    localStorage.removeItem('ADMIN_TOKEN')
    navigate('/login')
  }

  const active = tenants.filter(t => t.active).length
  const suspended = tenants.filter(t => !t.active).length

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerLogo}>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>A</span>gendi
          </span>
          <span style={styles.headerTag}>Super Admin</span>
        </div>
        <button className="btn-secondary" onClick={logout} style={{ padding: '8px 16px' }}>
          Cerrar sesión
        </button>
      </header>

      <main style={styles.main}>
        {/* Stats */}
        <div style={styles.stats}>
          <div className="card" style={styles.stat}>
            <div style={styles.statNum}>{tenants.length}</div>
            <div style={styles.statLabel}>Negocios totales</div>
          </div>
          <div className="card" style={styles.stat}>
            <div style={{ ...styles.statNum, color: 'var(--green)' }}>{active}</div>
            <div style={styles.statLabel}>Activos</div>
          </div>
          <div className="card" style={styles.stat}>
            <div style={{ ...styles.statNum, color: 'var(--red)' }}>{suspended}</div>
            <div style={styles.statLabel}>Suspendidos</div>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={styles.tableHeader}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Negocios</h2>
            <button className="btn-primary" onClick={() => navigate('/tenants/new')}>
              + Agregar negocio
            </button>
          </div>

          {loading && <div style={styles.emptyMsg}>Cargando...</div>}
          {error && <div style={{ padding: 24 }}><div className="error-msg">{error}</div></div>}

          {!loading && tenants.length === 0 && (
            <div style={styles.emptyMsg}>
              No hay negocios registrados aún.{' '}
              <span
                style={{ color: 'var(--gold)', cursor: 'pointer' }}
                onClick={() => navigate('/tenants/new')}
              >
                Agrega el primero
              </span>
            </div>
          )}

          {!loading && tenants.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Negocio</th>
                  <th style={styles.th}>Admin (teléfono)</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(tenant => (
                  <tr key={tenant.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{tenant.id}</div>
                    </td>
                    <td style={styles.td}>{tenant.adminPhone || '—'}</td>
                    <td style={styles.td}>
                      <span className={`badge ${tenant.active ? 'badge-green' : 'badge-red'}`}>
                        {tenant.active ? '● Activo' : '● Suspendido'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => navigate(`/tenants/${tenant.id}`)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        Ver detalle
                      </button>
                      <button
                        className={tenant.active ? 'btn-danger' : 'btn-success'}
                        onClick={() => toggleActive(tenant)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        {tenant.active ? 'Suspender' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  header: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '0 32px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerLogo: { fontSize: 20, fontWeight: 600, letterSpacing: 1 },
  headerTag: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 11,
    color: 'var(--gold)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  stat: { textAlign: 'center', padding: '20px 16px' },
  statNum: { fontSize: 36, fontWeight: 700, color: 'var(--gold)' },
  statLabel: { color: 'var(--text-dim)', fontSize: 13, marginTop: 4 },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)'
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: 'var(--surface2)' },
  th: {
    padding: '10px 24px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--border)'
  },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  td: { padding: '14px 24px', verticalAlign: 'middle' },
  emptyMsg: { padding: 40, textAlign: 'center', color: 'var(--text-dim)' }
}
