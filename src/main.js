import { BleClient } from '@capacitor-community/bluetooth-le';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';

const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e', TXU = '6e400003-b5a3-f393-e0a9-e50e24dcca9e', RXU = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const $ = s => document.querySelector(s);
let DB = {}; try { DB = JSON.parse(localStorage.rhDB) || {}; } catch (e) {}
DB.ss = DB.ss || []; DB.subs = DB.subs || ['Arabic', 'Math', 'English', 'Physics', 'Chemistry'];
const save = () => { try { localStorage.rhDB = JSON.stringify(DB); } catch (e) { toast('التخزين ممتلئ'); } };
let ses = DB.ss.find(s => s.id === DB.active) || null, armed = !!ses, lastT = 0, id = null, buf = '', manual = false, busy = false, tries = 0;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const g2 = cs => { const s = cs / 100; return s < 60 ? s.toFixed(1) : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const hms = cs => { const s = Math.floor(cs / 100); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const wait = ms => new Promise(r => setTimeout(r, ms));
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2400); }
function term(l) { const t = $('#term'); t.textContent += l + '\n'; if (t.textContent.length > 6000) t.textContent = t.textContent.slice(-4000); t.scrollTop = t.scrollHeight; }

function render() {
  const c = ses ? ses.count : 0, gs = ses ? ses.gaps.filter(g => g > 0) : [], avg = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;
  $('#cnt').textContent = c; $('#tot').textContent = ses ? hms(ses.total) : '0:00:00'; $('#avg').textContent = gs.length ? g2(avg) : '-';
  if (ses) $('#name').value = ses.sub;
  $('#name').disabled = !!ses; $('#rst').disabled = !ses;
  $('#go').textContent = ses ? 'إيقاف' : 'ابدأ'; $('#go').classList.toggle('run', !!ses);
  $('#chips').innerHTML = DB.subs.map(s => `<button class="chip${s === $('#name').value.trim() ? ' sel' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  const g = gs.slice(-24), mx = Math.max(1, ...g); let h = '';
  g.forEach((v, i) => { const hh = Math.max(5, v / mx * 72), r = v / avg, col = r < .8 ? '#29D9C2' : r > 1.25 ? '#FF6B8B' : '#DCE6FF';
    h += `<rect x="${i * 13 + 6}" y="${84 - hh}" width="8" height="${hh}" rx="4" fill="${col}"${i === g.length - 1 ? ' class="nw"' : ''}/>`; });
  if (g.length) { const y = 84 - avg / mx * 72; h += `<line x1="0" x2="320" y1="${y}" y2="${y}" stroke="#FFB627" stroke-dasharray="3 5" opacity=".7"/>`; }
  $('#strip').innerHTML = h || '<text x="160" y="52" text-anchor="middle" fill="#7C86B8" font-size="12">الإيقاع هيظهر هنا مع أول ضغطات</text>';
  const tot = {}; DB.ss.forEach(s => tot[s.sub] = (tot[s.sub] || 0) + s.total); const mT = Math.max(1, ...Object.values(tot));
  $('#subtot').innerHTML = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="sb"><i style="width:${v / mT * 100}%"></i><span>${esc(k)}</span><b class="num">${hms(v)}</b></div>`).join('') || '<p class="mut">لسه مفيش بيانات.</p>';
  $('#hist').innerHTML = DB.ss.slice().sort((a, b) => b.upd - a.upd).map(s => `<div class="hi"><div><b>${esc(s.sub)}</b><small class="num">${s.count} ضغطة | ${hms(s.total)} | ${new Date(s.upd).toLocaleDateString('en-GB')}</small></div><button data-d="${s.id}" aria-label="مشاركة">⤴</button><button data-x="${s.id}" aria-label="حذف">🗑</button></div>`).join('') || '<p class="mut">ابدأ أول جلسة من تبويب الجلسة.</p>';
}

function begin(n, old) {
  if (!DB.subs.includes(n)) DB.subs.push(n);
  ses = old || { id: Date.now(), sub: n, count: 0, total: 0, gaps: [], upd: Date.now() };
  if (!old) DB.ss.push(ses);
  armed = true; DB.active = ses.id; save(); KeepAwake.keepAwake().catch(() => {}); render(); toast('بدأت: ' + n);
}
async function stop() {
  const s = ses; ses = null; DB.active = null; save(); KeepAwake.allowSleep().catch(() => {}); render(); await saveCsv(s, false);
}
$('#go').onclick = () => {
  if (ses) return stop();
  const n = $('#name').value.trim(); if (!n) { toast('اكتب اسم المادة الأول'); $('#name').focus(); return; }
  const old = DB.ss.filter(s => s.sub === n).sort((a, b) => b.upd - a.upd)[0];
  if (!old) return begin(n, null);
  $('#mt').textContent = `${n}: جلسة سابقة (${old.count} ضغطة، ${hms(old.total)})`; $('#md')._o = old; $('#md').classList.add('on');
};
$('#md').onclick = e => { const a = e.target.dataset.a, o = $('#md')._o; if (!a && e.target !== $('#md')) return; $('#md').classList.remove('on'); if (a === 'cont') begin(o.sub, o); else if (a === 'new') begin(o.sub, null); };
$('#rst').onclick = () => { if (ses && confirm('تصفير الجلسة دي؟')) { ses.count = 0; ses.total = 0; ses.gaps = []; armed = true; save(); render(); } };
$('#chips').onclick = e => { const s = e.target.dataset.s; if (s && !ses) { $('#name').value = s; render(); } };
$('#name').oninput = () => render();
$('#hist').onclick = e => { const d = e.target.dataset.d, x = e.target.dataset.x;
  if (d) saveCsv(DB.ss.find(s => s.id == d), true);
  if (x && confirm('حذف الجلسة دي؟')) { DB.ss = DB.ss.filter(s => s.id != x); if (ses && ses.id == x) { ses = null; DB.active = null; } save(); render(); } };
