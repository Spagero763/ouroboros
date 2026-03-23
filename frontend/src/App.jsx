import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'

const TREASURY_ADDRESS = '0x97CDC84FcFab7b24998C93f0130EFbB0c5dBa247'
const RPC_URL = 'https://sepolia.base.org'

const TREASURY_ABI = [
  'function getState() view returns (uint256, uint256, uint256, address, uint256, uint256)',
  'event DecisionLogged(uint256 indexed cycle, string decision, uint256 amount, string reason, bytes32 txHash, uint256 timestamp)',
]

function OuroborosLogo({ size = 36, light = false }) {
  const c = light ? '#F7F5F0' : '#0E0D0A'
  const m = light ? 'rgba(247,245,240,0.25)' : 'rgba(14,13,10,0.15)'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="38" stroke={c} strokeWidth="9" strokeLinecap="round" strokeDasharray="210 30" />
      <circle cx="50" cy="50" r="38" stroke={m} strokeWidth="5" strokeDasharray="90 150" strokeDashoffset="120" />
      <circle cx="50" cy="12" r="7" fill={c} />
      <ellipse cx="50" cy="12" rx="3" ry="3.5" fill={light ? '#0E0D0A' : '#F7F5F0'} />
      <line x1="45" y1="18" x2="42" y2="23" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="18" x2="58" y2="23" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.querySelectorAll('[data-r]').forEach((n, i) => setTimeout(() => n.classList.add('in'), i * 90))
        obs.disconnect()
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function N({ v, d = 4 }) {
  const [n, setN] = useState(0)
  const t = parseFloat(v) || 0
  useEffect(() => {
    const t0 = performance.now()
    const go = now => {
      const p = Math.min((now - t0) / 1100, 1)
      setN(t * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(go)
    }
    requestAnimationFrame(go)
  }, [t])
  return <>{n.toFixed(d)}</>
}

function Badge({ type }) {
  const m = { TRADE: ['Trade', '#1B4332', '#D1FAE5'], REINVEST: ['Reinvest', '#1E3A5F', '#DBEAFE'], HOLD: ['Hold', '#78350F', '#FEF3C7'] }
  const [l, fg, bg] = m[type] || m.HOLD
  return <span style={{ padding: '3px 11px', background: bg, color: fg, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '2px' }}>{l}</span>
}

export default function App() {
  const [s, setS] = useState({ principal: '0', balance: '0', yield: '0', cycles: '0', spent: '0' })
  const [dec, setDec] = useState([])
  const [loading, setLoading] = useState(true)

  const hero = useReveal(), metrics = useReveal(), feed = useReveal(), about = useReveal()

  async function load() {
    try {
      const p = new ethers.JsonRpcProvider(RPC_URL)
      const c = new ethers.Contract(TREASURY_ADDRESS, TREASURY_ABI, p)
      const r = await c.getState()
      setS({ principal: ethers.formatEther(r[0]), balance: ethers.formatEther(r[1]), yield: ethers.formatEther(r[2]), cycles: r[4].toString(), spent: ethers.formatEther(r[5]) })
      const evts = await c.queryFilter(c.filters.DecisionLogged(), -50000)
      setDec(evts.map(e => ({ cycle: e.args[0].toString(), type: e.args[1], amount: ethers.formatEther(e.args[2]), reason: e.args[3], timestamp: e.args[5].toString(), tx: e.transactionHash })).reverse())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [])

  const ts = u => u ? new Date(Number(u) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  const sh = h => h && h !== '0x' + '0'.repeat(64) ? h.slice(0, 8) + '…' + h.slice(-6) : null

  return (
    <>
      <style>{`
        :root { --sans:'DM Sans',-apple-system,sans-serif; --serif:'Cormorant Garamond',Georgia,serif; --bg:#F7F5F0; --ink:#0E0D0A; --muted:#6A6760; --faint:#C8C5BE; --rule:#E4E1D9; --card:#EDEAE3; --night:#0E0D0A; }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
        a{color:inherit;text-decoration:none}
        [data-r]{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
        [data-r].in{opacity:1;transform:translateY(0)}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* NAV */}
      <nav style={{ position:'fixed', inset:'0 0 auto', zIndex:200, height:66, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 52px', background:'rgba(247,245,240,.9)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--rule)' }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <OuroborosLogo size={32} />
          <span style={{ fontFamily:'var(--serif)', fontSize:'1.2rem', fontWeight:500, letterSpacing:'.04em' }}>Ouroboros</span>
        </a>
        <div style={{ display:'flex', alignItems:'center', gap:36 }}>
          {['Activity#feed','About#about'].map(s => {
            const [l, h] = s.split('#')
            return <a key={l} href={`#${h}`} style={{ fontSize:13, color:'var(--muted)', transition:'color .2s' }} onMouseEnter={e=>e.target.style.color='var(--ink)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>{l}</a>
          })}
          <a href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:12, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', padding:'9px 20px', border:'1.5px solid var(--ink)', borderRadius:2, transition:'all .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--ink)';e.currentTarget.style.color='var(--bg)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--ink)'}}>
            Basescan ↗
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section ref={hero} style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, maxWidth:1400, margin:'0 auto', padding:'130px 52px 80px', alignItems:'center' }}>
        <div>
          <div data-r style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:44 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#22C55E', display:'inline-block', animation:'pulse 2s ease-in-out infinite', boxShadow:'0 0 0 3px rgba(34,197,94,.2)' }} />
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)' }}>Live · Base Sepolia</span>
          </div>
          <h1 data-r style={{ fontFamily:'var(--serif)', fontSize:'clamp(4rem,6.5vw,7.5rem)', fontWeight:300, lineHeight:1.0, letterSpacing:'-.03em', marginBottom:36 }}>
            The agent<br />
            <em style={{ fontStyle:'italic', color:'var(--muted)' }}>that feeds</em><br />
            itself.
          </h1>
          <p data-r style={{ fontSize:'1rem', color:'var(--muted)', lineHeight:1.8, maxWidth:420, fontWeight:300, marginBottom:52 }}>
            Stakes ETH. Earns yield. Pays for its own AI. Executes DeFi trades. No humans. No top-ups. The loop never stops.
          </p>
          <div data-r style={{ display:'flex', gap:16, alignItems:'center' }}>
            <a href="#feed" style={{ padding:'12px 28px', background:'var(--ink)', color:'var(--bg)', fontSize:13, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', borderRadius:2 }}>View activity</a>
            <a href="#about" style={{ fontSize:13, color:'var(--muted)', textDecoration:'underline', textUnderlineOffset:4 }}>How it works →</a>
          </div>
        </div>

        <div data-r style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
          {/* Animated ring */}
          <div style={{ position:'relative', width:240, height:240, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:40 }}>
            <svg width="240" height="240" viewBox="0 0 240 240" fill="none" style={{ position:'absolute', top:0, left:0 }}>
              <circle cx="120" cy="120" r="100" stroke="var(--rule)" strokeWidth="18" strokeLinecap="round" strokeDasharray="560 80" />
            </svg>
            <svg width="240" height="240" viewBox="0 0 240 240" fill="none" style={{ position:'absolute', top:0, left:0, animation:'spin 18s linear infinite', transformOrigin:'120px 120px' }}>
              <circle cx="120" cy="120" r="100" stroke="var(--ink)" strokeWidth="12" strokeLinecap="round" strokeDasharray="220 420" />
            </svg>
            <div style={{ textAlign:'center', zIndex:1 }}>
              <div style={{ fontFamily:'var(--serif)', fontSize:'3.2rem', fontWeight:300, lineHeight:1, letterSpacing:'-.025em' }}>
                <N v={s.yield} d={4} />
              </div>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', marginTop:6 }}>stETH available</div>
            </div>
          </div>

          {/* Stats list */}
          {[['Principal locked', s.principal, 'stETH', 2], ['Current balance', s.balance, 'stETH', 4], ['Total spent', s.spent, 'stETH', 4], ['Cycles run', s.cycles, '', 0]].map(([l, v, u, d]) => (
            <div key={l} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'16px 0', borderBottom:'1px solid var(--rule)' }}>
              <span style={{ fontSize:13, color:'var(--muted)', fontWeight:400 }}>{l}</span>
              <span style={{ fontFamily:'var(--serif)', fontSize:'1.45rem', fontWeight:300, letterSpacing:'-.01em' }}>
                <N v={v} d={d} />{u && <span style={{ fontSize:'.85rem', color:'var(--muted)', marginLeft:4 }}>{u}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ background:'var(--ink)', color:'var(--bg)', padding:'13px 0', overflow:'hidden', whiteSpace:'nowrap', fontSize:13, fontWeight:500, letterSpacing:'.12em', textTransform:'uppercase' }}>
        <div style={{ display:'inline-block', animation:'mq 22s linear infinite' }}>
          {Array(10).fill('— Stake  — Earn  — Think  — Act  — Record  — Repeat  ').join('')}
        </div>
      </div>

      {/* FEED */}
      <section id="feed" ref={feed} style={{ maxWidth:1200, margin:'0 auto', padding:'96px 52px' }}>
        <div data-r style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderBottom:'2px solid var(--ink)', paddingBottom:20, marginBottom:0 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:600, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>On-chain record · ERC-8004</p>
            <h2 style={{ fontFamily:'var(--serif)', fontSize:'clamp(2.4rem,4vw,3.8rem)', fontWeight:300, letterSpacing:'-.025em', lineHeight:1 }}>Decision log</h2>
          </div>
          <span style={{ fontFamily:'var(--serif)', fontSize:'3.5rem', fontWeight:300, color:'var(--faint)', lineHeight:1 }}>{loading ? '…' : dec.length}</span>
        </div>

        {loading && <div style={{ padding:'80px 0', textAlign:'center', fontFamily:'var(--serif)', fontSize:'1.5rem', fontStyle:'italic', color:'var(--faint)' }}>Reading the chain…</div>}

        {!loading && dec.length === 0 && (
          <div style={{ padding:'80px 0', textAlign:'center' }}>
            <p style={{ fontFamily:'var(--serif)', fontSize:'1.6rem', fontStyle:'italic', color:'var(--faint)', marginBottom:8 }}>No decisions yet</p>
            <p style={{ fontSize:13, color:'var(--muted)' }}>Run the agent — decisions appear here in real time</p>
          </div>
        )}

        {dec.map((d, i) => (
          <div key={i} data-r style={{ display:'grid', gridTemplateColumns:'96px 1fr 80px', gap:40, padding:'30px 0', borderBottom:'1px solid var(--rule)', alignItems:'start', transition:'background .15s', cursor:'default' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div>
              <div style={{ fontFamily:'var(--serif)', fontSize:'2.6rem', fontWeight:300, lineHeight:1, color:'var(--faint)' }}>#{d.cycle}</div>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--faint)', marginTop:4 }}>Cycle</div>
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
                <Badge type={d.type} />
                <span style={{ fontFamily:'var(--serif)', fontSize:'1.3rem', fontWeight:400, letterSpacing:'-.01em' }}>{parseFloat(d.amount).toFixed(4)} stETH</span>
              </div>
              <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.65, maxWidth:520, fontWeight:300 }}>{d.reason}</p>
              <div style={{ display:'flex', gap:20, alignItems:'center', marginTop:10 }}>
                <span style={{ fontSize:12, color:'var(--faint)' }}>{ts(d.timestamp)}</span>
                {sh(d.tx) && <a href={`https://sepolia.basescan.org/tx/${d.tx}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, fontWeight:500, color:'var(--ink)', opacity:.5, textDecoration:'underline', textUnderlineOffset:3, transition:'opacity .2s' }} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>{sh(d.tx)} ↗</a>}
              </div>
            </div>
            <div style={{ textAlign:'right', paddingTop:4 }}>
              <span style={{ fontFamily:'var(--serif)', fontSize:'2.8rem', fontWeight:300, color:'var(--rule)', lineHeight:1 }}>{d.type==='TRADE'?'⇄':d.type==='REINVEST'?'↻':'–'}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ABOUT — dark */}
      <section id="about" ref={about} style={{ background:'var(--night)', color:'#F7F5F0', padding:'96px 52px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:100, marginBottom:64 }}>
            <div>
              <div data-r style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
                <OuroborosLogo size={26} light />
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(247,245,240,.35)' }}>How it works</span>
              </div>
              <h2 data-r style={{ fontFamily:'var(--serif)', fontSize:'clamp(2.8rem,4vw,4.5rem)', fontWeight:300, lineHeight:1.05, letterSpacing:'-.025em', marginBottom:28 }}>
                An organism,<br /><em style={{ fontStyle:'italic', color:'rgba(247,245,240,.3)' }}>not a script.</em>
              </h2>
              <p data-r style={{ fontSize:'.95rem', color:'rgba(247,245,240,.5)', lineHeight:1.85, fontWeight:300, maxWidth:380 }}>
                Named after the ancient symbol of a serpent consuming its own tail — a loop that sustains itself forever. The agent stakes, earns, thinks, acts, and records. Infinitely.
              </p>
            </div>
            <div>
              {[['01','Stake','ETH deposited once. Principal locked forever in the treasury contract. Only yield is spendable.'],['02','Earn','stETH balance grows with every Lido beacon chain epoch — approximately once daily.'],['03','Think','Claude reads the treasury state and decides: TRADE to USDC, REINVEST, or HOLD.'],['04','Act','Decision executed on Base via the treasury contract and Uniswap V3 swap router.'],['05','Record','Every action written permanently on-chain to the agent\'s ERC-8004 identity.']].map(([n, title, desc], i) => (
                <div key={n} data-r style={{ display:'grid', gridTemplateColumns:'44px 1fr', gap:18, padding:'22px 0', borderBottom:'1px solid rgba(247,245,240,.07)' }}>
                  <span style={{ fontFamily:'var(--serif)', fontSize:'.85rem', color:'rgba(247,245,240,.2)', paddingTop:2 }}>{n}</span>
                  <div>
                    <div style={{ fontFamily:'var(--serif)', fontSize:'1.15rem', fontWeight:400, marginBottom:4 }}>{title}</div>
                    <div style={{ fontSize:13, color:'rgba(247,245,240,.4)', lineHeight:1.65, fontWeight:300 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div data-r style={{ borderTop:'1px solid rgba(247,245,240,.08)', paddingTop:44, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:28 }}>
            {[['Protocol Labs','Fully autonomous ERC-8004 agent'],['Base','Deployed on Base Sepolia'],['Uniswap','Real V3 swap execution'],['Zyfai','Yield-funded operation'],['Open Track','Community prize pool']].map(([sp, desc]) => (
              <div key={sp}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(247,245,240,.25)', marginBottom:6 }}>{sp}</div>
                <div style={{ fontSize:13, color:'rgba(247,245,240,.5)', lineHeight:1.55, fontWeight:300 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:'20px 52px', borderTop:'1px solid var(--rule)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, background:'var(--card)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <OuroborosLogo size={22} />
          <span style={{ fontFamily:'var(--serif)', fontSize:'1rem', fontWeight:400, letterSpacing:'.04em' }}>Ouroboros</span>
          <span style={{ fontSize:11, color:'var(--faint)', marginLeft:8 }}>{TREASURY_ADDRESS}</span>
        </div>
        <span style={{ fontSize:13, color:'var(--muted)', fontStyle:'italic', fontFamily:'var(--serif)' }}>The Synthesis Hackathon · Base Sepolia</span>
      </footer>
    </>
  )
}