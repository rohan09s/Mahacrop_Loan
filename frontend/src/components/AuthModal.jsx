import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { API_URL } from '../config/api'

export default function AuthModal({ onClose, onAuthenticated }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [authMethod, setAuthMethod] = useState('otp')
  const [pendingPasswordUser, setPendingPasswordUser] = useState(null)
  const [step, setStep] = useState('mobile')

  async function postJson(path, data) {
    const response = await fetch(`${API_URL}/api/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('API कडून JSON प्रतिसाद मिळाला नाही. Render वर frontend चे VITE_API_URL backend URL वर सेट करून frontend पुन्हा deploy करा.')
    }
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'काहीतरी चूक झाली. पुन्हा प्रयत्न करा.')
    return result
  }

  async function resendOtp() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await postJson(authMethod === 'reset' ? 'auth/password/reset/send' : 'auth/otp/send', { mobileNumber })
      setNotice(result.message)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      if (authMethod === 'password') {
        const normalizedMobile = (data.mobileNumber || '').replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
        const result = await postJson('auth/password/login', { ...data, mobileNumber: normalizedMobile })
        onAuthenticated(result.user)
      } else if (authMethod === 'reset' && step === 'mobile') {
        const normalizedMobile = (data.mobileNumber || mobileNumber).replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
        const result = await postJson('auth/password/reset/send', { mobileNumber: normalizedMobile })
        setMobileNumber(normalizedMobile)
        setNotice(result.message)
        setStep('otp')
      } else if (authMethod === 'reset' && step === 'otp') {
        const otp = data.otp?.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
        const result = await postJson('auth/password/reset/verify', { mobileNumber, otp })
        setNotice(result.message)
        setStep('setPassword')
      } else if (authMethod === 'reset' && step === 'setPassword') {
        const result = await postJson('auth/password/reset/complete', data)
        onAuthenticated(result.user)
      } else if (step === 'mobile') {
        const normalizedMobile = (data.mobileNumber || mobileNumber).replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
        const result = await postJson('auth/otp/send', { mobileNumber: normalizedMobile })
        setMobileNumber(normalizedMobile)
        setNotice(result.message)
        setStep('otp')
      } else if (step === 'otp') {
        const otp = data.otp?.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
        const result = await postJson('auth/otp/verify', { mobileNumber, otp })
        if (result.user && result.needsPassword) {
          setPendingPasswordUser(result.user)
          setStep('setPassword')
        } else if (result.user) onAuthenticated(result.user)
        else setStep('profile')
      } else if (step === 'setPassword') {
        const result = await postJson('auth/password/set', data)
        onAuthenticated(result.user)
      } else {
        const result = await postJson('auth/complete-registration', data)
        if (result.needsPassword) {
          setPendingPasswordUser(result.user)
          setStep('setPassword')
        } else onAuthenticated(result.user)
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  const title = authMethod === 'reset'
    ? step === 'setPassword' ? 'नवीन पासवर्ड तयार करा'
      : step === 'otp' ? 'मोबाईल पडताळणी'
        : 'पासवर्ड विसरलात?'
    : authMethod === 'password'
    ? 'पासवर्डने लॉग इन करा'
    : step === 'profile' ? 'खाते तयार करा'
      : step === 'otp' ? 'मोबाईल पडताळणी'
        : step === 'setPassword' ? 'पासवर्ड तयार करा'
          : 'मोबाईलने लॉग इन करा'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="login-panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" aria-label="फॉर्म रद्द करा" title="फॉर्म रद्द करा" onClick={onClose}><X size={19} /></button>
        <div className="login-mark"><img src="/mahacrop.png" alt="" /></div>
        <p className="login-kicker">महाक्रॉप लोन</p>
        <h2 id="auth-title">{title}</h2>
        <p className="login-description">{authMethod === 'reset'
          ? step === 'setPassword' ? 'तुमचा मोबाईल क्रमांक पडताळला आहे. नवीन पासवर्ड सेट करा.'
            : step === 'otp' ? `${mobileNumber} या क्रमांकावर आलेला OTP भरा.`
              : 'नोंदणीकृत मोबाईल क्रमांकावर OTP पाठवून पासवर्ड रीसेट करा.'
          : authMethod === 'password'
          ? 'तुमचा नोंदणीकृत मोबाईल क्रमांक आणि पासवर्ड वापरा.'
          : step === 'profile' ? 'मोबाईल पडताळला. खाते तयार करण्यासाठी तुमचे तपशील भरा.'
            : step === 'otp' ? `${mobileNumber} या क्रमांकावर आलेला OTP भरा.`
              : step === 'setPassword' ? 'OTP ने लॉग इन झाले आहे. पुढील वेळी पासवर्डने प्रवेश करण्यासाठी पासवर्ड तयार करा.'
                : 'OTP ने लॉग इन करा किंवा पासवर्ड वापरा.'}</p>
        <form className="login-form" onSubmit={submit}>
          {(authMethod === 'password' || step === 'mobile') && <label>मोबाईल क्रमांक<input name="mobileNumber" type="tel" inputMode="numeric" autoComplete="tel" placeholder="१० अंकी मोबाईल क्रमांक" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} maxLength="10" required /></label>}
          {authMethod === 'password' && <label>पासवर्ड<input name="password" type="password" autoComplete="current-password" required /></label>}
          {step === 'otp' && <label>OTP<input name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="SMS मधील OTP" maxLength="8" required /></label>}
          {step === 'profile' && <>
            <label>पूर्ण नाव<input name="fullName" autoComplete="name" required minLength="2" /></label>
            <div className="location-fields"><label>गाव / शहर<input name="townVillage" required /></label><label>तालुका<input name="tehsilTaluka" required /></label></div>
            <label>जिल्हा<input name="district" required /></label>
            <label>पासवर्ड<input name="password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required /></label>
          </>}
          {step === 'setPassword' && <label>नवीन पासवर्ड<input name="password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? 'कृपया थांबा...' : authMethod === 'password' ? 'लॉग इन करा' : authMethod === 'reset' ? step === 'mobile' ? 'रीसेट OTP पाठवा' : step === 'otp' ? 'OTP पडताळा' : 'नवीन पासवर्ड जतन करा' : step === 'mobile' ? 'OTP पाठवा' : step === 'otp' ? 'OTP पडताळा' : step === 'setPassword' ? 'पासवर्ड जतन करा' : 'खाते तयार करा'}<ArrowRight size={17} /></button>
        </form>
        {authMethod === 'password' && <div className="auth-links"><button type="button" disabled={busy} onClick={() => { setAuthMethod('otp'); setError(''); setNotice('') }}>OTP ने लॉग इन करा</button><button type="button" disabled={busy} onClick={() => { setAuthMethod('reset'); setStep('mobile'); setError(''); setNotice('') }}>पासवर्ड विसरलात?</button></div>}
        {authMethod === 'otp' && step === 'mobile' && <div className="auth-links"><button type="button" disabled={busy} onClick={() => { setAuthMethod('password'); setError(''); setNotice('') }}>पासवर्डने लॉग इन करा</button></div>}
        {authMethod === 'reset' && <div className="auth-links"><button type="button" disabled={busy} onClick={() => { setAuthMethod('password'); setStep('mobile'); setError(''); setNotice('') }}>पासवर्ड लॉग इनकडे परत जा</button>{step === 'otp' && <button type="button" disabled={busy} onClick={resendOtp}>OTP पुन्हा पाठवा</button>}</div>}
        {authMethod !== 'reset' && step === 'otp' && <div className="auth-links"><button type="button" disabled={busy} onClick={() => { setStep('mobile'); setError(''); setNotice('') }}>मोबाईल क्रमांक बदला</button><button type="button" disabled={busy} onClick={resendOtp}>OTP पुन्हा पाठवा</button></div>}
        {step === 'setPassword' && <div className="auth-links"><button type="button" disabled={busy} onClick={() => onAuthenticated(pendingPasswordUser)}>OTP ने पुढे जा</button></div>}
      </section>
    </div>
  )
}
