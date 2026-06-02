'use client'

import { useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  autoComplete?: string
  style?: React.CSSProperties
}

export default function PasswordInput({
  value, onChange, placeholder, required, autoFocus, autoComplete = 'current-password', style
}: Props) {
  const [mostrar, setMostrar] = useState(false)

  const containerStyle: React.CSSProperties = { position: 'relative', width: '100%' }
  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 40px 10px 12px',  // espaço pro botão à direita
    fontSize: '14px',
    border: '0.5px solid #D4D2CA',
    borderRadius: '8px',
    outline: 'none',
    background: '#FAFAF8',
    boxSizing: 'border-box',
    color: '#1A1916',
    ...style,
  }

  return (
    <div style={containerStyle}>
      <input
        type={mostrar ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        style={inputBaseStyle}
      />
      <button
        type="button"
        onClick={() => setMostrar(s => !s)}
        aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '16px',
          color: '#888780',
          lineHeight: 1,
        }}
        tabIndex={-1}
      >
        {mostrar ? '🙈' : '👁'}
      </button>
    </div>
  )
}
