import { useEffect, useState } from 'react'
import { ArrowRight, ClipboardList, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { API_URL } from '../config/api'
import { adminDocumentLabels } from '../data/applicationData'
import { loanOptions } from '../data/loanOptions'
import LoanApplicationForm from '../components/LoanApplicationForm'

export default function MyApplicationsPage({ profile }) {
  const applicationId = new URLSearchParams(window.location.search).get('application')

  const [applications, setApplications] = useState([])
  const [editingApplication, setEditingApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadApplications() {
    const response = await fetch(`${API_URL}/api/applications/mine`, { credentials: 'include' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'अर्ज लोड करता आले नाहीत.')
    setApplications(result.applications)
  }

  useEffect(() => {
    let isCurrent = true
    fetch(`${API_URL}/api/applications/mine`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'अर्ज लोड करता आले नाहीत.')
        if (isCurrent) setApplications(result.applications)
      })
      .catch((loadError) => { if (isCurrent) setError(loadError.message) })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [])

  async function deleteApplication(application) {
    if (!window.confirm(`अर्ज ${application.applicationNumber} कायमचा काढून टाकायचा आहे का?`)) return
    setBusyId(application._id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API_URL}/api/applications/mine/${application._id}`, { method: 'DELETE', credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'अर्ज काढता आला नाही.')
      setApplications((current) => current.filter((item) => item._id !== application._id))
      setNotice(`अर्ज ${application.applicationNumber} काढून टाकला.`)
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusyId('')
    }
  }

  if (editingApplication) {
    const loan = loanOptions.find((item) => item.id === editingApplication.loanType)
    return <LoanApplicationForm
      loan={loan}
      profile={profile}
      application={editingApplication}
      onCancel={() => setEditingApplication(null)}
      onSaved={async (updatedApplication) => {
        setEditingApplication(null)
        setNotice(`अर्ज ${updatedApplication.applicationNumber} मधील बदल जतन केले.`)
        await loadApplications()
      }}
      onSessionExpired={() => setEditingApplication(null)}
    />
  }

  return (
    <section className="my-applications-page">
      <div className="my-applications-heading"><div><p className="section-kicker">तुमच्या खात्यातील</p><h1>माझे अर्ज</h1></div><Link to="/#loans" className="notification-back">कर्ज योजना <ArrowRight size={16} /></Link></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="application-notice" role="status">{notice}</p>}
      {loading ? <p className="my-applications-empty">तुमचे अर्ज लोड होत आहेत...</p> : applications.length === 0
        ? <div className="my-applications-empty"><ClipboardList size={25} /><p>तुम्ही अजून कोणताही अर्ज केलेला नाही.</p><Link to="/#loans">कर्ज योजना पाहा</Link></div>
        : <div className="my-application-list">{applications.map((application) => {
          const loan = loanOptions.find((item) => item.id === application.loanType)
          const canEdit = application.status === 'submitted' && application.loanType === 'crop-loan' && !application.submissionDraftId
          const canDelete = application.status === 'submitted'
          const workflowStage = application.workflowStage || ({
            approved: 'forwarded',
            rejected: 'returned',
            'under-review': 'verifying',
          }[application.status] || 'submitted')
          const statusLabel = {
            submitted: 'अर्ज जमा झाला',
            received: 'प्रशासकाने अर्ज उघडला',
            verifying: 'पडताळणी सुरू',
            verified: 'पडताळणी पूर्ण',
            forwarded: 'पुढील टप्प्यासाठी पाठवले',
            returned: 'दुरुस्तीसाठी परत पाठवले',
          }[workflowStage]
          // return <article className="my-application-card" key={application._id}>
            return <article
              className={`my-application-card ${
                applicationId === application._id
                  ? 'my-application-card-highlight'
                  : ''
              }`}
              key={application._id}
            >
            <header className="my-application-card-head"><div><p className="my-application-type">{loan?.title || (application.loanType === 'tractor-loan' ? 'ट्रॅक्टर कर्ज' : 'पीक कर्ज')}</p><h2>अर्ज क्रमांक {application.applicationNumber || application._id}</h2></div><span className={`application-status status-${application.status}`}>{statusLabel}</span></header>
            {application.workflowStage && <div className="applicant-workflow-stage" role="status">{statusLabel}</div>}
            <div className="my-application-details"><p><b>पूर्ण नाव</b><span>{application.fullName}</span></p><p><b>पत्ता</b><span>{[application.townVillage, application.tehsilTaluka, application.district, application.state || 'महाराष्ट्र'].join(', ')}</span></p><p><b>सर्व्हे क्रमांक</b><span>{application.surveyNumber || 'उपलब्ध नाही'}</span></p>{application.crop && <p><b>पीक / क्षेत्र</b><span>{application.crop} · {application.cropAreaHectares} हेक्टर</span></p>}{Number.isFinite(application.loanAmountPaise) && <p><b>पात्र कर्ज रक्कम</b><span>₹{(application.loanAmountPaise / 100).toLocaleString('en-IN')}</span></p>}<p><b>अर्जाची तारीख</b><span>{new Date(application.createdAt).toLocaleDateString('mr-IN')}</span></p></div>
            <div className="my-application-documents"><b>जोडलेली कागदपत्रे</b><div>{Object.entries(adminDocumentLabels)
              .filter(([field]) => !application.submissionDraftId || field !== 'boundaryMap')
              .map(([field, label]) => <span key={field}>{label}: {application[field]?.originalName || 'उपलब्ध नाही'}</span>)}</div></div>
            {application.adminFeedback && <p className="my-application-feedback">प्रशासकाची नोंद: {application.adminFeedback}</p>}
            {(canEdit || canDelete) && <div className="my-application-actions">{canEdit && <button type="button" onClick={() => setEditingApplication(application)}><Pencil size={15} /> अर्ज बदला</button>}{canDelete && <button className="my-application-delete" type="button" disabled={busyId === application._id} onClick={() => deleteApplication(application)}><Trash2 size={15} /> {busyId === application._id ? 'काढत आहे...' : 'अर्ज काढा'}</button>}</div>}
          </article>
        })}</div>}
    </section>
  )
}
