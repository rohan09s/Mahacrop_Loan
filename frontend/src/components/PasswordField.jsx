import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordField({ label, name, autoComplete, minLength, required = false }) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <label className="password-field">{label}
      <span className="password-input-wrap">
        <input name={name} type={isVisible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required={required} />
        <button className="password-visibility" type="button" aria-label={isVisible ? 'पासवर्ड लपवा' : 'पासवर्ड दाखवा'} aria-pressed={isVisible} onClick={() => setIsVisible(!isVisible)}>
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  )
}
