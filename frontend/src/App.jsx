import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Bell, Camera, Check, ChevronDown, Download, Eye, EyeOff, FileUp, Leaf, LogOut, Menu, ShieldCheck, Tractor, UserRound, Wheat, X } from 'lucide-react'
import { BrowserRouter, Link, useLocation, useNavigate } from 'react-router-dom'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || ''
const loanOptions = [
  {
    id: 'crop-loan',
    number: '०१',
    title: 'पीक कर्ज',
    englishTitle: 'CROP LOAN',
    description: 'बियाणे, खते आणि शेतीच्या हंगामी गरजांसाठी वेळेवर आर्थिक मदत.',
    image: '/crop-loan.jpg',
    icon: Wheat,
    tone: 'green',
  },
  {
    id: 'tractor-loan',
    number: '०२',
    title: 'ट्रॅक्टर कर्ज',
    englishTitle: 'TRACTOR LOAN',
    description: 'आधुनिक यंत्रसामग्रीसह तुमच्या शेतीला द्या पुढे जाण्याची नवी ताकद.',
    image: '/tractor.png',
    icon: Tractor,
    tone: 'ochre',
  },
]

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [modalMode, setModalMode] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [pendingApplication, setPendingApplication] = useState(null)
  const authRevision = useRef(0)
  const lastActivityRefresh = useRef(0)
  const activeLoan = loanOptions.find((loan) => location.pathname === `/${loan.id}` || location.pathname === `/${loan.id}/apply`)
  const isApplicationRoute = activeLoan && location.pathname === `/${activeLoan.id}/apply`

  useEffect(() => {
    let isCurrent = true
    const requestRevision = authRevision.current
    fetch(`${API_URL}/api/auth/session`, { credentials: 'include' })
      .then((response) => response.json())
      .then((result) => {
        if (!isCurrent || authRevision.current !== requestRevision) return
        setProfile(result.user)
        const requestedLoan = loanOptions.find((loan) => location.pathname === `/${loan.id}/apply`)
        if (requestedLoan && !result.user) {
          setPendingApplication(location.pathname)
          setModalMode('login')
          navigate(`/${requestedLoan.id}`, { replace: true })
        } else if (location.pathname === '/notification' && !result.user) {
          setPendingApplication('/notification')
          setModalMode('login')
          navigate('/', { replace: true })
        }
      })
      .catch(() => { if (isCurrent && authRevision.current === requestRevision) setProfile(null) })
      .finally(() => { if (isCurrent && authRevision.current === requestRevision) setIsAuthLoading(false) })
    return () => { isCurrent = false }
  }, [location.pathname, navigate])

  useEffect(() => {
    if (!profile) return undefined
    const refreshForActivity = () => {
      if (Date.now() - lastActivityRefresh.current < 60 * 60 * 1000) return
      lastActivityRefresh.current = Date.now()
      const requestRevision = authRevision.current
      fetch(`${API_URL}/api/auth/session`, { credentials: 'include' })
        .then((response) => response.json())
        .then((result) => {
          if (authRevision.current !== requestRevision) return
          setProfile(result.user)
          if (!result.user && activeLoan && location.pathname === `/${activeLoan.id}/apply`) {
            setPendingApplication(location.pathname)
            setModalMode('login')
            navigate(`/${activeLoan.id}`, { replace: true })
          }
        })
        .catch(() => {})
    }
    window.addEventListener('pointerdown', refreshForActivity)
    window.addEventListener('keydown', refreshForActivity)
    return () => {
      window.removeEventListener('pointerdown', refreshForActivity)
      window.removeEventListener('keydown', refreshForActivity)
    }
  }, [activeLoan, location.pathname, navigate, profile])

  useEffect(() => {
    if (!profile) return undefined
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications`, { credentials: 'include' })
        if (!response.ok) return
        const result = await response.json()
        if (location.pathname === '/notification') {
          const readResponse = await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PATCH', credentials: 'include' })
          if (readResponse.ok) {
            const readAt = new Date().toISOString()
            setNotifications(result.notifications.map((notification) => ({ ...notification, readAt: notification.readAt || readAt })))
            return
          }
        }
        setNotifications(result.notifications)
      } catch {
        setNotifications([])
      }
    }
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(timer)
  }, [location.pathname, profile])

  async function handleLogout() {
    authRevision.current += 1
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setProfile(null)
    setIsAuthLoading(false)
    setIsMenuOpen(false)
    setModalMode('login')
  }

  if (location.pathname === '/admin') return <AdminPortal />

  function openLogin() {
    setIsMenuOpen(false)
    setModalMode('login')
  }

  function startApplication(loan) {
    const applicationPath = `/${loan.id}/apply`
    if (profile) navigate(applicationPath)
    else {
      setPendingApplication(applicationPath)
      setModalMode('login')
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <nav className="nav-wrap flex items-center justify-between" aria-label="मुख्य नेव्हिगेशन">
          <a className="brand" href="/#home" aria-label="महाक्रॉप लोन मुख्यपृष्ठ">
            <img src="/mahacrop.png" alt="महाक्रॉप लोन लोगो" />
            <span className="brand-name">Mahacrop <b>Loan</b><small>शेतकऱ्यांच्या प्रगतीची साथ</small></span>
          </a>
          <button className="mobile-menu-button" type="button" aria-label="नेव्हिगेशन उघडा" onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}>
            {isMobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className={`nav-links ${isMobileNavOpen ? 'nav-links-open' : ''}`}>
            <a href="/#about" onClick={() => setIsMobileNavOpen(false)}>मुख्यपृष्ठ</a>
            <a href="/#loans" onClick={() => setIsMobileNavOpen(false)}>कर्ज योजना</a>
            <a className="nav-contact" href="/#loans" onClick={() => setIsMobileNavOpen(false)}>योजना पाहा <ArrowRight size={15} /></a>
          </div>
          {profile && <div className="notifications-wrap">
            <Link className="notification-button" to="/notification" aria-label={`सूचना, ${notifications.filter((item) => !item.readAt).length} न वाचलेल्या`}>
              <Bell size={19} />
              {notifications.some((item) => !item.readAt) && <span className="notification-count">{notifications.filter((item) => !item.readAt).length}</span>}
            </Link>
          </div>}
          <div className="account-wrap">
            <button className="account-button" type="button" aria-label="खाते पर्याय" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <UserRound size={19} strokeWidth={1.8} /><span className="account-label">खाते</span><ChevronDown size={14} className={isMenuOpen ? 'chevron-up' : ''} />
            </button>
            {isMenuOpen && <div className="account-menu">
              {profile ? <p className="account-greeting">नमस्कार, {profile.fullName}</p> : null}
              {profile && <button type="button" onClick={() => { setIsMenuOpen(false); setModalMode('setRecovery') }}>पुनर्प्राप्ती वाक्य सेट करा</button>}
              {profile ? <button type="button" onClick={handleLogout}>लॉग आउट</button> : <button type="button" onClick={openLogin}>लॉग इन</button>}
            </div>}
          </div>
        </nav>
      </header>

      <main>
        {location.pathname === '/notification' ? isAuthLoading
          ? <section className="notification-page"><p className="login-description">सूचना लोड होत आहेत...</p></section>
          : <section className="notification-page">
            <div className="notification-page-heading"><div><p className="section-kicker">तुमच्या खात्यातील</p><h1>सूचना</h1></div><Link to="/#home" className="notification-back">मुख्यपृष्ठाकडे <ArrowRight size={16} /></Link></div>
            {notifications.length === 0 ? <div className="notification-page-empty"><Bell size={24} /><p>सध्या कोणतीही सूचना नाही.</p></div> : <div className="notification-page-list">
              {notifications.map((notification) => <article className="notification-page-item" key={notification._id}>
                <span className={`notification-state notification-state-${notification.type}`}><Check size={16} /></span>
                <div><p>{notification.message}</p><small>{notification.loanType === 'crop-loan' ? 'पीक कर्ज' : 'ट्रॅक्टर कर्ज'} · {new Date(notification.createdAt).toLocaleString('mr-IN')}</small></div>
                <span className="notification-read-label">वाचले</span>
              </article>)}
            </div>}
          </section>
          : activeLoan ? isAuthLoading && isApplicationRoute
          ? <section className="loan-detail"><p className="login-description">तुमचे लॉग इन तपासत आहोत...</p></section>
          : isApplicationRoute && profile
          ? <LoanApplicationForm
            loan={activeLoan}
            profile={profile}
            onCancel={() => navigate(`/${activeLoan.id}`)}
            onSessionExpired={() => {
              const applyPath = `/${activeLoan.id}/apply`
              setProfile(null)
              setPendingApplication(applyPath)
              setModalMode('login')
              navigate(`/${activeLoan.id}`, { replace: true })
            }}
          />
          : <LoanDetail loan={activeLoan} onApply={() => startApplication(activeLoan)} /> : <>
        <section className="hero-section" id="home">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" />शेतीच्या स्वप्नांना आर्थिक बळ</div>
            <h1>तुमच्या कष्टांना<br /><em>प्रगतीची साथ.</em></h1>
            <p className="hero-description">शेतीच्या प्रत्येक टप्प्यावर, योग्य कर्जाची सोपी साथ. तुमच्या गावातूनच सुरू करा प्रगतीचा नवा प्रवास.</p>
            <a href="#loans" className="primary-link">कर्ज योजना पाहा <ArrowRight size={17} /></a>
            <div className="hero-note"><span className="note-icon"><Leaf size={16} /></span><span>महाराष्ट्रातील शेतकऱ्यांसाठी<br /><strong>विश्वासाची नवी वाट</strong></span></div>
          </div>
          <div className="hero-visual">
            <img src="/farm.jpg" alt="हिरव्यागार शेतात उभे असलेले पीक" />
            <div className="image-caption"><span>मातीशी नातं, प्रगतीशी साथ</span><span className="caption-dash" /></div>
            <div className="hero-stamp"><span>शेती</span><Leaf size={20} /><span>समृद्धी</span></div>
          </div>
          <a className="scroll-cue" href="#about"><span>खाली स्क्रोल करा</span><ArrowDown size={15} /></a>
        </section>

        <section className="about-section" id="about">
          <div className="section-index"><span>०१</span><i /></div>
          <div className="about-heading"><p className="section-kicker">तुमच्या शेतीसाठी</p><h2>सोपं कर्ज.<br /><em>मोठी स्वप्नं.</em></h2></div>
          <div className="about-content">
            <p>महाक्रॉप लोन हे शेतकऱ्यांना त्यांच्या गरजेनुसार कर्ज योजनांची माहिती आणि अर्जाची सोपी सुरुवात करून देणारे व्यासपीठ आहे. तुमच्या शेतीचा पुढचा टप्पा आता अधिक सहजतेने गाठा.</p>
            <div className="about-signoff"><span className="signoff-mark"><Leaf size={17} /></span><span>शेतकऱ्यांसाठी, शेतकऱ्यांच्या प्रगतीसाठी</span></div>
          </div>
          <div className="about-watermark" aria-hidden="true">माती</div>
        </section>

        <section className="loans-section" id="loans">
          <div className="loans-topline"><div><p className="section-kicker">तुमची गरज, आमची साथ</p><h2>तुमच्यासाठीच्या <em>कर्ज योजना</em></h2></div><p className="loans-intro">योग्य वेळी योग्य मदत.<br />तुमच्या शेतीला पुढे नेणारे पर्याय.</p></div>
          <div className="loan-grid grid">
            {loanOptions.map(({ id, number, title, englishTitle, description, image, icon: Icon, tone }) => (
              <Link className={`loan-card loan-card-${tone}`} key={id} to={`/${id}`} aria-label={`${title} योजनेची माहिती`}>
                <div className="loan-photo"><img src={image} alt={title === 'पीक कर्ज' ? 'शेतातील हिरवे पीक' : 'शेतात काम करणारा ट्रॅक्टर'} loading="lazy" /><span className="loan-number">{number}</span><span className="loan-icon"><Icon size={22} strokeWidth={1.6} /></span></div>
                <div className="loan-info"><p className="loan-type">{englishTitle}</p><h3>{title}</h3><p className="loan-description">{description}</p><span className="loan-action">योजनेची माहिती <ArrowRight size={17} /></span></div>
              </Link>
            ))}
          </div>
          <div className="loan-footnote"><span className="footnote-icon"><Check size={14} /></span> तुमची माहिती सुरक्षितपणे जतन केली जाते <span className="footnote-rule" /></div>
        </section>

        <section className="closing-band"><div className="closing-leaf"><Leaf size={27} strokeWidth={1.3} /></div><p>आजची छोटी पायरी, उद्याची <em>समृद्ध शेती.</em></p><a href="/#loans" aria-label="कर्ज योजना पाहा"><ArrowRight size={20} /></a></section>
        </>}
      </main>

      <footer className="site-footer flex items-center justify-between">
        <a className="footer-brand" href="/#home"><img src="/mahacrop.png" alt="" /><span>Mahacrop <b>Loan</b></span></a>
        <p>© {new Date().getFullYear()} All rights reserved © Rohan Anantrao Sabnis</p>
        <a href="/#home" className="back-to-top">वर जा <ArrowDown size={14} /></a>
      </footer>

      {modalMode && <AuthModal
        mode={modalMode}
        onModeChange={setModalMode}
        onClose={() => { setModalMode(null); setPendingApplication(null) }}
        onAuthenticated={(user) => {
          authRevision.current += 1
          setProfile(user)
          setIsAuthLoading(false)
          setModalMode(null)
          if (pendingApplication) navigate(pendingApplication)
          setPendingApplication(null)
        }}
        onRecoveryPhraseSaved={() => setModalMode(null)}
      />}
    </div>
  )
}

const adminDocumentLabels = {
  identityProof: 'ओळख व पत्ता पुरावा',
  landRecord712: '७/१२ उतारा',
  landRecord8a: '८-अ उतारा',
  mutationRecord: 'फेरफार उतारा',
  boundaryMap: 'सीमांकन नकाशा',
}

function AdminPortal() {
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

  async function reviewApplication(application, decision) {
    const reason = feedback[application._id] || ''
    if (decision === 'rejected' && !reason.trim()) {
      setError(`“${application.fullName}” यांच्या अर्जासाठी नकाराचे कारण लिहा.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/applications/${application._id}/review`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
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

  const shownApplications = applications.filter((application) => filter === 'all' || application.status === filter)
  const pendingCount = applications.filter((application) => application.status === 'submitted').length

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
          {[['all', 'सर्व'], ['submitted', 'प्रलंबित'], ['approved', 'मंजूर'], ['rejected', 'नाकारले']].map(([value, label]) => <button className={filter === value ? 'filter-active' : ''} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}
        </div><button className="admin-refresh" type="button" onClick={() => loadApplications().catch((loadError) => setError(loadError.message))}>रिफ्रेश <ArrowDown size={14} /></button></div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {shownApplications.length === 0 ? <div className="admin-empty"><ShieldCheck size={25} /><p>{applications.length ? 'या फिल्टरमध्ये अर्ज नाहीत.' : 'अद्याप कोणतेही कर्ज अर्ज प्राप्त झालेले नाहीत.'}</p></div> : <div className="admin-application-list">
          {shownApplications.map((application) => <article className="admin-application" key={application._id}>
            <header className="admin-app-card-head"><div><span className={`admin-loan-label ${application.loanType}`}>{application.loanType === 'crop-loan' ? 'पीक कर्ज' : 'ट्रॅक्टर कर्ज'}</span><h2>{application.fullName}</h2></div><span className={`application-status status-${application.status}`}>{application.status === 'submitted' ? 'प्रलंबित' : application.status === 'approved' ? 'मंजूर' : application.status === 'rejected' ? 'नाकारले' : 'तपासणी सुरू'}</span></header>
            <div className="admin-app-details"><p><b>मोबाईल</b><span>{application.user?.mobileNumber || 'उपलब्ध नाही'}</span></p><p><b>गाव / शहर</b><span>{application.townVillage}</span></p><p><b>तालुका</b><span>{application.tehsilTaluka}</span></p><p><b>जिल्हा</b><span>{application.district}</span></p><p><b>अर्ज दिनांक</b><span>{new Date(application.createdAt).toLocaleString('mr-IN')}</span></p></div>
            <div className="admin-doc-list"><strong>जोडलेली कागदपत्रे</strong>{Object.entries(adminDocumentLabels).map(([key, label]) => {
              const documentUrl = `${API_URL}/api/admin/applications/${application._id}/documents/${key}`
              return <div className="admin-doc-item" key={key}>
                <div className="admin-doc-name"><FileUp size={14} /><span>{label}</span><small>{application[key]?.originalName || 'फाइल नाही'}</small></div>
                {application[key] && <div className="admin-doc-actions"><a href={`${documentUrl}?view=1`} target="_blank" rel="noreferrer"><Eye size={13} /> इथे पहा</a><a href={documentUrl}><Download size={13} /> डाउनलोड</a></div>}
              </div>
            })}</div>
            {application.status === 'submitted' ? <>
              <label className="admin-feedback-label">नोंद / नकाराचे कारण<textarea rows="2" value={feedback[application._id] ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [application._id]: event.target.value }))} placeholder="नकारासाठी कारण लिहा; मंजुरीसाठी ऐच्छिक नोंद" /></label>
              <div className="admin-review-actions"><button className="reject-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'rejected')}><X size={15} /> अर्ज नाकारा</button><button className="approve-button" type="button" disabled={busy} onClick={() => reviewApplication(application, 'approved')}><Check size={15} /> अर्ज मंजूर करा</button></div>
            </> : application.adminFeedback && <p className="existing-admin-feedback">प्रशासकाची नोंद: {application.adminFeedback}</p>}
          </article>)}
        </div>}
      </main>}
      <footer className="admin-footer">Mahacrop Loan · प्रशासक विभाग</footer>
    </div>
  )
}

function PasswordField({ label, name, autoComplete, minLength, required = false }) {
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

function AuthModal({ mode, onModeChange, onClose, onAuthenticated, onRecoveryPhraseSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')

  async function postJson(path, data, method = 'POST') {
    const response = await fetch(`${API_URL}/api/${path}`, {
      method,
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

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    data.mobileNumber = (data.mobileNumber || mobileNumber).replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
    try {
      if (mode === 'login' || mode === 'register') {
        const result = await postJson(`auth/${mode}`, data)
        onAuthenticated(result.user)
      } else if (mode === 'setRecovery') {
        const result = await postJson('auth/recovery-phrase', data, 'PATCH')
        setNotice(result.message)
        onRecoveryPhraseSaved()
      } else {
        await postJson('auth/reset-password', data)
        setNotice('पासवर्ड बदलला. आता नवीन पासवर्डने लॉग इन करा.')
        onModeChange('login')
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'register' ? 'खाते तयार करा' : mode === 'forgot' ? 'नवीन पासवर्ड सेट करा' : mode === 'setRecovery' ? 'पुनर्प्राप्ती वाक्य सेट करा' : 'लॉग इन करा'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="login-panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" aria-label="फॉर्म रद्द करा" onClick={onClose}><X size={19} /></button>
        <div className="login-mark"><img src="/mahacrop.png" alt="" /></div>
        <p className="login-kicker">महाक्रॉप लोन</p>
        <h2 id="auth-title">{title}</h2>
        <p className="login-description">{mode === 'login' ? 'तुमच्या खात्यात लॉग इन करा.' : mode === 'register' ? 'नवीन खाते तयार करण्यासाठी तपशील भरा.' : mode === 'forgot' ? 'नोंदणीच्या वेळी निवडलेले खासगी वाक्य वापरून पासवर्ड बदला.' : 'सध्याचा पासवर्ड पडताळून खासगी पुनर्प्राप्ती वाक्य सेट करा.'}</p>
        <form className="login-form" onSubmit={submit}>
          {mode === 'register' && <>
            <label>पूर्ण नाव<input name="fullName" autoComplete="name" required minLength="2" /></label>
            <div className="location-fields"><label>गाव / शहर<input name="townVillage" required /></label><label>तालुका<input name="tehsilTaluka" required /></label></div>
            <label>जिल्हा<input name="district" required /></label>
          </>}
          {mode !== 'setRecovery' && <label>मोबाईल क्रमांक<input name="mobileNumber" type="tel" inputMode="numeric" autoComplete="tel" placeholder="१० अंकी मोबाईल क्रमांक" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} maxLength="10" required /></label>}
          {(mode === 'login' || mode === 'register') && <PasswordField label="पासवर्ड" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />}
          {(mode === 'register' || mode === 'forgot') && <PasswordField label={mode === 'register' ? 'खासगी पुनर्प्राप्ती वाक्य' : 'पुनर्प्राप्ती वाक्य'} name="recoveryPhrase" autoComplete="off" minLength={8} required />}
          {mode === 'setRecovery' && <>
            <PasswordField label="सध्याचा पासवर्ड" name="currentPassword" autoComplete="current-password" required />
            <PasswordField label="खासगी पुनर्प्राप्ती वाक्य" name="recoveryPhrase" autoComplete="off" minLength={8} required />
          </>}
          {(mode === 'register' || mode === 'setRecovery') && <p className="recovery-note">हे खासगी वाक्य सुरक्षित ठेवा. पासवर्ड विसरल्यास याच वाक्याने तो बदलता येईल.</p>}
          {mode === 'forgot' && <PasswordField label="नवीन पासवर्ड" name="password" autoComplete="new-password" minLength={8} required />}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? 'कृपया थांबा...' : mode === 'login' ? 'लॉग इन' : mode === 'register' ? 'खाते तयार करा' : mode === 'setRecovery' ? 'वाक्य जतन करा' : 'पासवर्ड बदला'}<ArrowRight size={17} /></button>
        </form>
        <div className="auth-links">
          {mode === 'login' && <><button type="button" onClick={() => onModeChange('forgot')}>पासवर्ड विसरलात?</button><button type="button" onClick={() => onModeChange('register')}>नवीन खाते तयार करा</button></>}
          {mode === 'register' && <button type="button" onClick={() => onModeChange('login')}>आधीच खाते आहे? लॉग इन करा</button>}
          {mode === 'forgot' && <button type="button" onClick={() => onModeChange('login')}>लॉग इनकडे परत जा</button>}
        </div>
      </section>
    </div>
  )
}

const applicationDocuments = [
  { name: 'identityProof', title: 'ओळख व पत्त्याचा पुरावा', detail: 'आधार कार्ड / पॅन कार्ड / मतदार ओळखपत्र / ड्रायव्हिंग लायसन्स' },
  { name: 'landRecord712', title: '७/१२ उतारा', detail: '७/१२ एक्स्ट्रॅक्ट' },
  { name: 'landRecord8a', title: '८-अ उतारा', detail: '८-अ एक्स्ट्रॅक्ट' },
  { name: 'mutationRecord', title: 'फेरफार उतारा', detail: 'म्युटेशन रेकॉर्ड' },
  { name: 'boundaryMap', title: 'शेताचा सीमांकन नकाशा', detail: 'शेताच्या चारही बाजूंच्या सीमा दाखवणारा नकाशा' },
]

function LoanApplicationForm({ loan, profile, onCancel, onSessionExpired }) {
  const [files, setFiles] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputs = useRef({})

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (applicationDocuments.some((document) => !files[document.name])) {
      setError('कृपया सर्व आवश्यक कागदपत्रे अपलोड करा किंवा फोटो काढा.')
      return
    }
    setBusy(true)
    const formData = new FormData(event.currentTarget)
    formData.set('loanType', loan.id)
    applicationDocuments.forEach(({ name }) => formData.set(name, files[name]))
    try {
      const response = await fetch(`${API_URL}/api/applications`, { method: 'POST', credentials: 'include', body: formData })
      const result = await response.json()
      if (response.status === 401) {
        onSessionExpired()
        return
      }
      if (!response.ok) throw new Error(result.message || 'अर्ज जमा करता आला नाही.')
      setSuccess(result.message)
      setFiles({})
    } catch (submitError) {
      setError(submitError.message || 'सर्व्हरशी संपर्क होऊ शकला नाही.')
    } finally {
      setBusy(false)
    }
  }

  function chooseFile(name, file) {
    if (file) setFiles((current) => ({ ...current, [name]: file }))
  }

  function clearFile(name) {
    setFiles((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    if (inputs.current[name]) inputs.current[name].value = ''
    if (inputs.current[`${name}-camera`]) inputs.current[`${name}-camera`].value = ''
  }

  return (
    <section className="application-section">
      <div className="application-heading">
        <div><Link to={`/${loan.id}`} className="detail-back"><ArrowDown size={15} /> मागे जा</Link><p className="section-kicker">{loan.englishTitle}</p><h1>{loan.title} <em>अर्ज</em></h1></div>
        <button className="application-close" type="button" aria-label="अर्ज रद्द करा" title="अर्ज रद्द करा" onClick={onCancel}><X size={21} /></button>
      </div>
      {success ? <div className="application-success"><span><Check size={22} /></span><h2>{success}</h2><p>लॉग इन सत्र सात दिवसांच्या निष्क्रियतेनंतर संपेल.</p><button className="submit-button" type="button" onClick={onCancel}>मुख्य योजनेकडे जा <ArrowRight size={17} /></button></div> : <form className="application-form" onSubmit={submit}>
        <div className="application-personal">
          <label>पूर्ण नाव<input name="fullName" defaultValue={profile.fullName} required /></label>
          <div className="application-address"><p>पत्ता</p><label>गाव / शहर<input name="townVillage" defaultValue={profile.townVillage} required /></label><label>तालुका<input name="tehsilTaluka" defaultValue={profile.tehsilTaluka} required /></label><label>जिल्हा<input name="district" defaultValue={profile.district} required /></label></div>
        </div>
        <div className="application-documents">
          {applicationDocuments.map(({ name, title, detail }, index) => (
            <article className={`document-row ${files[name] ? 'document-selected' : ''}`} key={name}>
              <div className="document-copy"><span className="document-index">०{index + 1}</span><div><h2>{title}</h2><p>{detail}</p>{files[name] && <span className="document-filename">{files[name].name}</span>}</div></div>
              <div className="document-controls">
                <input ref={(node) => { inputs.current[name] = node }} className="visually-hidden-file" type="file" accept="image/*,application/pdf" onChange={(event) => chooseFile(name, event.target.files?.[0])} />
                <input ref={(node) => { inputs.current[`${name}-camera`] = node }} className="visually-hidden-file" type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(name, event.target.files?.[0])} />
                <button type="button" aria-label={`${title} अपलोड करा`} title="फाइल किंवा फोटो अपलोड करा" onClick={() => inputs.current[name]?.click()}><FileUp size={17} /></button>
                <button type="button" aria-label={`${title} चा फोटो काढा`} title="कॅमेऱ्याने फोटो काढा" onClick={() => inputs.current[`${name}-camera`]?.click()}><Camera size={17} /></button>
                {files[name] && <button className="document-remove" type="button" aria-label={`${title} काढून टाका`} title="निवडलेली फाइल काढून टाका" onClick={() => clearFile(name)}><X size={17} /></button>}
              </div>
            </article>
          ))}
        </div>
        {error && <p className="form-error application-error" role="alert">{error}</p>}
        <div className="application-actions"><button className="application-cancel" type="button" onClick={onCancel}><X size={16} /> रद्द करा</button><button className="submit-button" type="submit" disabled={busy}>{busy ? 'अर्ज जमा होत आहे...' : 'अर्ज जमा करा'}<ArrowRight size={17} /></button></div>
        <p className="upload-note">प्रत्येक कागदपत्रासाठी JPG, PNG, WEBP किंवा PDF फाइल (कमाल १० MB) जोडा.</p>
      </form>}
    </section>
  )
}

function LoanDetail({ loan, onApply }) {
  const LoanIcon = loan.icon

  return (
    <section className={`loan-detail loan-detail-${loan.tone}`}>
      <div className="loan-detail-topline"><Link to="/#loans" className="detail-back"><ArrowDown size={15} /> सर्व कर्ज योजना</Link><span>{loan.number} / ०२</span></div>
      <div className="loan-detail-layout">
        <div className="loan-detail-copy">
          <p className="section-kicker">{loan.englishTitle}</p>
          <h1>{loan.title}<br /><em>तुमच्या शेतीसाठी.</em></h1>
          <p className="loan-detail-description">{loan.description} महाक्रॉप लोनच्या माध्यमातून तुमच्या गरजेसाठी योग्य पर्यायाची माहिती मिळवा आणि अर्जाची सुरुवात करा.</p>
          <div className="detail-benefit"><span><Check size={15} /></span><p>सोप्या पद्धतीने अर्जाची सुरुवात<br /><small>तुमची मूलभूत माहिती भरून पुढील प्रक्रियेसाठी संपर्काची विनंती करा.</small></p></div>
          <button className="primary-link" type="button" onClick={onApply}>अर्ज सुरू करा <ArrowRight size={17} /></button>
        </div>
        <div className={`loan-detail-image ${loan.tone === 'ochre' ? 'tractor-detail-image' : ''}`}>
          <img src={loan.image} alt={loan.title} />
          <span><LoanIcon size={20} /> {loan.title}</span>
        </div>
      </div>
      <div className="loan-detail-foot"><Leaf size={16} /><span>शेतकऱ्यांच्या प्रगतीची साथ</span><span className="detail-foot-rule" /></div>
    </section>
  )
}

function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

export default App
