import { ArrowDown, ArrowRight, Check, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LoanDetail({ loan, onApply }) {
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
