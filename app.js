/* Note Quest — single-file React PWA (no build step).
 * Kids' music note-reading game. Same architecture as Jazz Guitar Lab / Piano Chords Lab:
 * e() = React.createElement, everything inline, freemium gate via localStorage.
 * Treble + bass clef note-reading loop. See CLAUDE.md for roadmap. */
const e = React.createElement;

const PRICE = '$4.99'; // TBD — kids note-reading apps skew cheap. Single source of truth.

/* ── Staff geometry ──
 * step 0 = bottom line (y=96). Each diatonic step up = -7px. Geometry is clef-independent;
 * only the step→pitch mapping changes per clef. */
const LS = 14, BOTTOM_Y = 96;
const PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const SEQ = ['C','D','E','F','G','A','B'];      // letter order within an octave (C starts octave)
const yForStep = (s) => BOTTOM_Y - s * (LS/2);
const needsLedgerBelow = (s) => s <= -2;        // first ledger line below the staff
const needsLedgerAbove = (s) => s >= 10;        // first ledger line above the staff
const midiOf = (n) => 12 * (n.o + 1) + PC[n.l];

/* Build a step→{letter,octave} map given the note sitting on step 0 (the bottom line). */
function buildSteps(rootLetter, rootOct, lo, hi){
  const i0 = SEQ.indexOf(rootLetter), m = {};
  for (let s = lo; s <= hi; s++){
    const k = i0 + s;
    m[s] = { l: SEQ[((k % 7) + 7) % 7], o: rootOct + Math.floor(k / 7) };
  }
  return m;
}

/* ── Clefs ──
 * free  = on-staff notes (no ledger). pro = ledger-line notes incl. middle C.
 * treble bottom line = E4; bass bottom line = G2 (so middle C lands one ledger above bass). */
const CLEFS = {
  treble: { name:'Treble', glyph:'𝄞', glyphY:90, glyphSize:74,
            free:[0,1,2,3,4,5,6,7,8], pro:[-2,-1,9,10], steps: buildSteps('E',4,-4,12) },
  bass:   { name:'Bass',   glyph:'𝄢', glyphY:70, glyphSize:52,
            free:[0,1,2,3,4,5,6,7,8], pro:[-2,-1,9,10], steps: buildSteps('G',2,-4,12) },
};

/* Build the pool of {clef,step} questions for the current level + clef mode. */
function buildPool(isPro, clefMode){
  const clefs = clefMode === 'both' ? ['treble','bass'] : [clefMode];
  const out = [];
  clefs.forEach(c => {
    const def = CLEFS[c];
    def.free.forEach(s => out.push({ clef:c, step:s }));
    if (isPro) def.pro.forEach(s => out.push({ clef:c, step:s }));
  });
  return out;
}

/* ── Game modes ──
 * endless is free; timed & lives are the "extra game modes" behind the Pro gate. */
const MODES = {
  endless: { name:'Endless', icon:'∞', pro:false },
  timed:   { name:'Timed',   icon:'⏱', pro:true, seconds:60 },
  lives:   { name:'Lives',   icon:'❤', pro:true, lives:3 },
};

/* ── Sticker rewards ── earned at streak milestones, persisted, shown on the results shelf.
 * Kids collect these; each is also the celebration shown mid-run when the streak lands on it. */
const STICKERS = [
  { at:5,  emoji:'🎵', label:'On fire!' },
  { at:10, emoji:'🌟', label:'Superstar!' },
  { at:15, emoji:'🚀', label:'Blast off!' },
  { at:20, emoji:'🏅', label:'Champion!' },
  { at:30, emoji:'👑', label:'Legend!' },
];
const CONFETTI = ['🎉','⭐','🎵','✨','🎈','🌟'];

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

/* ── In-app purchase (RevenueCat) ──
 * Entitlement 'pro', product 'pro_unlock' (ported from Jazz Guitar Lab, nq- prefixes).
 * Native path uses the RevenueCat Capacitor plugin when present — the iOS build assigns it to
 * window.Purchases and sets window.__RC_KEY__. On the web/PWA build there's no store, so we fall
 * back to a local unlock flag (nq-pro) so the app stays fully testable on GitHub Pages. */
