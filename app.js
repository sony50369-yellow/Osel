// OSEL – Oseltamivir dosing helper v3.2 (bugfixed)
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const state = { doseMg:null, freqPerDay:null, isAdult:false, crcl:null, hd:false, hdSessions:0 };

const num = (id, fb) => {
  const el = $(id); if(!el) return fb;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : fb;
};

function computeCrCl(ageY, wt, sex, scr){
  if(!Number.isFinite(scr) || scr<=0) return null;
  let crcl = ((140 - ageY) * wt) / (72 * scr);
  if(sex === 'female') crcl *= 0.85;
  return crcl;
}

function computeBaseDose(ageY, ageM, wt){
  const adult = ageY >= 13;
  state.isAdult = adult;
  let d=0, f=2;

  if(adult){ d=75; f=2; }
  else{
    if(ageY === 0){
      if(ageM < 3) d = 12;
      else if(ageM <= 5) d = 20;
      else d = 25;
      f = 2;
    }else{
      if(wt <= 15) d = 30;
      else if(wt <= 23) d = 45;
      else if(wt <= 40) d = 60;
      else d = 75;
      f = 2;
    }
  }
  state.doseMg = d; state.freqPerDay = f;
}

function applyRenalIfNeeded(ageY, wt){
  const on = $('#renalChk').checked;
  $('#renalFields').classList.toggle('hidden', !on);
  if(!on){ $('#renalNote').textContent = ""; return; }

  if(ageY < 13){
    $('#renalNote').textContent = "คำเตือน: การปรับตาม CrCl ใช้ในผู้ใหญ่/วัยรุ่น (≥13 ปี) เท่านั้น";
    return;
  }
  const sex = $('#sex').value;
  const scr = num('#scr', NaN);
  const crcl = computeCrCl(ageY, wt, sex, scr);
  if(!crcl){ $('#renalNote').textContent = "กรุณากรอก sCr เป็นตัวเลขมากกว่า 0"; return; }
  state.crcl = crcl;

  if(crcl > 60){ state.doseMg = 75; state.freqPerDay = 2; }
  else if(crcl > 30){ state.doseMg = 30; state.freqPerDay = 2; }
  else if(crcl >= 11){ state.doseMg = 30; state.freqPerDay = 1; }
  else { state.doseMg = 0; state.freqPerDay = 0; }

  $('#renalNote').textContent = (state.freqPerDay>0)
    ? `CrCl ≈ ${crcl.toFixed(1)} mL/min → ขนาดที่ปรับแล้ว: ${state.doseMg} mg, วันละ ${state.freqPerDay} ครั้ง`
    : `CrCl ≤ 10 mL/min → ไม่แนะนำให้ใช้`;
}

function applyHDIfNeeded(ageY){
  const on = $('#hdChk').checked;
  $('#hdFields').classList.toggle('hidden', !on);
  state.hd = on;
  if(!on) return;

  if(ageY < 13){
    $('#renalNote').textContent = "คำเตือน: HD dosing ใช้ในผู้ใหญ่/วัยรุ่น (≥13 ปี) เท่านั้น";
    return;
  }
  state.doseMg = 30; // per HD session
  state.freqPerDay = 0;
  state.hdSessions = Math.max(1, parseInt(num('#hdSessions',1)));
}

function dosesCount(days){ return state.hd ? state.hdSessions : (state.freqPerDay*days); }

function getSelectedDrug(){
  const items = $$('.drugSel').filter(x=>x.checked);
  if(items.length===0) return null;
  const keep = items[0];
  $$('.drugSel').forEach(x=>{ if(x!==keep) x.checked=false; });
  return keep.value;
}

