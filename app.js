/* Note Quest — single-file React PWA (no build step).
 * Kids' music note-reading game. Same architecture as Jazz Guitar Lab / Piano Chords Lab:
 * e() = React.createElement, everything inline, freemium gate via localStorage.
 * STARTER scaffold: a working treble-clef note-reading loop. See CLAUDE.md for roadmap. */
const e = React.createElement;

const PRICE = '$4.99'; // TBD — kids note-reading apps skew cheap. Single source of truth.

/* ── Staff model ──
 * step 0 = E4 = bottom line (y=96). Each diatonic step up = -7px. */
const LS = 14, BOTTOM_Y = 96;
const PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
// step -> {letter, octave}
const STEP_NOTES = {
  '-2':{l:'C',o:4}, '-1':{l:'D',o:4}, '0':{l:'E',o:4}, '1':{l:'F',o:4},
  '2':{l:'G',o:4}, '3':{l:'A',o:4}, '4':{l:'B',o:4}, '5':{l:'C',o:5},
  '6':{l:'D',o:5}, '7':{l:'E',o:5}, '8':{l:'F',o:5}, '9':{l:'G',o:5}, '10':{l:'A',o:5},
};
const yForStep   = (s) => BOTTOM_Y - s * (LS/2);
const FREE_STEPS = [0,1,2,3,4,5,6,7,8];                 // E4..F5, all on the staff (no ledger)
const PRO_STEPS  = [-2,-1,9,10];                        // middle-C ledger, D4, G5, A5 ledger
const needsLedgerBelow = (s) => s <= -2;               // C4 and lower
const needsLedgerAbove = (s) => s >= 10;               // A5 and higher

const midiOf = (n) => 12 * (n.o + 1) + PC[n.l];

/* ── Audio (simple bell/note) ── */
let _actx;
const ctx = () => (_actx = _actx || new (window.AudioContext || window.webkitAudioContext)());
function tone(midi){
  const c = ctx(); if (c.state==='suspended') c.resume();
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type='triangle'; o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.25,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.9);
}
const track = (ev, props) => { try { window.posthog && window.posthog.capture(ev, props); } catch(_){} };

/* ── Treble staff with a single note ── */
function Staff({ step }){
  const W = 320, H = 150, x0 = 24, x1 = W-16, noteX = 220;
  const lines = [0,1,2,3,4].map(i => 40 + i*LS);   // top..bottom: F5 D5 B4 G4 E4
  const y = yForStep(step);
  const onLine = (step % 2 === 0); // even steps sit on lines (E4=0 line, G4=2 line, ...)
  return e('svg',{ viewBox:`0 0 ${W} ${H}`, width:'100%',
      style:{ display:'block', maxWidth:W, margin:'0 auto', transform:'translateZ(0)', WebkitTransform:'translateZ(0)' } },
    // staff lines
    lines.map((ly,i)=>e('line',{ key:i, x1:x0, y1:ly, x2:x1, y2:ly, stroke:'var(--staff)', strokeWidth:1.6 })),
    // treble clef (unicode 𝄞; serif fonts render it). Decorative — game works regardless.
    e('text',{ x:x0+6, y:90, fontSize:74, fill:'var(--staff)', style:{fontFamily:'Georgia,"Times New Roman",serif'} },'𝄞'),
    // ledger line through the note when needed
    needsLedgerBelow(step) ? e('line',{ x1:noteX-16, y1:yForStep(-2), x2:noteX+16, y2:yForStep(-2), stroke:'var(--staff)', strokeWidth:1.6 }) : null,
    needsLedgerAbove(step) ? e('line',{ x1:noteX-16, y1:yForStep(10), x2:noteX+16, y2:yForStep(10), stroke:'var(--staff)', strokeWidth:1.6 }) : null,
    // note head (ellipse, slightly rotated look via rx>ry)
    e('ellipse',{ cx:noteX, cy:y, rx:11, ry:8.5, fill:'var(--note)', stroke:'var(--note)' }),
    // stem
    e('line',{ x1:noteX+10, y1:y-2, x2:noteX+10, y2:y-44, stroke:'var(--note)', strokeWidth:2.4 })
  );
}

/* ── Upgrade sheet (stub — port RevenueCat IAP later) ── */
function UpgradeSheet({ onClose, onUnlock }){
  return e('div',{ onClick:onClose, style:{ position:'fixed', inset:0, background:'rgba(20,10,40,.55)', display:'flex', alignItems:'flex-end', zIndex:50 } },
    e('div',{ onClick:ev=>ev.stopPropagation(), style:{ width:'100%', maxWidth:560, margin:'0 auto', background:'var(--bg2)', borderRadius:'20px 20px 0 0', padding:'22px 20px 30px', border:'1px solid var(--border)' } },
      e('div',{style:{width:42,height:5,borderRadius:3,background:'var(--border)',margin:'0 auto 16px'}}),
      e('div',{style:{fontSize:'1.25rem',fontWeight:800,marginBottom:6}},'Unlock Pro 🎉'),
      e('div',{style:{fontSize:'.95rem',color:'var(--hint)',marginBottom:18,lineHeight:1.5}},
        'Pro adds harder notes (ledger lines & middle C), the bass clef, sharps & flats, and new game modes. One price, forever — no subscription.'),
      e('button',{ onClick:onUnlock, style:{ width:'100%', padding:16, borderRadius:14, cursor:'pointer', fontWeight:800, fontSize:'1.05rem', background:'var(--accent)', border:'none', color:'#fff' } }, 'Unlock Pro — ' + PRICE),
      e('button',{ onClick:onClose, style:{ width:'100%', padding:12, marginTop:10, borderRadius:12, cursor:'pointer', fontWeight:700, background:'transparent', border:'none', color:'var(--hint)' } }, 'Keep playing free')
    )
  );
}