const IAP = {
  ENTITLEMENT: 'pro',
  PRODUCT: 'pro_unlock',
  _cbs: new Set(),
  _pro: false,
  _rc: null,                                   // RevenueCat plugin, when running native

  get isPro(){ return this._pro; },
  subscribe(cb){ this._cbs.add(cb); return () => this._cbs.delete(cb); },
  _emit(){ this._cbs.forEach(cb => { try { cb(this._pro); } catch(_){} }); },
  _set(v){ this._pro = !!v; localStorage.setItem('nq-pro', this._pro ? '1' : '0'); this._emit(); },
  _entitled(ci){
    try { return !!(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[this.ENTITLEMENT]); }
    catch(_){ return false; }
  },

  async init(){
    this._pro = localStorage.getItem('nq-pro') === '1';   // instant UI from cache
    this._emit();
    this._rc = window.Purchases || null;
    if (this._rc){
      try {
        const key = window.__RC_KEY__;
        if (key && key.indexOf('__') !== 0) await this._rc.configure({ apiKey: key });
        const { customerInfo } = await this._rc.getCustomerInfo();
        this._set(this._entitled(customerInfo));
        if (this._rc.addCustomerInfoUpdateListener)
          this._rc.addCustomerInfoUpdateListener(ci => this._set(this._entitled(ci)));
      } catch(err){ track('iap.error', { where:'init', msg:String(err && err.message || err) }); }
    }
    return this._pro;
  },

  async purchase(){
    if (!this._rc){                              // web fallback — no store, unlock locally for testing
      this._set(true); track('upgrade.completed', { via:'web' }); return { ok:true, web:true };
    }
    try {
      const { offerings } = await this._rc.getOfferings();
      const pkgs = (offerings && offerings.current && offerings.current.availablePackages) || [];
      const pkg = pkgs.find(p => p.product && p.product.identifier === this.PRODUCT) || pkgs[0];
      let customerInfo;
      if (pkg) ({ customerInfo } = await this._rc.purchasePackage({ aPackage: pkg }));
      else     ({ customerInfo } = await this._rc.purchaseStoreProduct({ product:{ identifier:this.PRODUCT } }));
      const ok = this._entitled(customerInfo); this._set(ok);
      if (ok) track('upgrade.completed', { via:'store' });
      return { ok };
    } catch(err){
      const cancelled = !!(err && (err.userCancelled || /cancel/i.test(String(err.message || ''))));
      if (!cancelled) track('iap.error', { where:'purchase', msg:String(err && err.message || err) });
      return { ok:false, cancelled };
    }
  },

  async restore(){
    if (!this._rc){ const ok = localStorage.getItem('nq-pro') === '1'; this._set(ok); return { ok }; }
    try {
      const { customerInfo } = await this._rc.restorePurchases();
      const ok = this._entitled(customerInfo); this._set(ok);
      track('iap.restored', { ok });
      return { ok };
    } catch(err){ track('iap.error', { where:'restore', msg:String(err && err.message || err) }); return { ok:false }; }
  },
};

/* ── Staff with a single note (treble or bass) ── */
function Staff({ clef, step }){
  const W = 320, H = 150, x0 = 24, x1 = W-16, noteX = 220;
  const def = CLEFS[clef];
  const lines = [0,1,2,3,4].map(i => 40 + i*LS);   // 5 staff lines
  const y = yForStep(step);
  const stemUp = step < 4;                          // notes at/above the middle line get downward stems
  const stemY = stemUp ? y - 44 : y + 44;
  const ledgers = [];                               // every staff-line position between staff edge and the note
  for (let s = 10; s <= step; s += 2) ledgers.push(s);
  for (let s = -2; s >= step; s -= 2) ledgers.push(s);
  return e('svg',{ viewBox:`0 0 ${W} ${H}`, width:'100%',
      style:{ display:'block', maxWidth:W, margin:'0 auto', transform:'translateZ(0)', WebkitTransform:'translateZ(0)' } },
    // staff lines
    lines.map((ly,i)=>e('line',{ key:i, x1:x0, y1:ly, x2:x1, y2:ly, stroke:'var(--staff)', strokeWidth:1.6 })),
    // clef glyph (decorative — serif fonts render it; game works regardless)
    e('text',{ x:x0+6, y:def.glyphY, fontSize:def.glyphSize, fill:'var(--staff)', style:{fontFamily:'Georgia,"Times New Roman",serif'} }, def.glyph),
    // ledger lines through the note when needed
    ledgers.map((s,i)=>e('line',{ key:'l'+i, x1:noteX-16, y1:yForStep(s), x2:noteX+16, y2:yForStep(s), stroke:'var(--staff)', strokeWidth:1.6 })),
    // note head
    e('ellipse',{ cx:noteX, cy:y, rx:11, ry:8.5, fill:'var(--note)', stroke:'var(--note)' }),
    // stem (up on the right, down on the left, per convention)
    e('line',{ x1:noteX + (stemUp?10:-10), y1: stemUp ? y-2 : y+2, x2:noteX + (stemUp?10:-10), y2:stemY, stroke:'var(--note)', strokeWidth:2.4 })
  );
}

