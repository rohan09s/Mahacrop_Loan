import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, Check, Download, Eye, FileUp, LogOut, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { API_URL } from '../config/api'
import { adminDocumentLabels } from '../data/applicationData'
import PasswordField from '../components/PasswordField'

export default function AdminPortal() {
  const [admin, setAdmin] = useState(null)
  const [mode, setMode] = useState('login')
  const [applications, setApplications] = useState([])
  const [feedback, setFeedback] = useState({})
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)

  async function loadApplications() {
    const response = await fetch(`${API_URL}/api/admin/applications`, { credentials: 'include' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'अर्ज लोड करता आले नाहीत.')
    setApplications(result.applications)
  }

  useEffect(() => {
    let isCurrent = true
    fetch(`${API_URL}/api/admin/session`, { credentials: 'include' })
      .then((response) => response.json())
      .then(async (result) => {
        if (!isCurrent) return
        setAdmin(result.admin)
        if (result.admin) {
          try { await loadApplications() } catch (loadError) { if (isCurrent) setError(loadError.message) }
        }
      })
      .catch((loadError) => { if (isCurrent) setError(loadError.message) })
    return () => { isCurrent = false }
  }, [])

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const endpoint = mode === 'login' ? 'login' : 'reset-password'
      const response = await fetch(`${API_URL}/api/admin/${endpoint}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'विनंती पूर्ण करता आली नाही.')
      if (mode === 'login') {
        setAdmin(result.admin)
        await loadApplications()
      } else {
        setMode('login')
        setError('पासवर्ड बदलला. नव्या पासवर्डने लॉग इन करा.')
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch(`${API_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setAdmin(null)
    setApplications([])
    setIsAccountMenuOpen(false)
    setMode('login')
  }

  async function reviewApplication(application, action) {
    const reason = feedback[application._id] || ''
    if (action === 'return' && !reason.trim()) {
      setError(`“${application.fullName}” यांच्या अर्जासाठी परत पाठवण्याचे कारण लिहा.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/applications/${application._id}/review`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'निर्णय जतन करता आला नाही.')
      await loadApplications()
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setBusy(false)
    }
  }

  function getWorkflowStage(application) {
    return application.workflowStage || ({
      approved: 'forwarded',
      rejected: 'returned',
      'under-review': 'verifying',
    }[application.status] || 'submitted')
  }

  const shownApplications = applications.filter((application) => {
    const stage = getWorkflowStage(application)
    if (filter === 'pending') return !['forwarded', 'returned'].includes(stage)
    if (filter === 'forwarded' || filter === 'returned') return stage === filter
    return filter === 'all'
  })
  const pendingCount = applications.filter((application) => !['forwarded', 'returned'].includes(getWorkflowStage(application))).length
  const workflowLabels = {
    submitted: 'अर्ज प्राप्त',
    received: 'प्रशासकाने अर्ज उघडला',
    verifying: 'अर्ज व कागदपत्रांची पडताळणी सुरू',
    verified: 'पडताळणी पूर्ण',
    forwarded: 'पुढील टप्प्यासाठी पाठवले',
    returned: 'दुरुस्तीसाठी परत पाठवले',
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="admin-brand" to="/"><img src="/mahacrop.png" alt="" /><span>Mahacrop <b>Loan</b><small>प्रशासक विभाग</small></span></Link>
        {admin && <div className="admin-welcome"><span>Welcome, Admin</span><div className="admin-account-wrap">
          <button className="admin-avatar-button" type="button" aria-label="प्रशासक खाते पर्याय" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}><ShieldCheck size={20} /></button>
          {isAccountMenuOpen && <div className="admin-account-menu"><button type="button" onClick={logout}><LogOut size={15} /> प्रशासक म्हणून लॉग आउट</button></div>}
        </div></div>}
      </header>

      {!admin ? <main className="admin-auth-area"><section className="admin-auth-panel">
        <button className="admin-close" type="button" aria-label="रद्द करा" title="रद्द करा" onClick={() => { window.location.href = '/' }}><X size={19} /></button>
        <p className="section-kicker">महाक्रॉप लोन / सुरक्षित प्रवेश</p>
        <h1>{mode === 'login' ? 'प्रशासक लॉग इन' : 'प्रशासक पासवर्ड रीसेट'}</h1>
        <p>{mode === 'login' ? 'अर्ज पाहण्यासाठी तुमच्या प्रशासक खात्यात प्रवेश करा.' : 'रिकव्हरी की वापरून नवीन प्रशासक पासवर्ड सेट करा.'}</p>
        <form className="admin-auth-form" onSubmit={submitAuth}>
          <label>वापरकर्तानाव<input name="username" autoComplete="username" required /></label>
          {mode === 'reset' && <PasswordField label="रिकव्हरी की" name="recoveryKey" autoComplete="off" required />}
          <PasswordField label={mode === 'login' ? 'पासवर्ड' : 'नवीन पासवर्ड'} name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? 'कृपया थांबा...' : mode === 'login' ? 'लॉग इन' : 'पासवर्ड बदला'}<ArrowRight size={17} /></button>
        </form>
        <button className="admin-forgot-link" type="button" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError('') }}>{mode === 'login' ? 'पासवर्ड विसरलात?' : 'लॉग इनकडे परत जा'}</button>
      </section></main> : <main className="admin-main">
        <div className="admin-dashboard-heading"><div><p className="section-kicker">अर्ज व्यवस्थापन</p><h1>कर्ज अर्ज <span>{applications.length.toString().padStart(2, '0')}</span></h1></div><div className="admin-pending"><span className="pending-dot" /> {pendingCount} प्रलंबित</div></div>
        <div className="admin-toolbar"><div className="admin-filters" role="group" aria-label="अर्ज फिल्टर">
          {[['all', 'सर्व'], ['pending', 'प्रक्रियेत'], ['forwarded', 'पुढे पाठवले'], ['returned', 'परत पाठवले']].map(([value, label]) => <button className={filter === value ? 'filter-active' : ''} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}
        </div><button className="admin-refresh" type="button" onClick={() => loadApplications().catch((loadError) => setError(loadError.message))}>रिफ्रेश <ArrowDown size={14} /></button></div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {shownApplications.length === 0 ? <div className="admin-empty"><ShieldCheck size={25} /><p>{applications.length ? 'या फिल्टरमध्ये अर्ज नाहीत.' : 'अद्याप कोणतेही कर्ज अर्ज प्राप्त झालेले नाहीत.'}</p></div> : <div className="admin-application-list">
          {shownApplications.map((application) => <article className="admin-application" key={application._id}>
            <header className="admin-app-card-head"><div><span className={`admin-loan-label ${application.loanType}`}>{application.loanType === 'crop-loan' ? 'पीक कर्ज' : 'ट्रॅक्टर कर्ज'}</span><h2>{application.fullName}</h2><span className="admin-application-number">अर्ज क्रमांक {application.applicationNumber || application._id}</span></div><span className={`application-status status-${application.status}`}>{workflowLabels[getWorkflowStage(application)] || 'अर्ज प्राप्त'}</span></header>
            <div className="admin-workflow-progress" aria-label="अर्ज प्रक्रिया">
              {[
                ['received', 'अर्ज उघडला'],
                ['verifying', 'पडताळणी सुरू'],
                ['verified', 'पडताळणी पूर्ण'],
                ['decision', 'पुढे पाठवा / परत पाठवा'],
              ].map(([stage, label], index) => {
                const stageOrder = ['submitted', 'received', 'verifying', 'verified', 'forwarded', 'returned']
                const currentStage = getWorkflowStage(application)
                const isDecision = stage === 'decision'
                const isComplete = isDecision
                  ? currentStage === 'forwarded'
                  : stageOrder.indexOf(currentStage) > stageOrder.indexOf(stage)
                const isCurrent = isDecision
                  ? ['forwarded', 'returned'].includes(currentStage)
                  : currentStage === stage
                return <span className={`${isComplete ? 'workflow-step-complete' : ''} ${isCurrent ? 'workflow-step-current' : ''}`} key={stage}>{index + 1}. {label}</span>
              })}
            </div>
            <div className="admin-app-details"><p><b>मोबाईल</b><span>{application.user?.mobileNumber || 'उपलब्ध नाही'}</span></p><p><b>गाव</b><span>{application.townVillage}</span></p><p><b>तालुका</b><span>{application.tehsilTaluka}</span></p><p><b>जिल्हा</b><span>{application.district}</span></p><p><b>राज्य</b><span>{application.state || 'महाराष्ट्र'}</span></p><p><b>सर्व्हे क्रमांक</b><span>{application.surveyNumber || 'उपलब्ध नाही'}</span></p>{application.aadharLastFour && <p><b>आधार (शेवटचे ४ अंक)</b><span>•••• {application.aadharLastFour}</span></p>}{application.panLastFour && <p><b>पॅन (शेवटची ४ अक्षरे)</b><span>•••• {application.panLastFour}</span></p>}{application.crop && <p><b>पीक / क्षेत्र</b><span>{application.crop} · {application.cropAreaHectares} हेक्टर</span></p>}{Number.isFinite(application.loanAmountPaise) && <p><b>कर्जास पात्र रक्कम</b><span>₹{(application.loanAmountPaise / 100).toLocaleString('en-IN')}</span></p>}<p><b>मुद्रांक शुल्क</b><span>{application.stampDutyPaise > 0 ? `₹${(application.stampDutyPaise / 100).toLocaleString('en-IN')}` : 'लागू नाही'}</span></p><p><b>अर्ज दिनांक</b><span>{new Date(application.createdAt).toLocaleString('mr-IN')}</span></p></div>
            <div className="admin-doc-list"><strong>जोडलेली कागदपत्रे</strong>{Object.entries(adminDocumentLabels)
              .filter(([key]) => !application.submissionDraftId || key !== 'boundaryMap')
              .map(([key, label]) => {
              const documentUrl = `${API_URL}/api/admin/applications/${application._id}/documents/${key}`
              return <div className="admin-doc-item" key={key}>
                <div className="admin-doc-name"><FileUp size={14} /><span>{label}</span><small>{application[key]?.originalName || 'फाइल नाही'}</small></div>
                {application[key] && <div className="admin-doc-actions"><a href={`${documentUrl}?view=1`} target="_blank" rel="noreferrer"><Eye size={13} /> इथे पहा</a><a href={documentUrl}><Download size={13} /> डाउनलोड</a></div>}
              </div>
            })}</div>
            {getWorkflowStage(application) === 'submitted' && <div className="admin-review-actions"><button className="approve-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'receive')}><Eye size={15} /> अर्ज प्राप्त करून उघडा</button></div>}
            {getWorkflowStage(application) === 'received' && <div className="admin-review-actions"><button className="approve-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'start-verification')}><FileUp size={15} /> पडताळणी सुरू करा</button></div>}
            {getWorkflowStage(application) === 'verifying' && <div className="admin-review-actions"><button className="approve-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'complete-verification')}><Check size={15} /> पडताळणी पूर्ण करा</button></div>}
            {getWorkflowStage(application) === 'verified' && <>
              <label className="admin-feedback-label">अर्ज परत पाठवण्याचे कारण (परत पाठवताना आवश्यक)<textarea rows="2" value={feedback[application._id] ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [application._id]: event.target.value }))} placeholder="कागदपत्रातील त्रुटी किंवा अर्ज परत पाठवण्याचे कारण लिहा" /></label>
              <div className="admin-review-actions"><button className="reject-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'return')}><X size={15} /> कारणासह परत पाठवा</button><button className="approve-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'forward')}><ArrowDown size={15} /> पुढील टप्प्यासाठी पाठवा</button></div>
            </>}
            {['forwarded', 'returned'].includes(getWorkflowStage(application)) && application.adminFeedback && <p className="existing-admin-feedback">परत पाठवण्याचे कारण: {application.adminFeedback}</p>}
          </article>)}
        </div>}
      </main>}
      <footer className="admin-footer">Mahacrop Loan · प्रशासक विभाग</footer>
    </div>
  )
}
