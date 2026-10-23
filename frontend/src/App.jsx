import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Bell, Check, ChevronDown, ClipboardList, Eye, FileUp, Leaf, Menu, UserRound, X } from 'lucide-react'
import { BrowserRouter, Link, useLocation, useNavigate } from 'react-router-dom'
import { API_URL } from './config/api'
import AuthModal from './components/AuthModal'
import LoanApplicationForm from './components/LoanApplicationForm'
import LoanDetail from './components/LoanDetail'
import AdminPortal from './pages/AdminPortal'
import MyApplicationsPage from './pages/MyApplicationsPage'
import { loanOptions } from './data/loanOptions'
import './App.css'

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
  const submissionRedirectTimeout = useRef(null)
  const activeLoan = loanOptions.find((loan) => location.pathname === `/${loan.id}` || location.pathname === `/${loan.id}/apply`)
  const isApplicationRoute = activeLoan && location.pathname === `/${activeLoan.id}/apply`

  useEffect(() => () => {
    if (submissionRedirectTimeout.current) window.clearTimeout(submissionRedirectTimeout.current)
  }, [location.pathname])

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
        } else if (location.pathname === '/my-applications' && !result.user) {
          setPendingApplication('/my-applications')
          setModalMode('login')
          navigate('/', { replace: true })
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
              {profile && <button type="button" onClick={() => { setIsMenuOpen(false); navigate('/my-applications') }}><ClipboardList size={15} /> माझे अर्ज</button>}
              {profile ? <button type="button" onClick={handleLogout}>लॉग आउट</button> : <button type="button" onClick={openLogin}>लॉग इन</button>}
            </div>}
          </div>
        </nav>
      </header>

      <main>
        {location.pathname === '/my-applications' ? isAuthLoading
          ? <section className="my-applications-page"><p className="login-description">अर्ज तपासत आहोत...</p></section>
          : profile ? <MyApplicationsPage profile={profile} /> : null
          : location.pathname === '/notification' ? isAuthLoading
          ? <section className="notification-page"><p className="login-description">सूचना लोड होत आहेत...</p></section>
          : <section className="notification-page">
            <div className="notification-page-heading"><div><p className="section-kicker">तुमच्या खात्यातील</p><h1>सूचना</h1></div><Link to="/#home" className="notification-back">मुख्यपृष्ठाकडे <ArrowRight size={16} /></Link></div>
            {notifications.length === 0 ? <div className="notification-page-empty"><Bell size={24} /><p>सध्या कोणतीही सूचना नाही.</p></div> : <div className="notification-page-list">
              {notifications.map((notification) => <Link
                className="notification-page-item"
                to={`/my-applications?application=${notification.application}`}
                key={notification._id}
              >
                <span className={`notification-state notification-state-${notification.workflowStage || notification.type}`}>
                  {(notification.workflowStage || notification.type) === 'submitted'
                    ? <ClipboardList size={16} />
                    : (notification.workflowStage || notification.type) === 'received'
                      ? <Eye size={16} />
                      : (notification.workflowStage || notification.type) === 'verifying'
                        ? <FileUp size={16} />
                        : ['verified', 'forwarded', 'approved'].includes(notification.workflowStage || notification.type)
                      ? <Check size={16} />
                      : <X size={16} />}
                </span>
                <div>
                  <p className="notification-application-number">
                    अर्ज क्रमांक: <strong>{notification.applicationNumber}</strong>
                  </p>
                  <p>{notification.message}</p>
                  <small>
                    {notification.loanType === 'crop-loan' ? 'पीक कर्ज' : 'ट्रॅक्टर कर्ज'}
                    {' · '}
                    {new Date(notification.createdAt).toLocaleString('mr-IN')}
                  </small>
                </div>
                <span className="notification-read-label">पहा</span>
              </Link>)}
            </div>}
          </section>
          : activeLoan ? isAuthLoading && isApplicationRoute
          ? <section className="loan-detail"><p className="login-description">तुमचे लॉग इन तपासत आहोत...</p></section>
          : isApplicationRoute && profile
          ? <LoanApplicationForm
            loan={activeLoan}
            profile={profile}
            onSubmitted={(result) => {
              if (result.notification) {
                setNotifications((current) => [
                  result.notification,
                  ...current.filter((item) => item._id !== result.notification._id),
                ])
              }
              submissionRedirectTimeout.current = window.setTimeout(() => {
                submissionRedirectTimeout.current = null
                navigate('/#home')
              }, 3000)
            }}
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
            <img src="/farm.jpg" alt="शेतात उभे असलेले पीक" />
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
        onClose={() => { setModalMode(null); setPendingApplication(null) }}
        onAuthenticated={(user) => {
          authRevision.current += 1
          setProfile(user)
          setIsAuthLoading(false)
          setModalMode(null)
          if (pendingApplication) navigate(pendingApplication)
          setPendingApplication(null)
        }}
      />}
    </div>
  )
}
function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

export default App