/* ── Upgrade sheet (RevenueCat purchase + restore) ── */
function UpgradeSheet({ onClose }){
  const [busy, setBusy] = React.useState('');   // '' | 'buy' | 'restore'
  const [msg, setMsg]   = React.useState('');
  const run = async (kind, fn, failMsg) => {
    if (busy) return;
    setBusy(kind); setMsg('');
    const r = await fn();
    setBusy('');
    if (r && r.ok) onClose();                    // entitlement flows in via IAP.subscribe
    else if (!(r && r.cancelled)) setMsg(failMsg);
  };
  return e('div',{ onClick:()=> busy || onClose(), style:{ position:'fixed', inset:0, background:'rgba(20,10,40,.55)', display:'flex', alignItems:'flex-end', zIndex:50 } },
    e('div',{ onClick:ev=>ev.stopPropagation(), style:{ width:'100%', maxWidth:560, margin:'0 auto', background:'var(--bg2)', borderRadius:'20px 20px 0 0', padding:'22px 20px 30px', border:'1px solid var(--border)' } },
      e('div',{style:{width:42,height:5,borderRadius:3,background:'var(--border)',margin:'0 auto 16px'}}),
      e('div',{style:{fontSize:'1.25rem',fontWeight:800,marginBottom:6}},'Unlock Pro 🎉'),
      e('div',{style:{fontSize:'.95rem',color:'var(--hint)',marginBottom:18,lineHeight:1.5}},
        'Pro adds the bass clef, harder notes (ledger lines & middle C), game modes (Timed & Lives), and sharps & flats. One price, forever — no subscription.'),
      msg ? e('div',{style:{fontSize:'.85rem',color:'var(--bad)',marginBottom:12,fontWeight:600}}, msg) : null,
      e('button',{ onClick:()=>run('buy', ()=>IAP.purchase(), 'Purchase didn’t complete. Please try again.'), disabled:!!busy,
        style:{ width:'100%', padding:16, borderRadius:14, cursor:busy?'default':'pointer', opacity:busy&&busy!=='buy'?.6:1, fontWeight:800, fontSize:'1.05rem', background:'var(--accent)', border:'none', color:'#fff' } },
        busy==='buy' ? 'Unlocking…' : 'Unlock Pro — ' + PRICE),
      e('button',{ onClick:()=>run('restore', ()=>IAP.restore(), 'No previous purchase found.'), disabled:!!busy,
        style:{ width:'100%', padding:11, marginTop:10, borderRadius:12, cursor:busy?'default':'pointer', fontWeight:700, background:'transparent', border:'1px solid var(--border)', color:'var(--txt)' } },
        busy==='restore' ? 'Restoring…' : 'Restore purchase'),
      e('button',{ onClick:()=> busy || onClose(), style:{ width:'100%', padding:12, marginTop:8, borderRadius:12, cursor:'pointer', fontWeight:700, background:'transparent', border:'none', color:'var(--hint)' } }, 'Keep playing free')
    )
  );
}

