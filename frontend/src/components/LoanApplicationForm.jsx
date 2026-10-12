import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { API_URL } from '../config/api'
import eightAPdf from '../assets/8-A.pdf'
import aadharCardPdf from '../assets/aadhar.pdf'
import mutationPdf from '../assets/mutation.pdf'
import panCardPdf from '../assets/pan.pdf'
import satbaraPdf from '../assets/Satbara.pdf'

const locationAliases = {
  district: {
    Ahilyanagar: ['Ahmadnagar', 'Ahmednagar'],
    Beed: ['Bid'],
    'Chhatrapati Sambhajinagar': ['Aurangabad'],
    Dharashiv: ['Osmanabad'],
    Gondia: ['Gondiya'],
    'Mumbai City': ['Mumbai'],
    Raigad: ['Raigarh'],
  },
  taluka: {
    Rahata: ['Rahta'],
    Wada: ['Vada'],
  },
}

const pageTitles = ['ओळख व बँक तपशील', 'CIBIL व जमीन', 'पीक व कर्ज रक्कम', 'अटी व शर्ती', 'Stamp Duty Fees']
const dltcRatePerHectare = 59400
const stampDutyThresholdPaise = 20000000
const stampDutyRate = 0.003
const cropOptions = ['सोयाबीन', 'ऊस', 'हरभरा', 'तूर']
let razorpayCheckoutScript

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (!razorpayCheckoutScript) {
    razorpayCheckoutScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => {
        if (window.Razorpay) resolve()
        else {
          razorpayCheckoutScript = null
          reject(new Error('Razorpay चेकआउट सुरू करता आले नाही.'))
        }
      }
      script.onerror = () => {
        razorpayCheckoutScript = null
        reject(new Error('पेमेंट सेवा लोड करता आली नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.'))
      }
      document.body.appendChild(script)
    })
  }
  return razorpayCheckoutScript
}

function matchLocationOption(value, options, aliases = {}) {
  const normalize = (name) => name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  return options.find((option) => normalize(option) === normalize(value)
    || aliases[option]?.some((alias) => normalize(alias) === normalize(value))) || ''
}