function rebuildSummary(selected){
  const days = Math.max(1, parseInt(num('#days',5)));
  const dose = state.doseMg;
  const nDoses = dosesCount(days);
  const freqTxt = state.hd ? `หลังฟอกแต่ละครั้ง × ${nDoses} รอบ` : `วันละ ${state.freqPerDay} ครั้ง`;
  const durTxt = state.hd ? `${days} วัน (HD regimen)` : `${days} วัน`;

  let row=null;
  if(selected==='cap30' || selected==='cap75'){
    const s = (selected==='cap30')?30:75;
    const dissolve = (selected==='cap30') ? $('#mix_cap30').checked : $('#mix_cap75').checked;
    const capsPerDose = Math.ceil(dose / s);
    const totalCaps = capsPerDose * nDoses;
    const bottles = Math.ceil(totalCaps/10);

    if(dissolve){
      const mixVol = (capsPerDose===1)?5:10;            // ≤10 mL rule
      const conc = (capsPerDose*s)/mixVol;              // mg/mL
      const give = dose/conc;                           // mL per dose
      row = {
        drug:`Oseltamivir แคปซูล ${s} mg (ละลายน้ำก่อนป้อน)`,
        strength:`${s} mg/แคปซูล (10 แคปซูล/ขวด)`,
        perDose:`${dose} mg`,
        freq:freqTxt, duration:durTxt,
        perDoseVol:`${give.toFixed(2)} mL/ครั้ง`,
        total:`${totalCaps} แคปซูล ≈ ${bottles} ขวด`,
        note:`ผสม ${capsPerDose} แคปซูล ในน้ำ ${mixVol} mL (≤10 mL); ~${conc.toFixed(1)} mg/mL; ให้ ${give.toFixed(2)} mL/ครั้ง และทิ้งส่วนที่เหลือ`
      };
    }else{
      const wasted = capsPerDose*s - dose;
      row = {
        drug:`Oseltamivir แคปซูล ${s} mg (เสี้ยวเม็ด/แบ่งแคปซูล)`,
        strength:`${s} mg/แคปซูล (10 แคปซูล/ขวด)`,
        perDose:`${dose} mg (ใช้ ${capsPerDose} แคปซูล/ครั้ง; ส่วนที่เหลือทิ้ง ≈ ${wasted.toFixed(0)} mg)`,
        freq:freqTxt, duration:durTxt, perDoseVol:`—`,
        total:`${totalCaps} แคปซูล ≈ ${bottles} ขวด`,
        note:`แบ่งปริมาณตามขนาดที่ต้องการ, ส่วนที่เหลือ/ครั้งให้ทิ้ง`
      };
    }
  }else if(selected==='syrup'){
    const conc = 10;
    const perVol = dose/conc;
    const totalVol = perVol*nDoses;
    const bottles = Math.ceil(totalVol/30);
    row = {
      drug:`Oseltamivir syrup`,
      strength:`10 mg/mL (30 mL/ขวด)`,
      perDose:`${dose} mg`,
      freq:freqTxt, duration:durTxt,
      perDoseVol:`${perVol.toFixed(2)} mL/ครั้ง`,
      total:`${(Math.round(totalVol*100)/100)} mL รวม ≈ ${bottles} ขวด`,
      note:`เขย่าขวดก่อนใช้`
    };
  }

  const tb = $('#summaryTable tbody');
  tb.innerHTML = "";
  if(row){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.drug}</td><td>${row.strength}</td><td>${row.perDose}</td>
                    <td>${row.freq}</td><td>${row.duration}</td><td>${row.perDoseVol}</td>
                    <td>${row.total}</td><td>${row.note}</td>`;
    tb.appendChild(tr);
  }
  $('#summaryMeta').textContent = state.hd
    ? `สรุป (HD): ${state.doseMg} mg หลังฟอกแต่ละครั้ง × ${state.hdSessions} รอบ`
    : `สรุป: ${state.doseMg} mg ต่อครั้ง, วันละ ${state.freqPerDay} ครั้ง × ${days} วัน`;
}

function updateAll(){
  const ageY = parseInt(num('#ageYears',0));
  const ageM = parseInt(num('#ageMonths',0));
  const wt   = num('#weight',0);
  const days = Math.max(1, parseInt(num('#days',5)));

  computeBaseDose(ageY, ageM, wt);
  applyRenalIfNeeded(ageY, wt);
  applyHDIfNeeded(ageY);

  if(state.hd){
    const s = Math.max(1, parseInt(num('#hdSessions',1)));
    if(!s || state.doseMg<=0){
      $('#doseResult').innerHTML = `<div class="warn">กรุณาระบุจำนวนรอบฟอกไตให้ถูกต้อง</div>`;
    }else{
      $('#doseResult').innerHTML = `ขนาดยาที่แนะนำ: <b>${state.doseMg} mg</b> หลังฟอกแต่ละครั้ง · ช่วงรักษา <b>${days}</b> วัน · รวม <b>${s}</b> รอบ`;
    }
  }else if(state.doseMg>0 && state.freqPerDay>0){
    $('#doseResult').innerHTML = `ขนาดยาที่แนะนำ: <b>${state.doseMg} mg</b> ต่อครั้ง, วันละ <b>${state.freqPerDay}</b> ครั้ง, เป็นเวลา <b>${days}</b> วัน`;
  }else{
    $('#doseResult').innerHTML = `<div class="warn">ไม่สามารถคำนวณขนาดยาได้ ตรวจสอบข้อมูล/การปรับตามไต</div>`;
  }

  const sel = getSelectedDrug();
  if(sel) rebuildSummary(sel); else { $('#summaryTable tbody').innerHTML=""; $('#summaryMeta').textContent=""; }
}

function init(){
  // Inputs -> recompute
  ['#ageYears','#ageMonths','#weight','#days','#scr','#sex','#hdSessions'].forEach(id=>{
    const el = $(id); if(el) el.addEventListener('input', updateAll);
  });

  // Toggles -> show fields + recompute
  $('#renalChk').addEventListener('change', ()=>{
    if($('#renalChk').checked){ $('#hdChk').checked=false; $('#hdFields').classList.add('hidden'); }
    updateAll();
  });
  $('#hdChk').addEventListener('change', ()=>{
    if($('#hdChk').checked){ $('#renalChk').checked=false; $('#renalFields').classList.add('hidden'); $('#renalNote').textContent=""; }
    updateAll();
  });

  // Drug selections
  $$('.drugSel').forEach(chk=> chk.addEventListener('change', ()=>{ const s=getSelectedDrug(); if(s) rebuildSummary(s); else updateAll(); }));
  ['#mix_cap30','#mix_cap75'].forEach(id=> $(id).addEventListener('change', ()=>{ const s=getSelectedDrug(); if(s) rebuildSummary(s); }));

  // Buttons
  $('#calcBtn').addEventListener('click', updateAll);
  $('#printBtn').addEventListener('click', ()=>window.print());
  $('#clearBtn').addEventListener('click', ()=>{
    $('#ageYears').value = 2; $('#ageMonths').value = 0; $('#weight').value = 12; $('#days').value = 5;
    $('#renalChk').checked = false; $('#hdChk').checked = false;
    $('#renalFields').classList.add('hidden'); $('#hdFields').classList.add('hidden');
    $('#doseResult').innerHTML = ""; $('#renalNote').textContent = "";
    $$('.drugSel').forEach(x=>x.checked=false); $('#mix_cap30').checked=false; $('#mix_cap75').checked=false;
    state.doseMg=null; state.freqPerDay=null; state.crcl=null; state.hd=false; state.hdSessions=0;
  });

  // first run
  updateAll();
}

document.addEventListener('DOMContentLoaded', init);