/* ── Results screen (shown when a timed/lives run ends) ── */
function Results({ card, reason, score, correct, answered, runBest, best, stickers, onAgain }){
  const acc = answered ? Math.round(correct/answered*100) : 0;
  const tile = (val,lbl) => e('div',{style:{textAlign:'center',flex:1}},
    e('div',{style:{fontSize:'1.4rem',fontWeight:800}}, val),
    e('div',{style:{fontSize:'.62rem',color:'var(--hint)',letterSpacing:'.05em',marginTop:2}}, lbl));
  return e('div',{ style:{...card, textAlign:'center'} },
    e('div',{style:{fontSize:'2.2rem'}}, '🎉'),
    e('div',{style:{fontSize:'1.3rem',fontWeight:900,margin:'2px 0 2px'}}, reason),
    e('div',{style:{fontSize:'.85rem',color:'var(--hint)',marginBottom:14}}, 'Great practicing!'),
    e('div',{style:{display:'flex',marginBottom:16}},
      tile('⭐ '+score,'SCORE'), tile(correct+'/'+answered,'CORRECT'),
      tile(acc+'%','ACCURACY'), tile('🔥 '+runBest,'BEST STREAK')),
    e('div',{style:{fontSize:'.7rem',color:'var(--hint)',letterSpacing:'.06em',marginBottom:8}}, 'STICKER SHELF'),
    e('div',{style:{display:'flex',justifyContent:'center',gap:10,marginBottom:18,flexWrap:'wrap'}},
      STICKERS.map(s => { const got = stickers.has(s.at);
        return e('div',{ key:s.at, title:s.label+' — streak '+s.at,
          style:{ display:'flex',flexDirection:'column',alignItems:'center',width:52,opacity:got?1:.32,
            filter:got?'none':'grayscale(1)' }},
          e('div',{style:{fontSize:'1.7rem'}}, got?s.emoji:'🔒'),
          e('div',{style:{fontSize:'.58rem',color:'var(--hint)',marginTop:2}}, s.at));
      })),
    e('button',{ onClick:onAgain, style:{ width:'100%', padding:15, borderRadius:14, cursor:'pointer',
      fontWeight:800, fontSize:'1.05rem', background:'var(--accent)', border:'none', color:'#fff' } }, 'Play again ▶')
  );
}

const LETTERS = ['C','D','E','F','G','A','B'];