function normalizeDigits(value) {
  return value.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export default function LoanApplicationForm({ loan, profile, onCancel, onSubmitted, onSessionExpired, application = null }) {
  const [locationData, setLocationData] = useState([])
  const [locationError, setLocationError] = useState('')
  const [fullName, setFullName] = useState(application?.fullName || profile.fullName || '')
  const [location, setLocation] = useState({
    state: application?.state || (application?.district || profile.district ? 'Maharashtra' : ''),
    district: application?.district || profile.district || '',
    taluka: application?.tehsilTaluka || profile.tehsilTaluka || '',
    village: application?.townVillage || profile.townVillage || '',
    surveyNumber: application?.surveyNumber || '',
  })
  const [aadharNumber, setAadharNumber] = useState(application?.aadharNumber || '')
  const [panNumber, setPanNumber] = useState(application?.panNumber || '')
  const [aadharName, setAadharName] = useState(application?.aadharName || '')
  const [panName, setPanName] = useState(application?.panName || '')
  const [aadharFetched, setAadharFetched] = useState(false)
  const [openPreview, setOpenPreview] = useState('')
  const [cibilPanNumber, setCibilPanNumber] = useState(application?.panNumber || panNumber)
  const [cibilChecked, setCibilChecked] = useState(false)
  const [occupantClass, setOccupantClass] = useState({ classOne: '', classTwo: '' })
  const [landSurveyNumbers, setLandSurveyNumbers] = useState({ satbara: '', eightA: '', mutation: '' })
  const [cropSurveyNumber, setCropSurveyNumber] = useState('')
  const [cropArea, setCropArea] = useState('')
  const [selectedCrop, setSelectedCrop] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [stampDutyPayment, setStampDutyPayment] = useState(null)
  const [unverifiedPayment, setUnverifiedPayment] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [submissionBusy, setSubmissionBusy] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [page, setPage] = useState(1)
  const paymentDraftKey = `mahacrop-payment-draft-${profile.id}-${loan.id}-${application?._id || 'new'}`
  const [paymentDraft] = useState(() => {
    try {
      const storedDraftId = window.sessionStorage.getItem(paymentDraftKey)
      if (storedDraftId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storedDraftId)) {
        return { id: storedDraftId, error: '' }
      }
      const newDraftId = crypto.randomUUID()
      window.sessionStorage.setItem(paymentDraftKey, newDraftId)
      return { id: newDraftId, error: '' }
    } catch {
      return { id: '', error: 'पेमेंट संदर्भ सुरक्षित ठेवता आला नाही. ब्राउझर स्टोरेज सुरू करून पृष्ठ पुन्हा उघडा.' }
    }
  })
  const paymentDraftId = paymentDraft.id
  const [paymentError, setPaymentError] = useState(paymentDraft.error)

  useEffect(() => {
    let isCurrent = true
    fetch('/maharashtra-locations.json')
      .then((response) => {
        if (!response.ok) throw new Error('महाराष्ट्रातील गावांची यादी लोड करता आली नाही.')
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data.districts)) throw new Error('गावांची यादी योग्य स्वरूपात उपलब्ध नाही.')
        if (!isCurrent) return
        setLocationData(data.districts)
        setLocation((current) => {
          const district = matchLocationOption(current.district, data.districts.map((item) => item.name), locationAliases.district)
          const districtData = data.districts.find((item) => item.name === district)
          const taluka = matchLocationOption(current.taluka, districtData?.talukas.map((item) => item.name) || [], locationAliases.taluka)
          const talukaData = districtData?.talukas.find((item) => item.name === taluka)
          const village = matchLocationOption(current.village, talukaData?.villages || [])
          return { ...current, district, taluka, village }
        })
      })
      .catch((loadError) => {
        if (isCurrent) setLocationError(loadError.message)
      })
    return () => { isCurrent = false }
  }, [])

  const activeDistrict = locationData.find((item) => item.name === location.district)
  const activeTaluka = activeDistrict?.talukas.find((item) => item.name === location.taluka)
  const isLocationComplete = Boolean(
    fullName.trim()
    && location.state === 'Maharashtra'
    && activeDistrict
    && activeTaluka
    && activeTaluka.villages.includes(location.village)
    && location.surveyNumber === '158',
  )
  const normalizedAadhar = normalizeDigits(aadharNumber).replace(/\s/g, '')
  const isAadharValid = /^\d{12}$/.test(normalizedAadhar)
  const isPanValid = /^[A-Z]{5}\d{4}[A-Z]$/i.test(panNumber.trim())
  const namesMatch = Boolean(aadharName.trim() && panName.trim() && normalizeName(aadharName) === normalizeName(panName))
  const canContinue = isAadharValid && isPanValid && namesMatch && aadharFetched
  const isCibilPanValid = /^[A-Z]{5}\d{4}[A-Z]$/i.test(cibilPanNumber.trim())
  const canContinueFromLandPage = Boolean(
    cibilChecked
    && isCibilPanValid
    && occupantClass.classOne
    && occupantClass.classTwo
    && occupantClass.classTwo !== 'yes'
    && activeDistrict
    && activeTaluka
    && activeTaluka.villages.includes(location.village)
    && landSurveyNumbers.satbara.trim()
    && landSurveyNumbers.eightA.trim()
    && landSurveyNumbers.mutation.trim(),
  )
  const numericCropArea = Number(cropArea)
  const eligibleCropAmount = Number.isFinite(numericCropArea) && numericCropArea > 0
    ? numericCropArea * dltcRatePerHectare
    : null
  const eligibleCropAmountPaise = eligibleCropAmount === null ? null : Math.round(eligibleCropAmount * 100)
  const stampDutyPaise = eligibleCropAmountPaise !== null && eligibleCropAmountPaise >= stampDutyThresholdPaise
    ? Math.round(eligibleCropAmountPaise * stampDutyRate)
    : 0
  const canSubmitApplication = Boolean(
    !application
    && paymentDraftId
    && isLocationComplete
    && canContinue
    && cibilChecked
    && isCibilPanValid
    && cibilPanNumber.trim().toUpperCase() === panNumber.trim().toUpperCase()
    && canContinueFromLandPage
    && cropSurveyNumber.trim()
    && Number.isFinite(numericCropArea)
    && numericCropArea > 0
    && numericCropArea <= 100000
    && selectedCrop
    && acceptedTerms,
  )

  async function requestPaymentApi(endpoint, payload) {
    const response = await fetch(`${API_URL}/api/payments/stamp-duty/${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'पेमेंट प्रक्रिया पूर्ण करता आली नाही.')
    return result
  }

  async function submitApplication() {
    if (!canSubmitApplication || submissionBusy) return false
    setSubmissionBusy(true)
    setSubmissionError('')
    try {
      const applicationData = new FormData()
      const applicationFields = {
        draftId: paymentDraftId,
        loanType: 'crop-loan',
        fullName,
        state: location.state,
        district: location.district,
        tehsilTaluka: location.taluka,
        townVillage: location.village,
        surveyNumber: location.surveyNumber,
        aadharNumber: normalizedAadhar,
        panNumber: panNumber.trim().toUpperCase(),
        cibilPanNumber,
        aadharName,
        panName,
        aadharFetched,
        cibilChecked,
        cibilScore: 750,
        occupantClassOne: occupantClass.classOne,
        occupantClassTwo: occupantClass.classTwo,
        satbaraSurveyNumber: landSurveyNumbers.satbara,
        eightASurveyNumber: landSurveyNumbers.eightA,
        mutationSurveyNumber: landSurveyNumbers.mutation,
        cropSurveyNumber,
        cropAreaHectares: numericCropArea,
        crop: selectedCrop,
        termsAccepted: acceptedTerms,
      }
      Object.entries(applicationFields).forEach(([field, value]) => applicationData.append(field, String(value)))
      const documentAssets = [
        ['identityProof', aadharCardPdf, 'aadhar.pdf'],
        ['panCard', panCardPdf, 'pan.pdf'],
        ['landRecord712', satbaraPdf, 'Satbara.pdf'],
        ['landRecord8a', eightAPdf, '8-A.pdf'],
        ['mutationRecord', mutationPdf, 'mutation.pdf'],
      ]
      const documentResponses = await Promise.all(documentAssets.map(([, asset]) => fetch(asset)))
      const documentBlobs = await Promise.all(documentResponses.map((documentResponse) => {
        if (!documentResponse.ok) throw new Error('अर्जातील PDF कागदपत्रे लोड करता आली नाहीत. पुन्हा प्रयत्न करा.')
        return documentResponse.blob()
      }))
      documentAssets.forEach(([field, , filename], index) => {
        applicationData.append(field, documentBlobs[index], filename)
      })

      const response = await fetch(`${API_URL}/api/applications/wizard`, {
        method: 'POST',
        credentials: 'include',
        body: applicationData,
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 401) onSessionExpired?.()
        throw new Error(result.message || 'अर्ज जमा करता आला नाही.')
      }
      onSubmitted?.(result)
      return true
    } catch (error) {
      setSubmissionError(error.message)
      return false
    } finally {
      setSubmissionBusy(false)
    }
  }

  async function verifyStampDutyPayment(paymentDetails) {
    setPaymentBusy(true)
    setPaymentError('')
    try {
      const verification = await requestPaymentApi('verify', paymentDetails)
      setStampDutyPayment({ paymentId: verification.paymentId, paid: true })
      setUnverifiedPayment(null)
      return true
    } catch (verificationError) {
      setPaymentError(verificationError.message)
      return false
    } finally {
      setPaymentBusy(false)
    }
  }

  async function payStampDuty() {
    if (!paymentDraftId || !cropArea || !stampDutyPaise || !acceptedTerms) return
    setPaymentBusy(true)
    setPaymentError('')
    try {
      await loadRazorpayCheckout()
      const order = await requestPaymentApi('order', {
        areaHectares: numericCropArea,
        draftId: paymentDraftId,
      })
      if (order.alreadyPaid) {
        setStampDutyPayment({ paymentId: order.paymentId, paid: true })
        setPaymentBusy(false)
        await submitApplication()
        return
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Mahacrop Loan',
        description: 'Stamp Duty Fees',
        order_id: order.orderId,
        prefill: {
          name: profile.fullName,
          contact: profile.mobileNumber,
        },
        theme: { color: '#315b3b' },
        modal: {
          ondismiss: () => setPaymentBusy(false),
        },
        handler: async (paymentResponse) => {
          const paymentDetails = { ...paymentResponse, draftId: paymentDraftId }
          setUnverifiedPayment(paymentDetails)
          if (await verifyStampDutyPayment(paymentDetails)) await submitApplication()
        },
      })
      checkout.on('payment.failed', (event) => {
        setPaymentError(event.error?.description || 'पेमेंट अयशस्वी झाले. पुन्हा प्रयत्न करा.')
        setPaymentBusy(false)
      })
      checkout.open()
    } catch (orderError) {
      setPaymentError(orderError.message)
      setPaymentBusy(false)
    }
  }

  useEffect(() => {
    if (!openPreview) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenPreview('')
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [openPreview])

  function updateLocation(updater) {
    setLocation(updater)
    setPage(1)
  }

  function fetchCard(type) {
    setOpenPreview(type)
    if (type === 'aadhar') setAadharFetched(true)
  }

  function updateLandLocation(field, value) {
    setLocation((current) => {
      if (field === 'district') return { ...current, district: value, taluka: '', village: '' }
      if (field === 'taluka') return { ...current, taluka: value, village: '' }
      return { ...current, village: value }
    })
  }

  function setOccupantClassAnswer(field, answer) {
    if (field === 'classOne') {
      setOccupantClass({ classOne: answer, classTwo: answer === 'yes' ? 'no' : 'yes' })
      return
    }
    setOccupantClass({ classOne: answer === 'yes' ? 'no' : 'yes', classTwo: answer })
  }

  function showLandDocument(type) {
    setOpenPreview(type)
  }

  return (
    <section className="application-section">
      <div className="application-heading">
        <div>
          <button type="button" className="detail-back detail-back-button" onClick={onCancel}><ArrowDown size={15} /> मागे जा</button>
          <p className="section-kicker">{loan.englishTitle}</p>
          <h1>{loan.title} <em>{application ? 'अर्ज बदला' : 'अर्ज'}</em></h1>
          {application && <p className="application-reference">अर्ज क्रमांक <strong>{application.applicationNumber || application._id}</strong></p>}
        </div>
        <button className="application-close" type="button" aria-label="अर्ज रद्द करा" title="अर्ज रद्द करा" onClick={onCancel}><X size={21} /></button>
      </div>

      <div className="application-form">
        <div className="application-location-grid">
          <label>पूर्ण नाव<input name="fullName" autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setPage(1) }} required maxLength="100" /></label>
          <label>राज्य<select name="state" value={location.state} onChange={(event) => updateLocation({ state: event.target.value, district: '', taluka: '', village: '', surveyNumber: '' })} required>
            <option value="">राज्य निवडा</option>
            <option value="Maharashtra">महाराष्ट्र</option>
          </select></label>
          <label>जिल्हा<select name="district" value={location.district} onChange={(event) => updateLocation((current) => ({ ...current, district: event.target.value, taluka: '', village: '', surveyNumber: '' }))} disabled={!location.state || !locationData.length} required>
            <option value="">जिल्हा निवडा</option>
            {locationData.map((district) => <option value={district.name} key={district.name}>{district.labelMr || district.name}</option>)}
          </select></label>
          <label>तालुका<select name="tehsilTaluka" value={location.taluka} onChange={(event) => updateLocation((current) => ({ ...current, taluka: event.target.value, village: '', surveyNumber: '' }))} disabled={!activeDistrict} required>
            <option value="">तालुका निवडा</option>
            {activeDistrict?.talukas.map((taluka) => <option value={taluka.name} key={taluka.name}>{taluka.labelMr || taluka.name}</option>)}
          </select></label>
          <label>गाव<select name="townVillage" value={location.village} onChange={(event) => updateLocation((current) => ({ ...current, village: event.target.value, surveyNumber: '' }))} disabled={!activeTaluka} required>
            <option value="">गाव निवडा</option>
            {activeTaluka?.villages.map((village, index) => <option value={village} key={village}>{activeTaluka.villageLabelsMr?.[index] || village}</option>)}
          </select></label>
          <label>सर्व्हे क्रमांक<select name="surveyNumber" value={location.surveyNumber} onChange={(event) => updateLocation((current) => ({ ...current, surveyNumber: event.target.value }))} disabled={!location.village} required>
            <option value="">सर्व्हे क्रमांक निवडा</option>
            <option value="158">158</option>
          </select></label>
        </div>
        {locationError && <p className="form-error application-error" role="alert">{locationError}</p>}
        {!locationError && !isLocationComplete && <p className="application-location-hint">अर्जाचे पुढील तपशील भरण्यासाठी वरील सर्व माहिती निवडा.</p>}

        {isLocationComplete && <>
          <nav className="application-stepper" aria-label="अर्जाची पृष्ठे">
            {pageTitles.map((title, index) => {
              const step = index + 1
              return <div className={`application-step ${page === step ? 'application-step-active' : ''} ${page > step ? 'application-step-complete' : ''}`} key={title} aria-current={page === step ? 'step' : undefined}>
                <span>{page > step ? <Check size={14} /> : `0${step}`}</span><b>{title}</b>
              </div>
            })}
          </nav>

          {page === 1 ? <section className="application-page" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ १ / ५</p><h2 id="application-page-title">ओळख व बँक तपशील</h2><p>कृपया कागदपत्रांवरील माहितीनुसार तपशील भरा.</p></div>
            <div className="application-identity-grid">
              <div className="application-card-field">
                <label htmlFor="aadhar-number">आधार क्रमांक</label>
                <div className="application-fetch-row">
                  <input id="aadhar-number" type="text" inputMode="numeric" autoComplete="off" placeholder="१२ अंकी आधार क्रमांक" value={aadharNumber} onChange={(event) => { setAadharNumber(event.target.value); setAadharFetched(false) }} maxLength={14} aria-describedby="aadhar-help" />
                  <button className="application-fetch-button" type="button" disabled={!isAadharValid} onClick={() => fetchCard('aadhar')}>आधार कार्ड पहा</button>
                </div>
                <small id="aadhar-help">आधार क्रमांक १२ अंकांचा असावा.</small>
              </div>
              <div className="application-card-field">
                <label htmlFor="pan-number">पॅन कार्ड क्रमांक</label>
                <div className="application-fetch-row">
                  <input id="pan-number" type="text" autoComplete="off" placeholder="उदा. ABCDE1234F" value={panNumber} onChange={(event) => setPanNumber(event.target.value.toUpperCase())} maxLength={10} />
                  <button className="application-fetch-button" type="button" disabled={!isPanValid} onClick={() => fetchCard('pan')}>पॅन कार्ड पहा</button>
                </div>
                <small>१० अक्षरे: ५ अक्षरे, ४ अंक आणि १ अक्षर.</small>
              </div>
              <label>आधार कार्डवरील नाव<input autoComplete="name" value={aadharName} onChange={(event) => setAadharName(event.target.value)} maxLength={100} required /></label>
              <label>पॅन कार्डवरील नाव<input autoComplete="name" value={panName} onChange={(event) => setPanName(event.target.value)} maxLength={100} required /></label>
            </div>

            {aadharFetched && <section className="linked-bank-panel" aria-live="polite">
              <div><p className="section-kicker">आधारशी जोडलेले खाते</p><h3>बँक खाते तपशील</h3></div>
              <dl><div><dt>बँकेचे नाव</dt><dd>Latur District Co. Op. Bank</dd></div><div><dt>IFSC कोड</dt><dd>IBKL0497LDC</dd></div><div><dt>खाते क्रमांक</dt><dd>509005594328</dd></div></dl>
            </section>}

            {aadharName.trim() && panName.trim() && !namesMatch && <p className="form-error application-error" role="alert">आधार कार्ड आणि पॅन कार्डवरील नाव जुळणे आवश्यक आहे.</p>}

            <div className="application-actions">
              <button className="application-cancel" type="button" onClick={onCancel}><X size={16} /> रद्द करा</button>
              <button className="submit-button" type="button" disabled={!canContinue} onClick={() => { setCibilPanNumber(panNumber); setPage(2); setOpenPreview('') }}>पुढील पृष्ठ <ArrowRight size={17} /></button>
            </div>
            {!canContinue && <p className="application-location-hint">पुढे जाण्यासाठी सर्व तपशील भरा, आधार कार्ड पहा आणि दोन्ही कार्डवरील नावे जुळवा.</p>}
          </section> : page === 2 ? <section className="application-page" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ २ / ५</p><h2 id="application-page-title">CIBIL स्कोअर</h2></div>
            <div className="cibil-panel">
              <label className="cibil-label" htmlFor="cibil-pan-number">पॅन क्रमांक</label>
              <div className="application-fetch-row">
                <input id="cibil-pan-number" type="text" autoComplete="off" placeholder="उदा. ABCDE1234F" value={cibilPanNumber} onChange={(event) => { setCibilPanNumber(event.target.value.toUpperCase()); setCibilChecked(false) }} maxLength={10} />
                <button className="submit-button cibil-check-button" type="button" disabled={!isCibilPanValid} onClick={() => setCibilChecked(true)}>CIBIL स्कोअर तपासा <Check size={16} /></button>
              </div>
              {cibilChecked && <div className="cibil-score" role="status"><span>CIBIL स्कोअर</span><strong>750</strong></div>}
            </div>

            <hr className="application-section-divider" />

            <div className="application-page-heading land-heading"><p className="section-kicker">जमिनीची कागदपत्रे</p><h2>जमिनीची कायदेशीर स्थिती</h2></div>
            <div className="application-land-locations">
              <label>जिल्हा<select value={location.district} onChange={(event) => updateLandLocation('district', event.target.value)} required>
                <option value="">जिल्हा निवडा</option>
                {locationData.map((district) => <option value={district.name} key={district.name}>{district.labelMr || district.name}</option>)}
              </select></label>
              <label>तालुका<select value={location.taluka} onChange={(event) => updateLandLocation('taluka', event.target.value)} disabled={!activeDistrict} required>
                <option value="">तालुका निवडा</option>
                {activeDistrict?.talukas.map((taluka) => <option value={taluka.name} key={taluka.name}>{taluka.labelMr || taluka.name}</option>)}
              </select></label>
              <label>गाव<select value={location.village} onChange={(event) => updateLandLocation('village', event.target.value)} disabled={!activeTaluka} required>
                <option value="">गाव निवडा</option>
                {activeTaluka?.villages.map((village, index) => <option value={village} key={village}>{activeTaluka.villageLabelsMr?.[index] || village}</option>)}
              </select></label>
            </div>

            <h3 className="land-classification-heading">जमिनीचे वर्गीकरण</h3>
            <div className="occupant-class-list">
              {[['classOne', 'भोगवटदार वर्ग १'], ['classTwo', 'भोगवटदार वर्ग २']].map(([field, label]) => (
                <fieldset className="occupant-class-row" key={field}>
                  <legend>{label}</legend>
                  {['yes', 'no'].map((answer) => <label className={`occupant-answer ${occupantClass[field] === answer ? 'occupant-answer-selected' : ''}`} key={answer}>
                    <input type="checkbox" checked={occupantClass[field] === answer} onChange={() => setOccupantClassAnswer(field, answer)} />
                    <span>{answer === 'yes' ? 'होय' : 'नाही'}</span>
                  </label>)}
                </fieldset>
              ))}
            </div>
            {occupantClass.classTwo === 'yes' && <p className="form-error application-error" role="alert">भोगवटदार वर्ग २ साठी पुढील पृष्ठावर जाता येणार नाही.</p>}

            <div className="land-record-list">
              {[
                ['satbara', '७/१२ उतारा', satbaraPdf],
                ['eightA', '८-अ उतारा', eightAPdf],
                ['mutation', 'फेरफार / म्युटेशन', mutationPdf],
              ].map(([field, label]) => (
                <div className="land-record-row" key={field}>
                  <label htmlFor={`land-${field}`}>{label} : सर्व्हे क्रमांक</label>
                  <div className="application-fetch-row">
                    <input id={`land-${field}`} type="text" value={landSurveyNumbers[field]} onChange={(event) => setLandSurveyNumbers((current) => ({ ...current, [field]: event.target.value }))} placeholder="सर्व्हे क्रमांक लिहा" />
                    <button className="application-fetch-button" type="button" onClick={() => showLandDocument(field)}>दस्तऐवज पहा</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="application-actions application-page-navigation">
              <button className="application-cancel" type="button" onClick={() => { setPage(1); setOpenPreview('') }}><ArrowLeft size={16} /> मागील पृष्ठ</button>
              <button className="submit-button" type="button" disabled={!canContinueFromLandPage} onClick={() => { setPage(3); setOpenPreview('') }}>पुढील पृष्ठ <ArrowRight size={17} /></button>
            </div>
            {occupantClass.classTwo !== 'yes' && !canContinueFromLandPage && <p className="application-location-hint">पुढे जाण्यासाठी पॅन क्रमांक तपासा, जमिनीचे वर्गीकरण निवडा आणि तिन्ही सर्व्हे क्रमांक भरा.</p>}
          </section> : page === 3 ? <section className="application-page" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ ३ / ५</p><h2 id="application-page-title">Cropping pattern as mentioned in Satbara</h2><p>पीक आणि पिकाखालील क्षेत्राचा तपशील</p></div>
            <div className="crop-pattern-grid">
              <label>सर्व्हे क्रमांक<input type="text" value={cropSurveyNumber} onChange={(event) => setCropSurveyNumber(event.target.value)} placeholder="जमिनीचा सर्व्हे क्रमांक" /></label>
              <label>क्षेत्र (हेक्टर)<input type="number" min="0.01" step="any" inputMode="decimal" value={cropArea} onChange={(event) => setCropArea(event.target.value)} placeholder="उदा. १.५" /></label>
              <label>पीक<select value={selectedCrop} onChange={(event) => setSelectedCrop(event.target.value)}>
                <option value="">पीक निवडा</option>
                {cropOptions.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
              </select></label>
            </div>

            <hr className="application-section-divider" />

            <div className="application-page-heading eligible-amount-heading"><p className="section-kicker">DLTC दरानुसार</p><h2>कर्जास पात्र रक्कम</h2><p>₹५९,४०० प्रति हेक्टर या दराने अंदाजे रक्कम.</p></div>
            {eligibleCropAmount !== null && selectedCrop
              ? <div className="eligible-crop-amount" aria-live="polite">
                <p><strong>{cropArea}</strong> हेक्टर क्षेत्रावरील <strong>{selectedCrop}</strong> साठी पीक कर्ज रक्कम</p>
                <output>₹{eligibleCropAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</output>
              </div>
              : <p className="application-location-hint">पात्र रक्कम पाहण्यासाठी क्षेत्र भरा आणि पीक निवडा.</p>}

            <div className="application-actions application-page-navigation">
              <button className="application-cancel" type="button" onClick={() => setPage(2)}><ArrowLeft size={16} /> मागील पृष्ठ</button>
              <button className="submit-button" type="button" onClick={() => setPage(4)}>पुढील पृष्ठ <ArrowRight size={17} /></button>
            </div>
          </section> : page === 4 ? <section className="application-page terms-page" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ ४ / ५</p><h2 id="application-page-title">Acceptance of terms &amp; conditions</h2></div>
            <div className="terms-document">
              <p className="terms-intro">महाक्रॉप लोन अर्जाबाबतच्या अटी व शर्ती</p>
              <p className="terms-notice">हा अर्ज कर्जासाठीची विनंती नोंदवतो. तो कर्ज मंजुरीचा करार किंवा हमी नाही.</p>
              <ol>
                <li><strong>माहितीची अचूकता:</strong> अर्जात आणि जोडलेल्या कागदपत्रांत दिलेली माहिती खरी, पूर्ण आणि अद्ययावत असल्याची खात्री अर्जदाराने करावी.</li>
                <li><strong>कागदपत्रांची पडताळणी:</strong> आधार, पॅन, जमीन अभिलेख आणि इतर तपशील ओळख व पात्रता पडताळण्यासाठी तपासले जाऊ शकतात. आवश्यक असल्यास अधिक माहिती किंवा कागदपत्रे मागवली जाऊ शकतात.</li>
                <li><strong>माहितीचा वापर:</strong> अर्जावर प्रक्रिया करणे, अर्जदाराशी संपर्क साधणे आणि संबंधित पडताळणी करणे यासाठी अर्जातील माहिती वापरली जाऊ शकते. माहिती सुरक्षितपणे हाताळण्याची जबाबदारी महाक्रॉप लोनची राहील.</li>
                <li><strong>पात्रता व मंजुरी:</strong> दाखवलेला CIBIL स्कोअर आणि कर्जास पात्र रकमेचा अंदाज हा केवळ नमुना/प्राथमिक माहिती आहे. प्रत्यक्ष पात्रता, व्याजदर, अटी आणि मंजुरी संबंधित कर्जदाता ठरवेल.</li>
                <li><strong>कर्ज मंजुरीची हमी नाही:</strong> अर्ज सादर केल्याने कर्ज मंजूर होईल, विशिष्ट रक्कम मिळेल किंवा निश्चित कालावधीत निर्णय मिळेल, अशी हमी दिली जात नाही.</li>
                <li><strong>चुकीची किंवा अपूर्ण माहिती:</strong> चुकीची, दिशाभूल करणारी किंवा अपूर्ण माहिती आढळल्यास अर्ज थांबवला, नाकारला किंवा पुढील पडताळणीसाठी पाठवला जाऊ शकतो.</li>
                <li><strong>अंतिम कर्ज करार:</strong> कर्ज मंजूर झाल्यास लागू होणाऱ्या अंतिम अटी संबंधित कर्जदात्याच्या मंजुरीपत्र व कर्ज करारात दिलेल्या असतील. त्या कागदपत्रांचे वाचन आणि समजून घेणे अर्जदाराची जबाबदारी आहे.</li>
              </ol>
              <p className="terms-updated">अर्जातील प्राथमिक माहितीसाठी या अटी लागू आहेत. अंतिम कायदेशीर व आर्थिक अटी संबंधित कर्जदात्याच्या कागदपत्रांनुसार राहतील.</p>
            </div>
            <label className={`terms-acceptance ${acceptedTerms ? 'terms-acceptance-checked' : ''}`}>
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
              <span>मी वरील अटी व शर्ती वाचल्या आहेत आणि त्या मान्य करतो / करते.</span>
            </label>
            <div className="application-actions application-page-navigation">
              <button className="application-cancel" type="button" onClick={() => setPage(3)}><ArrowLeft size={16} /> मागील पृष्ठ</button>
              <div className="terms-page-actions">
                <span className={`terms-acceptance-status ${acceptedTerms ? 'terms-accepted' : ''}`} role="status">{acceptedTerms ? 'अटी व शर्ती मान्य केल्या' : 'पुढे जाण्यासाठी अटी मान्य करा'}</span>
                <button className="submit-button" type="button" disabled={!acceptedTerms} onClick={() => setPage(5)}>पृष्ठ ५ वर जा <ArrowRight size={17} /></button>
              </div>
            </div>
          </section> : page === 5 ? <section className="application-page stamp-duty-page" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ ५ / ५</p><h2 id="application-page-title">Stamp Duty Fees</h2><p>मुद्रांक शुल्काची लागू रक्कम आणि ऑनलाइन पेमेंट.</p></div>
            {eligibleCropAmountPaise === null || !selectedCrop
              ? <div className="stamp-duty-notice" role="status">मुद्रांक शुल्क मोजण्यासाठी पृष्ठ ३ वर क्षेत्रफळ आणि पीक निवडा.</div>
              : <div className="stamp-duty-summary">
                <div className="stamp-duty-loan"><span>गणना केलेली कर्ज रक्कम</span><strong>₹{(eligibleCropAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                {eligibleCropAmountPaise >= stampDutyThresholdPaise
                  ? <>
                    <div className="stamp-duty-rule">₹२,००,००० किंवा त्याहून अधिक कर्ज रकमेसाठी ०.३% मुद्रांक शुल्क लागू आहे.</div>
                    <div className="stamp-duty-due"><span>देय मुद्रांक शुल्क (०.३%)</span><strong>₹{(stampDutyPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                    {stampDutyPayment?.paid
                      ? <div className="stamp-payment-success" role="status"><Check size={19} /><span>मुद्रांक शुल्काचे पेमेंट यशस्वी झाले आहे.</span><strong>पेमेंट संदर्भ: {stampDutyPayment.paymentId}</strong></div>
                      : <>
                        {unverifiedPayment
                          ? <button className="submit-button stamp-duty-pay-button" type="button" disabled={paymentBusy || submissionBusy} onClick={async () => {
                            if (await verifyStampDutyPayment(unverifiedPayment)) await submitApplication()
                          }}>
                            {paymentBusy ? 'पेमेंट पडताळत आहोत...' : 'झालेले पेमेंट पुन्हा पडताळा'}<Check size={17} />
                          </button>
                          : <button className="submit-button stamp-duty-pay-button" type="button" disabled={paymentBusy || submissionBusy || !canSubmitApplication} onClick={payStampDuty}>
                            {paymentBusy ? 'पेमेंट प्रक्रिया सुरू आहे...' : 'Razorpay द्वारे शुल्क भरा'}<ArrowRight size={17} />
                          </button>}
                      </>}
                    {stampDutyPayment?.paid && submissionError && <button className="submit-button stamp-duty-pay-button" type="button" disabled={submissionBusy} onClick={submitApplication}>
                      {submissionBusy ? 'अर्ज जमा होत आहे...' : 'पेमेंट झाले आहे — अर्ज पुन्हा जमा करा'}<ArrowRight size={17} />
                    </button>}
                    <p className="stamp-payment-methods">Razorpay Checkout मध्ये तुमच्या खात्यासाठी उपलब्ध असलेल्या पेमेंट पद्धती वापरा.</p>
                  </>
                  : <>
                    <div className="stamp-duty-exempt" role="status"><Check size={19} /><div><strong>मुद्रांक शुल्क आवश्यक नाही</strong><p>₹२,००,००० पेक्षा कमी कर्ज रकमेसाठी मुद्रांक शुल्क लागू होत नाही.</p></div></div>
                    <button className="submit-button stamp-duty-pay-button" type="button" disabled={submissionBusy || !canSubmitApplication} onClick={submitApplication}>
                      {submissionBusy ? 'अर्ज जमा होत आहे...' : 'अर्ज जमा करा'}<ArrowRight size={17} />
                    </button>
                  </>}
              </div>}
            {paymentError && <p className="form-error application-error" role="alert">{paymentError}</p>}
            {submissionError && <p className="form-error application-error" role="alert">{submissionError}</p>}
            {!acceptedTerms && <p className="application-location-hint">पेमेंट करण्यापूर्वी पृष्ठ ४ वरील अटी व शर्ती मान्य करा.</p>}
            {!canSubmitApplication && acceptedTerms && <p className="application-location-hint">अर्ज जमा करण्यापूर्वी पृष्ठ १ ते ३ वरील सर्व आवश्यक माहिती पूर्ण करा.</p>}
            <div className="application-actions application-page-navigation">
              <button className="application-cancel" type="button" onClick={() => setPage(4)}><ArrowLeft size={16} /> मागील पृष्ठ</button>
            </div>
          </section> : <section className="application-page application-placeholder" aria-labelledby="application-page-title">
            <div className="application-page-heading"><p className="section-kicker">पृष्ठ {page} / ४</p><h2 id="application-page-title">{pageTitles[page - 1]}</h2></div>
            <div className="application-placeholder-content"><span>{`0${page}`}</span><div><h3>या पृष्ठावरील माहिती पुढील टप्प्यात जोडली जाईल.</h3><p>पृष्ठ {page} साठीचे तपशील तुम्ही दिल्यानंतर येथे भरता येतील.</p></div></div>
            <div className="application-actions application-page-navigation">
              <button className="application-cancel" type="button" onClick={() => setPage(page - 1)}><ArrowLeft size={16} /> मागील पृष्ठ</button>
              {page < 5
                ? <button className="submit-button" type="button" onClick={() => setPage(page + 1)}>पुढील पृष्ठ <ArrowRight size={17} /></button>
                : <p className="application-location-hint">पृष्ठ ५ ची माहिती पुढील टप्प्यात जोडली जाईल.</p>}
            </div>
          </section>}
        </>}
      </div>
      {openPreview && <div className="application-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenPreview('') }}>
        <section className="application-preview-modal" role="dialog" aria-modal="true" aria-labelledby="application-preview-title">
          <div className="application-preview-heading"><h3 id="application-preview-title">{({ aadhar: 'आधार कार्ड नमुना', pan: 'पॅन कार्ड नमुना', satbara: '७/१२ उतारा', eightA: '८-अ उतारा', mutation: 'फेरफार / म्युटेशन उतारा' })[openPreview]}</h3><button type="button" onClick={() => setOpenPreview('')} aria-label="दस्तऐवज बंद करा"><X size={17} /> बंद करा</button></div>
          <iframe title="दस्तऐवजाचा नमुना PDF" src={`${({ aadhar: aadharCardPdf, pan: panCardPdf, satbara: satbaraPdf, eightA: eightAPdf, mutation: mutationPdf })[openPreview]}#toolbar=0`} />
        </section>
      </div>}
    </section>
  )
}