const LETTERS = ['C','D','E','F','G','A','B'];

function App(){
  const [level, setLevel] = React.useState(() => localStorage.getItem('nq-level') || 'essentials');
  const [theme, setTheme] = React.useState(() => localStorage.getItem('nq-theme') || 'light');
  const [best,  setBest]  = React.useState(() => +(localStorage.getItem('nq-best') || 0));
  const [score, setScore] = React.useState(0);
  const [streak,setStreak]= React.useState(0);
  const [fb, setFb]       = React.useState(null);   // {ok, letter} feedback flash, or null
  const [upg, setUpg]     = React.useState(false);
  const isPro = level === 'pro';

  const pool = isPro ? FREE_STEPS.concat(PRO_STEPS) : FREE_STEPS;
  const pick = React.useCallback(() => pool[(Math.random()*pool.length)|0], [isPro]);
  const [step, setStep]   = React.useState(() => FREE_STEPS[(Math.random()*FREE_STEPS.length)|0]);

  React.useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem('nq-theme',theme); },[theme]);
  React.useEffect(()=>{ localStorage.setItem('nq-level',level); },[level]);
  React.useEffect(()=>{ track('app.loaded'); },[]);

  const note = STEP_NOTES[step];

  const answer = (letter) => {
    if (fb) return;                       // ignore taps during flash
    const ok = letter === note.l;
    tone(midiOf(note));
    setFb({ ok, letter });
    if (ok){
      const ns = streak + 1;
      setStreak(ns); setScore(s => s + 10 + streak*2);
      if (ns > best){ setBest(ns); localStorage.setItem('nq-best', ns); }
    } else {
      setStreak(0);
      track('note.missed', { note: note.l + note.o });
    }
    setTimeout(()=>{ setFb(null); setStep(pick()); }, ok ? 520 : 1100);
  };

  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:18, padding:16, marginBottom:14 };
  const stat = (icon,val,lbl) => e('div',{style:{textAlign:'center',flex:1}},
    e('div',{style:{fontSize:'1.3rem',fontWeight:800}}, icon+' '+val),
    e('div',{style:{fontSize:'.66rem',color:'var(--hint)',letterSpacing:'.05em',marginTop:2}}, lbl));

  return e(React.Fragment, null,
    e('header',{style:{display:'flex',alignItems:'center',gap:10,padding:'16px 0 10px'}},
      e('div',{style:{fontSize:'1.25rem',fontWeight:900,letterSpacing:'-.01em'}},'Note Quest'),
      e('div',{style:{flex:1}}),
      e('button',{ onClick:()=>setLevel(isPro?'essentials':'pro'), title:'Toggle Pro (dev)',
        style:{ padding:'5px 10px', borderRadius:20, cursor:'pointer', fontSize:'.72rem', fontWeight:800,
          border:'1px solid var(--border)', background:isPro?'var(--accent)':'transparent', color:isPro?'#fff':'var(--hint)' } },
        isPro?'Pro ✦':'Free'),
      e('button',{ onClick:()=>setTheme(theme==='light'?'dark':'light'),
        style:{ padding:'5px 9px', borderRadius:20, cursor:'pointer', fontSize:'.85rem', border:'1px solid var(--border)', background:'transparent', color:'var(--txt)' } },
        theme==='light'?'☾':'☀')
    ),

    e('div',{style:{...card, display:'flex'}}, stat('⭐',score,'SCORE'), stat('🔥',streak,'STREAK'), stat('🏆',best,'BEST')),

    e('div',{style:{...card, position:'relative'}},
      e(Staff,{ step }),
      e('div',{style:{textAlign:'center',fontSize:'.85rem',color:'var(--hint)',marginTop:4}}, 'What note is this?'),
      fb ? e('div',{style:{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', borderRadius:18,
          background: fb.ok?'rgba(34,197,94,.16)':'rgba(239,68,68,.16)' }},
          e('div',{style:{fontSize:'2.4rem'}}, fb.ok?'✅':'❌'),
          !fb.ok ? e('div',{style:{fontWeight:800,marginTop:4}}, 'It was '+note.l) : null
        ) : null
    ),

    e('div',{style:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginBottom:14}},
      LETTERS.map(L => e('button',{ key:L, onClick:()=>answer(L),
        style:{ padding:'18px 0', borderRadius:14, cursor:'pointer', fontWeight:800, fontSize:'1.15rem',
          border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--txt)' } }, L))
    ),

    !isPro ? e('button',{ onClick:()=>{ setUpg(true); track('paywall.shown',{feature:'Harder notes'}); },
      style:{ width:'100%', padding:'13px', borderRadius:14, cursor:'pointer', fontWeight:700,
        border:'1px dashed var(--accent)', background:'transparent', color:'var(--accent)', marginBottom:30 } },
      'Harder notes, bass clef & more 🔒') : e('div',{style:{height:30}}),

    upg ? e(UpgradeSheet,{ onClose:()=>setUpg(false), onUnlock:()=>{ setLevel('pro'); setUpg(false); track('upgrade.completed'); } }) : null
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));