function App(){
  const [pro, setPro]     = React.useState(() => IAP.isPro || localStorage.getItem('nq-pro') === '1');
  const [clefMode, setClefMode] = React.useState(() => localStorage.getItem('nq-clef') || 'treble');
  const [mode, setMode]   = React.useState(() => localStorage.getItem('nq-mode') || 'endless');
  const [theme, setTheme] = React.useState(() => localStorage.getItem('nq-theme') || 'light');
  const [best,  setBest]  = React.useState(() => +(localStorage.getItem('nq-best') || 0));
  const [stickers, setStickers] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nq-stickers') || '[]')); } catch(_) { return new Set(); }
  });
  const [score, setScore] = React.useState(0);
  const [streak,setStreak]= React.useState(0);
  const [answered,setAnswered] = React.useState(0);
  const [correct, setCorrect]  = React.useState(0);
  const [runBest, setRunBest]  = React.useState(0);
  const [timeLeft,setTimeLeft] = React.useState(MODES.timed.seconds);
  const [lives, setLives]      = React.useState(MODES.lives.lives);
  const [phase, setPhase]      = React.useState('play');   // 'play' | 'results'
  const [fb, setFb]       = React.useState(null);   // {ok, letter} feedback flash, or null
  const [reward, setReward] = React.useState(null); // milestone celebration, or null
  const [upg, setUpg]     = React.useState(false);
  const isPro = pro;

  // clef & non-endless modes are Pro features; free users are pinned to treble/endless
  const effClef = isPro ? clefMode : 'treble';
  const effMode = isPro ? mode : 'endless';
  const pool = React.useMemo(() => buildPool(isPro, effClef), [isPro, effClef]);
  const pick = React.useCallback(() => pool[(Math.random()*pool.length)|0], [pool]);
  const [q, setQ] = React.useState(() => buildPool(false,'treble')[(Math.random()*9)|0]);

  // entitlement: hydrate from RevenueCat (or web fallback) and stay subscribed
  React.useEffect(()=>{ const off = IAP.subscribe(setPro); IAP.init(); return off; },[]);
  React.useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem('nq-theme',theme); },[theme]);
  React.useEffect(()=>{ localStorage.setItem('nq-clef',clefMode); },[clefMode]);
  React.useEffect(()=>{ localStorage.setItem('nq-mode',mode); },[mode]);
  React.useEffect(()=>{ track('app.loaded'); },[]);
  // when the pool changes (level / clef mode), serve a fresh question — without ending the run
  React.useEffect(()=>{ setFb(null); setQ(pick()); },[pick]);

  // start a fresh run for the current mode
  const startRun = React.useCallback(() => {
    setScore(0); setStreak(0); setAnswered(0); setCorrect(0); setRunBest(0);
    setTimeLeft(MODES.timed.seconds); setLives(MODES.lives.lives);
    setFb(null); setReward(null); setPhase('play'); setQ(pick());
  }, [pick]);

  // countdown for timed mode
  React.useEffect(()=>{
    if (phase!=='play' || effMode!=='timed') return;
    if (timeLeft<=0){ setPhase('results'); track('run.ended',{mode:'timed'}); return; }
    const id = setTimeout(()=> setTimeLeft(t=>t-1), 1000);
    return ()=>clearTimeout(id);
  },[phase, effMode, timeLeft]);

  const note = CLEFS[q.clef].steps[q.step];

  // milestone celebration + sticker unlock
  const celebrate = (ns) => {
    let s = null;
    for (const st of STICKERS) if (ns >= st.at) s = st;
    const particles = Array.from({length:16}, (_,i)=>(
      { x:(Math.random()*100).toFixed(1), d:(Math.random()*0.35).toFixed(2), emoji:CONFETTI[i%CONFETTI.length] }));
    setReward({ sticker:s, streak:ns, particles });
    if (s && !stickers.has(s.at)){
      setStickers(prev => { const n = new Set(prev); n.add(s.at);
        localStorage.setItem('nq-stickers', JSON.stringify([...n])); return n; });
      track('sticker.earned', { at:s.at });
    }
    setTimeout(()=> setReward(null), 1400);
  };

  const answer = (letter) => {
    if (fb || phase!=='play') return;     // ignore taps during flash / results
    const ok = letter === note.l;
    tone(midiOf(note));
    setFb({ ok, letter });
    setAnswered(a => a+1);
    let outOfLives = false;
    if (ok){
      const ns = streak + 1;
      setStreak(ns); setCorrect(c => c+1); setScore(s => s + 10 + streak*2);
      setRunBest(b => Math.max(b, ns));
      if (ns > best){ setBest(ns); localStorage.setItem('nq-best', ns); }
      if (ns % 5 === 0) celebrate(ns);
    } else {
      setStreak(0);
      track('note.missed', { note: note.l + note.o, clef: q.clef });
      if (effMode==='lives'){ const nl = lives-1; setLives(nl); outOfLives = nl<=0; }
    }
    setTimeout(()=>{
      setFb(null);
      if (outOfLives){ setPhase('results'); track('run.ended',{mode:'lives'}); }
      else setQ(pick());
    }, ok ? 520 : 1100);
  };

  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:18, padding:16, marginBottom:14 };
  const stat = (icon,val,lbl,danger) => e('div',{style:{textAlign:'center',flex:1}},
    e('div',{style:{fontSize:'1.3rem',fontWeight:800,color:danger?'var(--bad)':'var(--txt)'}}, icon+' '+val),
    e('div',{style:{fontSize:'.66rem',color:'var(--hint)',letterSpacing:'.05em',marginTop:2}}, lbl));

  // contextual third stat depends on the active mode
  const thirdStat = effMode==='timed' ? stat('⏱', timeLeft, 'TIME', timeLeft<=10)
                  : effMode==='lives' ? stat('❤', lives, 'LIVES', lives<=1)
                  : stat('🏆', best, 'BEST');

  // pill selector helper — options may be Pro-gated (tapping when locked opens the paywall)
  const pill = (curr, opt, label, locked, onPick) => {
    const active = curr === opt && !locked;
    return e('button',{ key:opt,
      onClick:()=>{ if (locked){ setUpg(true); track('paywall.shown',{feature:label}); } else onPick(opt); },
      style:{ flex:1, padding:'8px 0', borderRadius:10, cursor:'pointer', fontSize:'.76rem', fontWeight:800,
        border:'1px solid var(--border)', background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : (locked ? 'var(--hint)' : 'var(--txt)') } },
      label + (locked ? ' 🔒' : ''));
  };

  return e(React.Fragment, null,
    e('header',{style:{display:'flex',alignItems:'center',gap:10,padding:'16px 0 10px'}},
      e('div',{style:{fontSize:'1.25rem',fontWeight:900,letterSpacing:'-.01em'}},'Note Quest'),
      e('div',{style:{flex:1}}),
      isPro
        ? e('div',{ style:{ padding:'5px 10px', borderRadius:20, fontSize:'.72rem', fontWeight:800,
            background:'var(--accent)', color:'#fff' } }, 'Pro ✦')
        : e('button',{ onClick:()=>{ setUpg(true); track('paywall.shown',{feature:'header'}); },
            style:{ padding:'5px 10px', borderRadius:20, cursor:'pointer', fontSize:'.72rem', fontWeight:800,
              border:'1px solid var(--accent)', background:'transparent', color:'var(--accent)' } }, 'Unlock ✦'),
      e('button',{ onClick:()=>setTheme(theme==='light'?'dark':'light'),
        style:{ padding:'5px 9px', borderRadius:20, cursor:'pointer', fontSize:'.85rem', border:'1px solid var(--border)', background:'transparent', color:'var(--txt)' } },
        theme==='light'?'☾':'☀')
    ),

    e('div',{style:{...card, display:'flex'}}, stat('⭐',score,'SCORE'), stat('🔥',streak,'STREAK'), thirdStat),

    phase==='results'
      ? e(Results,{ card,
          reason: effMode==='timed' ? "Time's up!" : 'Out of lives!',
          score, correct, answered, runBest, best, stickers,
          onAgain: startRun })
      : e(React.Fragment, null,
          // mode selector — timed/lives are Pro
          e('div',{style:{display:'flex',gap:6,marginBottom:10}},
            Object.keys(MODES).map(m => pill(effMode, m, MODES[m].name + ' ' + MODES[m].icon,
              !isPro && MODES[m].pro, (v)=>{ setMode(v); startRun(); }))),
          // clef selector — bass/both are Pro
          e('div',{style:{display:'flex',gap:6,marginBottom:14}},
            ['treble','bass','both'].map(c => pill(effClef, c, CLEFS[c] ? CLEFS[c].name : 'Both',
              !isPro && c!=='treble', setClefMode))),

          e('div',{style:{...card, position:'relative', overflow:'hidden'}},
            e(Staff,{ clef:q.clef, step:q.step }),
            e('div',{style:{textAlign:'center',fontSize:'.85rem',color:'var(--hint)',marginTop:4}}, 'What note is this?'),
            // plain correct/wrong flash (suppressed during a milestone celebration)
            (fb && !reward) ? e('div',{style:{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', borderRadius:18,
                background: fb.ok?'rgba(34,197,94,.16)':'rgba(239,68,68,.16)' }},
                e('div',{style:{fontSize:'2.4rem'}}, fb.ok?'✅':'❌'),
                !fb.ok ? e('div',{style:{fontWeight:800,marginTop:4}}, 'It was '+note.l) : null
              ) : null,
            // milestone reward burst: falling confetti + a popping sticker badge
            reward ? e('div',{style:{ position:'absolute', inset:0, pointerEvents:'none', borderRadius:18,
                background:'rgba(124,77,255,.10)' }},
                reward.particles.map((p,i)=>e('span',{ key:i, style:{ position:'absolute', left:p.x+'%', top:'-8px',
                  fontSize:'1.2rem', animation:`nq-fall 1.2s ${p.d}s ease-in forwards` } }, p.emoji)),
                reward.sticker ? e('div',{style:{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center' }},
                    e('div',{style:{fontSize:'3rem', animation:'nq-badge .6s ease-out both'}}, reward.sticker.emoji),
                    e('div',{style:{fontWeight:900, fontSize:'1.05rem', color:'var(--accent)', animation:'nq-pop .5s ease-out both'}}, reward.sticker.label),
                    e('div',{style:{fontWeight:700, color:'var(--hint)', fontSize:'.85rem'}}, reward.streak+' streak!')
                  ) : null
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
            'Bass clef, game modes & more 🔒') : e('div',{style:{height:30}})
        ),

    upg ? e(UpgradeSheet,{ onClose:()=>setUpg(false) }) : null
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));
