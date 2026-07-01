import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTenant, updateTenant, setTenantActive, resetTenantPassword } from '../services/api'

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newPassword, setNewPassword] = useState(null)

  const flashTimer = useRef(null)

  const [form, setForm] = useState({
    name: '',
    adminPhone: '',
    phoneNumberId: '',
    whatsappToken: ''
  })

  useEffect(() => { fetchTenant() }, [id])

  async function fetchTenant() {
    try {
      const res = await getTenant(id)
      const t = res.data.tenant
      setTenant(t)
      setForm({
        name: t.name || '',
        adminPhone: t.adminPhone || '',
        phoneNumberId: t.phoneNumberId || '',
        whatsappToken: t.whatsappToken || ''
      })
    } catch {
      setError('Error cargando el negocio')
    } finally {
      setLoading(false)
    }
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateTenant(id, form)
      setTenant(prev => ({ ...prev, ...form }))
      flash('Cambios guardados correctamente')
    } catch {
      flash('Error guardando los cambios', true)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive() {
    try {
      await setTenantActive(id, !tenant.active)
      setTenant(prev => ({ ...prev, active: !prev.active }))
      flash(`Negocio ${!tenant.active ? 'activado' : 'suspendido'}`)
    } catch {
      flash('Error actualizando el estado', true)
    }
  }

  async function handleResetPassword() {
    if (!confirm(`¿Generar nueva contraseña temporal para ${tenant.adminPhone}?`)) return
    try {
      const res = await resetTenantPassword(id)
      setNewPassword(res.data.tempPassword)
    } catch {
      flash('Error reseteando la contraseña', true)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Cargando...</div>

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '6px 12px' }}>
            ← Panel
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{tenant?.name}</h1>
          {tenant && (
            <span className={`badge ${tenant.active ? 'badge-green' : 'badge-red'}`}>
              {tenant.active ? '● Activo' : '● Suspendido'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={tenant?.active ? 'btn-danger' : 'btn-success'}
            onClick={handleToggleActive}
            style={{ padding: '8px 16px' }}
          >
            {tenant?.active ? 'Suspender negocio' : 'Activar negocio'}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <div style={styles.grid}>
          {/* Formulario de edición */}
          <div className="card">
            <h2 style={styles.sectionTitle}>Datos del negocio</h2>
            <form onSubmit={handleSave} style={styles.form}>
              <div>
                <label>Nombre del negocio</label>
                <input value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div>
                <label>Teléfono del admin</label>
                <input value={form.adminPhone} onChange={e => update('adminPhone', e.target.value)} />
              </div>
              <div>
                <label>Phone Number ID (Meta)</label>
                <input value={form.phoneNumberId} onChange={e => update('phoneNumberId', e.target.value)} />
              </div>
              <div>
                <label>Token de WhatsApp</label>
                <input
                  type="password"
                  placeholder="No modificado"
                  value={form.whatsappToken}
                  onChange={e => update('whatsappToken', e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Info */}
            <div className="card">
              <h2 style={styles.sectionTitle}>Información</h2>
              <div style={styles.infoGrid}>
                <span style={styles.infoLabel}>ID del negocio</span>
                <code style={styles.infoValue}>{id}</code>
                <span style={styles.infoLabel}>Creado</span>
                <span style={styles.infoValue}>
                  {tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString('es-CO', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }) : '—'}
                </span>
              </div>
            </div>

            {/* Reset contraseña */}
            <div className="card">
              <h2 style={styles.sectionTitle}>Contraseña del admin</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
                Genera una contraseña temporal. El admin puede cambiarla desde la app móvil.
              </p>
              {newPassword && (
                <div style={styles.newPassBox}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                    Nueva contraseña temporal:
                  </div>
                  <code style={{ fontSize: 24, color: 'var(--gold)', fontWeight: 700 }}>
                    {newPassword}
                  </code>
                  <button
                    className="btn-secondary"
                    onClick={() => navigator.clipboard.writeText(newPassword).then(() => flash('Contraseña copiada'))}
                    style={{ marginTop: 10, padding: '6px 16px', fontSize: 13 }}
                  >
                    Copiar
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                    ⚠️ Cópiala ahora — no se mostrará de nuevo
                  </div>
                </div>
              )}
              <button className="btn-secondary" onClick={handleResetPassword} style={{ width: '100%' }}>
                Resetear contraseña
              </button>
            </div>
          </div>
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
  main: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 24,
    alignItems: 'start'
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '10px 16px',
    alignItems: 'center'
  },
  infoLabel: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' },
  infoValue: { fontSize: 14, color: 'var(--text)' },
  newPassBox: {
    background: 'var(--surface2)',
    border: '1px solid var(--gold-dim)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    textAlign: 'center'
  }
}
