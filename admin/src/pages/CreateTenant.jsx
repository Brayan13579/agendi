import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTenant } from '../services/api'

export default function CreateTenant() {
  const [form, setForm] = useState({
    name: '',
    adminPhone: '',
    phoneNumberId: '',
    whatsappToken: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await createTenant(form)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando el negocio')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <h2 style={styles.title}>✅ Negocio creado</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
            Comparte estas credenciales con el administrador del negocio.
          </p>

          <div className="success-msg" style={{ marginBottom: 16 }}>
            {result.message}
          </div>

          <div style={styles.credBox}>
            <div style={styles.credRow}>
              <span style={styles.credLabel}>Negocio ID</span>
              <code style={styles.credValue}>{result.tenantId}</code>
            </div>
            <div style={styles.credRow}>
              <span style={styles.credLabel}>Teléfono (usuario)</span>
              <code style={styles.credValue}>{result.adminPhone}</code>
            </div>
            <div style={styles.credRow}>
              <span style={styles.credLabel}>Contraseña temporal</span>
              <code style={{ ...styles.credValue, color: 'var(--gold)', fontSize: 20, fontWeight: 700 }}>
                {result.tempPassword}
              </code>
            </div>
          </div>

          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 16 }}>
            ⚠️ Esta contraseña solo se muestra una vez. El admin puede cambiarla desde la app móvil.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button className="btn-primary" onClick={() => navigate('/')}>
              Volver al panel
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/tenants/${result.tenantId}`)}>
              Ver detalle
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '6px 12px' }}>
            ← Volver
          </button>
          <h2 style={styles.title}>Nuevo negocio</h2>
        </div>
        <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
          Completa los datos del negocio. Se generará una contraseña temporal para el admin.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div className="error-msg">{error}</div>}

          <div>
            <label>Nombre del negocio *</label>
            <input
              type="text"
              placeholder="Ej: Barbería López"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              required
            />
            {form.name && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                ID generado: <code style={{ color: 'var(--gold)' }}>
                  {form.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                </code>
              </div>
            )}
          </div>

          <div>
            <label>Teléfono del admin *</label>
            <input
              type="tel"
              placeholder="+57 300 000 0000"
              value={form.adminPhone}
              onChange={e => update('adminPhone', e.target.value)}
              required
            />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              Este número será el usuario de la app móvil
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gold)', marginBottom: 16, fontWeight: 600 }}>
              Configuración de WhatsApp Business
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label>Phone Number ID (Meta) *</label>
                <input
                  type="text"
                  placeholder="123456789012345"
                  value={form.phoneNumberId}
                  onChange={e => update('phoneNumberId', e.target.value)}
                  required
                />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                  Meta Business → WhatsApp → Configuración del teléfono
                </div>
              </div>

              <div>
                <label>Token de WhatsApp Business *</label>
                <input
                  type="password"
                  placeholder="EAAig..."
                  value={form.whatsappToken}
                  onChange={e => update('whatsappToken', e.target.value)}
                  required
                />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                  Meta Business → Tokens de acceso → Token permanente
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ padding: '12px', marginTop: 8 }}
          >
            {loading ? 'Creando negocio...' : 'Crear negocio'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 24px'
  },
  box: {
    width: '100%',
    maxWidth: 560,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 40
  },
  title: { fontSize: 20, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  credBox: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  credRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  credLabel: { fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  credValue: { fontSize: 16, color: 'var(--text)', fontFamily: 'monospace', background: 'var(--bg)', padding: '6px 10px', borderRadius: 4 }
}
