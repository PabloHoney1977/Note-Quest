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
      const res = await this._rc.getOfferings();       // plugin returns the offerings object directly
      const offerings = (res && res.offerings) ? res.offerings : res;
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

/* ── Staff with a single note (treble or bass), optional accidental ── */
function Staff({ clef, step, acc }){
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
    // accidental glyph, to the left of the note head
    acc ? e('text',{ x:noteX-16, y:y+8, fontSize:26, fill:'var(--note)', textAnchor:'end',
      style:{ fontFamily:'Georgia,"Times New Roman",serif', fontWeight:700 } }, acc===1?'♯':'♭') : null,
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

/* ── Instrument Workshop ──
 * A persistent crafting/collection loop layered on the game (free, kid retention hook).
 * Correct answers accumulate toward build stages; finished instruments go on a shelf. */
const MATERIALS = [
  { key:'wood',   name:'Wood',   body:'#C8843C', edge:'#8A5A24', accent:'#E0A868' },
  { key:'brass',  name:'Brass',  body:'#E3B23C', edge:'#9C7A18', accent:'#FFE08A' },
  { key:'cherry', name:'Cherry', body:'#E23B3B', edge:'#A11F1F', accent:'#FF7A7A' },
  { key:'sky',    name:'Sky',    body:'#3BA0E2', edge:'#1E6DA6', accent:'#8AD1FF' },
];
const WS_INSTRUMENTS = [
  { key:'guitar', name:'Guitar', emoji:'🎸' },
  { key:'violin', name:'Violin', emoji:'🎻' },
  { key:'banjo',  name:'Banjo',  emoji:'🪕' },
];
// build stages in order; `cost` = correct answers needed to unlock, `choose` = a player choice.
const BUILD_STAGES = [
  { key:'pick',    cost:5, choose:'instrument', title:'Pick an instrument to build' },
  { key:'body',    cost:4, choose:'material',   title:'Cut & shape the body' },
  { key:'neck',    cost:4, title:'Attach the neck' },
  { key:'hole',    cost:5, title:'Cut the sound hole' },
  { key:'strings', cost:6, title:'String it up!' },
];
const freshBuild = () => ({ instrument:null, material:'wood', step:0, prog:0 });
const matOf  = (k) => MATERIALS.find(m => m.key===k) || MATERIALS[0];
const instOf = (k) => WS_INSTRUMENTS.find(i => i.key===k) || WS_INSTRUMENTS[0];
const NECK_C = '#6B4A2A', NECK_E = '#4A3016', HEAD_C = '#7C4DFF';

/* Layered SVG instrument. level: 0 outline · 1 body · 2 +neck · 3 +hole · 4 +strings (done). */
function Instrument({ kind, mat, level, size }){
  const w = size || 130, h = w * 300/160, m = matOf(mat), p = [];
  if (level >= 2){                                    // neck + headstock (drawn first, body overlaps its base)
    p.push(e('rect',{ key:'hs', x:63, y:20, width:34, height:34, rx:6, fill:HEAD_C, stroke:'#5a2fd0', strokeWidth:2 }));
    [28,40].forEach((py,i)=>p.push(
      e('circle',{ key:'pl'+i, cx:58, cy:py, r:3.4, fill:'#eee' }),
      e('circle',{ key:'pr'+i, cx:102, cy:py, r:3.4, fill:'#eee' })));
    p.push(e('rect',{ key:'neck', x:70, y:44, width:20, height:112, fill:NECK_C, stroke:NECK_E, strokeWidth:2 }));
    for (let fy=64, i=0; fy<150; fy+=16, i++) p.push(e('line',{ key:'fr'+i, x1:70, y1:fy, x2:90, y2:fy, stroke:NECK_E, strokeWidth:1.5 }));
  }
  if (level >= 1){                                    // body
    if (kind==='banjo'){
      p.push(e('circle',{ key:'b', cx:80, cy:222, r:54, fill:m.body, stroke:m.edge, strokeWidth:4 }));
      p.push(e('circle',{ key:'bh', cx:80, cy:222, r:40, fill:'#F4ECD8', stroke:m.edge, strokeWidth:2 }));
    } else if (kind==='violin'){
      p.push(e('path',{ key:'b', d:'M80 150 C 55 150 48 176 54 190 C 40 196 40 214 52 222 C 42 232 44 258 66 268 C 74 273 86 273 94 268 C 116 258 118 232 108 222 C 120 214 120 196 106 190 C 112 176 105 150 80 150 Z', fill:m.body, stroke:m.edge, strokeWidth:3.5 }));
    } else {
      p.push(e('path',{ key:'b', d:'M80 150 C 52 150 44 178 52 196 C 38 206 36 236 54 258 C 66 272 94 272 106 258 C 124 236 122 206 108 196 C 116 178 108 150 80 150 Z', fill:m.body, stroke:m.edge, strokeWidth:3.5 }));
    }
  }
  if (level >= 3){                                    // sound hole(s)
    if (kind==='violin'){
      ['M64 206 q -5 6 0 12 q 5 6 0 12','M96 206 q -5 6 0 12 q 5 6 0 12'].forEach((d,i)=>
        p.push(e('path',{ key:'f'+i, d, fill:'none', stroke:m.edge, strokeWidth:3, strokeLinecap:'round' })));
    } else {
      p.push(e('circle',{ key:'h', cx:80, cy:221, r:14, fill:'#231a12' }),
             e('circle',{ key:'hr', cx:80, cy:221, r:14, fill:'none', stroke:m.accent, strokeWidth:2 }));
    }
  }
  if (level >= 4){                                    // strings + bridge
    p.push(e('rect',{ key:'br', x:66, y:248, width:28, height:6, rx:2, fill:NECK_E }));
    [72,77,83,88].forEach((sx,i)=>p.push(e('line',{ key:'s'+i, x1:sx, y1:30, x2:sx, y2:248, stroke:'#f4f4f4', strokeWidth:1, opacity:0.9 })));
  }
  if (level < 1)                                      // not-yet-built placeholder
    p.push(e('path',{ key:'ph', d:'M80 150 C 52 150 44 178 52 196 C 38 206 36 236 54 258 C 66 272 94 272 106 258 C 124 236 122 206 108 196 C 116 178 108 150 80 150 Z', fill:'none', stroke:'var(--border)', strokeWidth:3, strokeDasharray:'6 6' }));
  return e('svg',{ viewBox:'0 0 160 300', width:w, height:h, style:{ display:'block', margin:'0 auto' } }, p);
}

/* Full-screen modal shown when a build stage unlocks — a choice, a part reveal, or completion. */
function WorkshopModal({ ws, build, onInstrument, onMaterial, onClose }){
  const overlay = { position:'fixed', inset:0, background:'rgba(20,10,40,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:20 };
  const card = { width:'100%', maxWidth:420, background:'var(--bg2)', borderRadius:20, padding:'22px 20px', border:'1px solid var(--border)', textAlign:'center' };
  if (ws.mode==='choice' && ws.kind==='instrument')
    return e('div',{style:overlay}, e('div',{style:card},
      e('div',{style:{fontSize:'1.6rem'}},'🔨'),
      e('div',{style:{fontSize:'1.2rem',fontWeight:900,margin:'4px 0'}},'Workshop unlocked!'),
      e('div',{style:{color:'var(--hint)',fontSize:'.9rem',marginBottom:16}},'Pick an instrument to build:'),
      e('div',{style:{display:'flex',gap:10,justifyContent:'center'}},
        WS_INSTRUMENTS.map(it=>e('button',{ key:it.key, onClick:()=>onInstrument(it.key),
          style:{ flex:1, padding:'14px 6px', borderRadius:14, cursor:'pointer', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--txt)', fontWeight:800 } },
          e('div',{style:{fontSize:'2rem'}},it.emoji), e('div',{style:{fontSize:'.8rem',marginTop:4}},it.name))))
    ));
  if (ws.mode==='choice' && ws.kind==='material')
    return e('div',{style:overlay}, e('div',{style:card},
      e('div',{style:{fontSize:'1.2rem',fontWeight:900,marginBottom:2}},'Cut the body'),
      e('div',{style:{color:'var(--hint)',fontSize:'.9rem',marginBottom:14}},'What should it be made of?'),
      e('div',{style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}},
        MATERIALS.map(mt=>e('button',{ key:mt.key, onClick:()=>onMaterial(mt.key),
          style:{ padding:'8px 2px', borderRadius:12, cursor:'pointer', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--txt)', fontWeight:700, fontSize:'.72rem' } },
          e(Instrument,{ kind:build.instrument, mat:mt.key, level:1, size:56 }), e('div',{style:{marginTop:2}},mt.name))))
    ));
  // reveal / completion
  const done = ws.done, it = instOf(done ? ws.finished.instrument : ws.kind);
  const mat = done ? ws.finished.material : ws.mat, level = done ? 4 : ws.level;
  return e('div',{style:overlay}, e('div',{style:card},
    e('div',{style:{fontSize:'1.15rem',fontWeight:900,marginBottom:8}}, done ? ('You built a '+it.name+'! 🎉') : (ws.stage.title+' ✓')),
    e(Instrument,{ kind:it.key, mat, level, size:150 }),
    done ? e('div',{style:{color:'var(--hint)',fontSize:'.85rem',marginTop:8}},'Added to your shelf. A new build starts as you keep going!') : null,
    e('button',{ onClick:onClose, style:{ width:'100%', marginTop:14, padding:14, borderRadius:14, cursor:'pointer', fontWeight:800, fontSize:'1rem', background:'var(--accent)', border:'none', color:'#fff' } }, done?'Awesome!':'Keep playing ▶')
  ));
}

/* Bottom sheet (opened from the header hammer) — current build progress + finished-instrument shelf. */
function WorkshopSheet({ build, shelf, onClose }){
  const stage = build.step < BUILD_STAGES.length ? BUILD_STAGES[build.step] : null;
  const level = Math.max(0, Math.min(4, build.step - 1));
  return e('div',{ onClick:onClose, style:{ position:'fixed', inset:0, background:'rgba(20,10,40,.55)', display:'flex', alignItems:'flex-end', zIndex:55 } },
    e('div',{ onClick:ev=>ev.stopPropagation(), style:{ width:'100%', maxWidth:560, margin:'0 auto', background:'var(--bg2)', borderRadius:'20px 20px 0 0', padding:'20px 20px 28px', border:'1px solid var(--border)', maxHeight:'82vh', overflowY:'auto' } },
      e('div',{style:{width:42,height:5,borderRadius:3,background:'var(--border)',margin:'0 auto 14px'}}),
      e('div',{style:{fontSize:'1.15rem',fontWeight:900,marginBottom:12}},'Instrument Workshop 🔨'),
      build.instrument
        ? e('div',{style:{display:'flex',gap:14,alignItems:'center',marginBottom:18}},
            e(Instrument,{ kind:build.instrument, mat:build.material, level, size:90 }),
            e('div',{style:{flex:1,textAlign:'left'}},
              e('div',{style:{fontWeight:800,marginBottom:4}}, instOf(build.instrument).name+' — in progress'),
              stage ? e('div',{style:{fontSize:'.8rem',color:'var(--hint)',marginBottom:8}}, 'Next: '+stage.title) : null,
              stage ? e('div',{style:{height:10,borderRadius:6,background:'var(--bg)',border:'1px solid var(--border)',overflow:'hidden'}},
                e('div',{style:{height:'100%',width:Math.round(build.prog/stage.cost*100)+'%',background:'var(--accent)'}})) : null,
              stage ? e('div',{style:{fontSize:'.72rem',color:'var(--hint)',marginTop:4}}, build.prog+' / '+stage.cost+' correct') : null))
        : e('div',{style:{fontSize:'.9rem',color:'var(--hint)',marginBottom:18}},'Answer notes correctly to start building — your first instrument unlocks at 5 right!'),
      e('div',{style:{fontSize:'.72rem',color:'var(--hint)',letterSpacing:'.06em',marginBottom:8}}, 'SHELF · '+shelf.length),
      shelf.length
        ? e('div',{style:{display:'flex',flexWrap:'wrap',gap:10}},
            shelf.map((it,i)=>e('div',{ key:i, style:{ width:70, textAlign:'center' } },
              e(Instrument,{ kind:it.instrument, mat:it.material, level:4, size:64 }),
              e('div',{style:{fontSize:'.62rem',color:'var(--hint)'}}, instOf(it.instrument).name))))
        : e('div',{style:{fontSize:'.85rem',color:'var(--hint)'}},'No finished instruments yet — keep playing!')
    ));
}

const LETTERS = ['C','D','E','F','G','A','B'];
const ACCIDENTALS = [['♮',0],['♯',1],['♭',-1]];
const accSym  = (a) => a===1 ? '♯' : a===-1 ? '♭' : '';
const noteName = (note, acc) => note.l + accSym(acc);
// which accidentals read naturally for a letter (skip E♯/B♯ = F/C and C♭/F♭ = B/E)
const canSharp = (l) => l!=='E' && l!=='B';
const canFlat  = (l) => l!=='C' && l!=='F';

function App(){
  const [pro, setPro]     = React.useState(() => IAP.isPro || localStorage.getItem('nq-pro') === '1');
  const [clefMode, setClefMode] = React.useState(() => localStorage.getItem('nq-clef') || 'treble');
  const [mode, setMode]   = React.useState(() => localStorage.getItem('nq-mode') || 'endless');
  const [accidentals, setAccidentals] = React.useState(() => localStorage.getItem('nq-acc') === '1');
  const [selAcc, setSelAcc] = React.useState(0);   // player's chosen accidental for the current answer
  const [theme, setTheme] = React.useState(() => localStorage.getItem('nq-theme') || 'light');
  const [best,  setBest]  = React.useState(() => +(localStorage.getItem('nq-best') || 0));
  const [stickers, setStickers] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nq-stickers') || '[]')); } catch(_) { return new Set(); }
  });
  const [build, setBuild] = React.useState(() => { try { return JSON.parse(localStorage.getItem('nq-build')) || freshBuild(); } catch(_) { return freshBuild(); } });
  const [shelf, setShelf] = React.useState(() => { try { return JSON.parse(localStorage.getItem('nq-shelf')) || []; } catch(_) { return []; } });
  const [workshop, setWorkshop] = React.useState(null);   // active workshop modal, or null
  const [wsOpen, setWsOpen]     = React.useState(false);   // workshop sheet open
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

  // clef, non-endless modes & accidentals are Pro features; free users are pinned to treble/endless/naturals
  const effClef = isPro ? clefMode : 'treble';
  const effMode = isPro ? mode : 'endless';
  const effAcc  = isPro && accidentals;
  const pool = React.useMemo(() => buildPool(isPro, effClef), [isPro, effClef]);
  // pick a {clef,step} and, when accidentals are on, sometimes attach a sensible sharp/flat
  const pick = React.useCallback(() => {
    const base = pool[(Math.random()*pool.length)|0];
    let acc = 0;
    if (effAcc){
      const L = CLEFS[base.clef].steps[base.step].l;
      const opts = []; if (canSharp(L)) opts.push(1); if (canFlat(L)) opts.push(-1);
      if (opts.length && Math.random() < 0.45) acc = opts[(Math.random()*opts.length)|0];
    }
    return { ...base, acc };
  }, [pool, effAcc]);
  const [q, setQ] = React.useState(() => ({ ...buildPool(false,'treble')[(Math.random()*9)|0], acc:0 }));

  // entitlement: hydrate from RevenueCat (or web fallback) and stay subscribed
  React.useEffect(()=>{ const off = IAP.subscribe(setPro); IAP.init(); return off; },[]);
  React.useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem('nq-theme',theme); },[theme]);
  React.useEffect(()=>{ localStorage.setItem('nq-clef',clefMode); },[clefMode]);
  React.useEffect(()=>{ localStorage.setItem('nq-mode',mode); },[mode]);
  React.useEffect(()=>{ localStorage.setItem('nq-acc', accidentals ? '1' : '0'); },[accidentals]);
  React.useEffect(()=>{ localStorage.setItem('nq-build', JSON.stringify(build)); },[build]);
  React.useEffect(()=>{ localStorage.setItem('nq-shelf', JSON.stringify(shelf)); },[shelf]);
  React.useEffect(()=>{ track('app.loaded'); },[]);
  // when the pool/accidentals change, serve a fresh question — without ending the run
  React.useEffect(()=>{ setFb(null); setSelAcc(0); setQ(pick()); },[pick]);

  // start a fresh run for the current mode
  const startRun = React.useCallback(() => {
    setScore(0); setStreak(0); setAnswered(0); setCorrect(0); setRunBest(0);
    setTimeLeft(MODES.timed.seconds); setLives(MODES.lives.lives);
    setFb(null); setReward(null); setSelAcc(0); setPhase('play'); setQ(pick());
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

  // workshop: each correct answer advances the current build; unlocks open a modal
  const advanceWorkshop = () => {
    if (build.step >= BUILD_STAGES.length) return;
    const stage = BUILD_STAGES[build.step];
    const prog = build.prog + 1;
    if (prog < stage.cost){ setBuild({ ...build, prog }); return; }
    if (stage.choose){ setBuild({ ...build, prog:0 }); setWorkshop({ mode:'choice', kind:stage.choose, stage }); return; }
    const nstep = build.step + 1;
    if (nstep >= BUILD_STAGES.length){                 // last part → finished instrument
      const finished = { instrument:build.instrument, material:build.material };
      setShelf(s => [...s, finished]); setBuild(freshBuild());
      setWorkshop({ mode:'reveal', done:true, finished }); track('instrument.built', finished);
    } else {
      setBuild({ ...build, prog:0, step:nstep });
      setWorkshop({ mode:'reveal', stage, level:Math.max(0, nstep-1), kind:build.instrument, mat:build.material });
      track('workshop.stage', { key:stage.key });
    }
  };
  const chooseInstrument = (key) => { setBuild(b => ({ ...b, instrument:key, step:1 })); setWorkshop(null); track('workshop.pick', { instrument:key }); };
  const chooseMaterial   = (key) => {
    setBuild(b => ({ ...b, material:key, step:2 }));
    setWorkshop({ mode:'reveal', stage:BUILD_STAGES[1], level:1, kind:build.instrument, mat:key });
    track('workshop.material', { material:key });
  };

  const answer = (letter) => {
    if (fb || phase!=='play') return;     // ignore taps during flash / results
    const ok = letter === note.l && selAcc === q.acc;   // letter and accidental must both match
    tone(midiOf(note) + q.acc);
    setFb({ ok, letter });
    setAnswered(a => a+1);
    let outOfLives = false;
    if (ok){
      const ns = streak + 1;
      setStreak(ns); setCorrect(c => c+1); setScore(s => s + 10 + streak*2);
      setRunBest(b => Math.max(b, ns));
      if (ns > best){ setBest(ns); localStorage.setItem('nq-best', ns); }
      if (ns % 5 === 0) celebrate(ns);
      advanceWorkshop();
    } else {
      setStreak(0);
      track('note.missed', { note: noteName(note, q.acc) + note.o, clef: q.clef });
      if (effMode==='lives'){ const nl = lives-1; setLives(nl); outOfLives = nl<=0; }
    }
    setTimeout(()=>{
      setFb(null);
      if (outOfLives){ setPhase('results'); track('run.ended',{mode:'lives'}); }
      else { setSelAcc(0); setQ(pick()); }
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
      e('button',{ onClick:()=>{ setWsOpen(true); track('workshop.opened'); }, title:'Instrument Workshop',
        style:{ padding:'5px 9px', borderRadius:20, cursor:'pointer', fontSize:'.85rem', border:'1px solid var(--border)', background:'transparent', color:'var(--txt)' } }, '🔨'),
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
          e('div',{style:{display:'flex',gap:6,marginBottom:10}},
            ['treble','bass','both'].map(c => pill(effClef, c, CLEFS[c] ? CLEFS[c].name : 'Both',
              !isPro && c!=='treble', setClefMode))),
          // sharps & flats toggle — Pro content tier
          e('button',{ onClick:()=>{ if (!isPro){ setUpg(true); track('paywall.shown',{feature:'accidentals'}); } else setAccidentals(a=>!a); },
            style:{ width:'100%', padding:'9px 0', borderRadius:10, marginBottom:14, cursor:'pointer', fontSize:'.76rem', fontWeight:800,
              border:'1px solid var(--border)', background: effAcc ? 'var(--accent)' : 'transparent',
              color: effAcc ? '#fff' : (!isPro ? 'var(--hint)' : 'var(--txt)') } },
            'Sharps & Flats ♯♭' + (effAcc ? '  ✓' : '') + (!isPro ? '  🔒' : '')),

          e('div',{style:{...card, position:'relative', overflow:'hidden'}},
            e(Staff,{ clef:q.clef, step:q.step, acc:q.acc }),
            e('div',{style:{textAlign:'center',fontSize:'.85rem',color:'var(--hint)',marginTop:4}}, 'What note is this?'),
            // plain correct/wrong flash (suppressed during a milestone celebration)
            (fb && !reward) ? e('div',{style:{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', borderRadius:18,
                background: fb.ok?'rgba(34,197,94,.16)':'rgba(239,68,68,.16)' }},
                e('div',{style:{fontSize:'2.4rem'}}, fb.ok?'✅':'❌'),
                !fb.ok ? e('div',{style:{fontWeight:800,marginTop:4}}, 'It was '+noteName(note, q.acc)) : null
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

          // accidental picker — set this to match the ♯/♭/♮ before tapping the letter
          effAcc ? e('div',{style:{display:'flex',gap:6,margin:'0 auto 8px',maxWidth:260}},
            ACCIDENTALS.map(([sym,val]) => e('button',{ key:val, onClick:()=>setSelAcc(val),
              style:{ flex:1, padding:'10px 0', borderRadius:12, cursor:'pointer', fontSize:'1.35rem', fontWeight:800,
                border:'1px solid '+(selAcc===val?'var(--accent)':'var(--border)'),
                background: selAcc===val?'var(--accent)':'var(--bg2)', color: selAcc===val?'#fff':'var(--txt)' } }, sym))
          ) : null,

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

    upg ? e(UpgradeSheet,{ onClose:()=>setUpg(false) }) : null,
    workshop ? e(WorkshopModal,{ ws:workshop, build, onInstrument:chooseInstrument, onMaterial:chooseMaterial, onClose:()=>setWorkshop(null) }) : null,
    wsOpen ? e(WorkshopSheet,{ build, shelf, onClose:()=>setWsOpen(false) }) : null
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(e(App));