$('#nav').onclick = e => { const v = e.target.dataset.v; if (!v) return; document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === v)); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); };

function csv(s) { let t = 0; const r = ['click,gap_s,total_s']; s.gaps.forEach((g, i) => { t += g; r.push((i + 1) + ',' + (g / 100).toFixed(2) + ',' + (t / 100).toFixed(2)); });
  r.push('', 'subject,' + s.sub, 'clicks,' + s.count, 'total,' + hms(s.total) + ' (' + (s.total / 100).toFixed(2) + ' s)'); return '\ufeff' + r.join('\n'); }
async function saveCsv(s, share) {
  if (!s) return; const d = new Date(s.upd), p = n => String(n).padStart(2, '0');
  const name = s.sub.replace(/[\\/:*?"<>|]/g, '_') + '_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.csv'; let uri;
  try { uri = (await Filesystem.writeFile({ path: 'ClickTracker/' + name, data: csv(s), directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true })).uri; toast('اتحفظ: Documents/ClickTracker/' + name); }
  catch (e) { try { uri = (await Filesystem.writeFile({ path: name, data: csv(s), directory: Directory.Cache, encoding: Encoding.UTF8 })).uri; share = true; } catch (e2) { toast('تعذر الحفظ'); return; } }
  if (share) Share.share({ title: name, url: uri }).catch(() => {});
}

function onClick(gap, first) {
  lastT = Date.now(); let g = gap, f = first;
  if (ses && armed) { g = 0; f = true; armed = false; }
  $('#prev').textContent = f ? 'أول ضغطة' : 'آخر فاصل ' + g2(g) + ' ث';
  if (ses) { ses.total += g; ses.count++; ses.gaps.push(g); ses.upd = Date.now(); save(); render(); } else toast('ابدأ جلسة عشان الضغطات تتسجل');
  const b = $('#big'); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 160);
  const r = $('#rip'); r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}
setInterval(() => { if (!lastT) return; const ms = Date.now() - lastT, s = ms / 1000; $('#big').textContent = s < 60 ? s.toFixed(1) : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }, 100);

function line(l) { term(l); const m = /CLICK #\d+ \| gap=([\d.]+)s/.exec(l); if (m) onClick(Math.round(parseFloat(m[1]) * 100), /first after boot/.test(l)); }
function onData(v) { buf += new TextDecoder().decode(v); const p = buf.split('\n'); buf = p.pop(); p.forEach(l => l.trim() && line(l.trim())); }
async function send(c) {
  if (!id) { toast('مش متوصل بالجهاز'); return; } term('> ' + c); const b = new TextEncoder().encode(c + '\n');
  try { for (let i = 0; i < b.length; i += 20) await BleClient.writeWithoutResponse(id, NUS, RXU, new DataView(b.slice(i, i + 20).buffer)); } catch (e) { toast('فشل الإرسال'); }
}
function setLink(s) { $('#led').className = 'led' + (s ? ' s' + s : ''); $('#dst').textContent = ['غير متصل', 'بيدوّر على الجهاز...', 'متصل'][s]; $('#conn').textContent = s === 2 ? 'قطع الاتصال' : 'اتصل'; }
async function link() {
  if (busy || id) return; busy = true; setLink(1);
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
    let found = null;
    await BleClient.requestLEScan({ services: [NUS] }, r => { if (!found) found = r.device.deviceId; });
    for (let i = 0; i < 60 && !found; i++) await wait(200);
    await BleClient.stopLEScan().catch(() => {});
    if (!found) throw new Error('not found');
    await BleClient.connect(found, () => { id = null; setLink(0); if (!manual) setTimeout(retry, 2500); });
    await BleClient.startNotifications(found, NUS, TXU, onData);
    id = found; tries = 0; setLink(2); toast('اتوصل بالجهاز'); send('STATUS');
  } catch (e) { setLink(0); if (!manual) setTimeout(retry, 4000); }
  busy = false;
}
function retry() { if (!manual && !id && tries++ < 20) link(); }
$('#led').onclick = $('#conn').onclick = async () => {
  if (id) { manual = true; await BleClient.disconnect(id).catch(() => {}); id = null; setLink(0); }
  else { manual = false; tries = 0; link(); }
};
$('#q').onclick = e => { const c = e.target.dataset.c; if (c) send(c); if (e.target.id === 'clr' && confirm('مسح لوج الجهاز بالكامل؟')) send('RESET_LOG YES'); };
$('#tf').onsubmit = e => { e.preventDefault(); const v = $('#cmd').value.trim(); if (v) { send(v); $('#cmd').value = ''; } };

render(); if (ses) KeepAwake.keepAwake().catch(() => {}); setTimeout(link, 600);
