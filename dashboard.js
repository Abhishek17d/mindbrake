/***** Utils *****/
function fmt(ms){
  const s=Math.floor(ms/1000), m=Math.floor(s/60), ss=String(s%60).padStart(2,"0");
  return `${m}m ${ss}s`;
}
function dateNice(){
  return new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
}
function palette(n){
  const base=["#60a5fa","#34d399","#f87171","#fbbf24","#a78bfa","#22d3ee","#f472b6","#f59e0b","#10b981","#ef4444"];
  const arr=[]; for(let i=0;i<n;i++) arr.push(base[i%base.length]); return arr;
}
function topNWithOthers(pairs,n=7){
  const sorted=[...pairs].sort((a,b)=>b[1]-a[1]);
  const top=sorted.slice(0,n);
  const rest=sorted.slice(n);
  const others=rest.reduce((acc,[_d,t])=>acc+t,0);
  if(others>0) top.push(["Others",others]);
  return top;
}

/***** Chart helpers *****/
function roundedRectPath(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.lineTo(x+w-rr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
  ctx.lineTo(x+w, y+h-rr);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
  ctx.lineTo(x+rr, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
  ctx.lineTo(x, y+rr);
  ctx.quadraticCurveTo(x, y, x+rr, y);
  ctx.closePath();
}

/***** BAR CHART *****/
function drawBars(ctx, labels, values){
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.clearRect(0,0,W,H);

  const pad = 44;
  const chartW = W - pad*2;
  const chartH = H - pad*2 - 6;
  const n = Math.max(labels.length,1);
  const maxV = Math.max(1, ...values);

  const GAP = 16;
  const BW_MAX = 36;
  const BW_MIN = 14;
  let bw = Math.min(BW_MAX, Math.max(BW_MIN, (chartW - GAP*(n-1))/n));
  const usedW = bw*n + GAP*(n-1);
  const startX = pad + (chartW - usedW)/2;

  const baseY = H - pad;

  const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
  grad.addColorStop(0, "#3b82f6");
  grad.addColorStop(1, "#22d3ee");

  labels.forEach((lab,i)=>{
    const v = values[i];
    const rawH = Math.round((v/maxV)*chartH);
    const h = Math.max(6, rawH);
    const x = startX + i*(bw+GAP);
    const y = baseY - h;

    ctx.fillStyle = grad;
    roundedRectPath(ctx, x, y, bw, h, Math.min(12, bw/2));
    ctx.fill();

    ctx.fillStyle = "#e5e7eb"; ctx.font = "12px system-ui"; ctx.textAlign = "center";
    ctx.fillText(fmt(v), x + bw/2, y - 6);

    ctx.fillStyle = "#94a3b8"; ctx.font = "12px system-ui";
    ctx.fillText(lab, x + bw/2, baseY + 16);
  });
}

/***** DONUT CHART *****/
function drawDonut(ctx, labels, values, legendEl, totalMs){
  const W=ctx.canvas.width, H=ctx.canvas.height, cx=W/2, cy=H/2;
  ctx.clearRect(0,0,W,H);

  const total = values.reduce((a,b)=>a+b,0) || 1;
  const outerR = Math.min(W,H)/2 - 8;
  const innerR = Math.round(outerR * 0.58);
  const cols = palette(labels.length);

  let start = -Math.PI/2;
  labels.forEach((lab,i)=>{
    const slice = (values[i]/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy, outerR, start, start+slice);
    ctx.arc(cx,cy, innerR, start+slice, start, true);
    ctx.closePath();
    ctx.fillStyle = cols[i];
    ctx.fill();
    start += slice;
  });

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(fmt(totalMs), cx, cy - 2);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px system-ui";
  ctx.fillText("Total today", cx, cy + 14);

  legendEl.innerHTML="";
  labels.forEach((lab,i)=>{
    const row=document.createElement("div"); row.className="legend-item";
    const sw=document.createElement("span"); sw.className="legend-swatch"; sw.style.background=cols[i];
    const wrap=document.createElement("div");
    const title=document.createElement("div"); title.className="label"; title.textContent=lab;
    const sub=document.createElement("div"); sub.className="muted"; sub.textContent=`${Math.round(values[i]/total*100)}%`;
    wrap.appendChild(title); wrap.appendChild(sub);
    row.appendChild(sw); row.appendChild(wrap);
    legendEl.appendChild(row);
  });
}

/***** Table *****/
function fillTable(tbody, pairs, total){
  tbody.innerHTML="";
  pairs.forEach(([d,ms])=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${d}</td><td class="num">${fmt(ms)}</td><td class="num">${Math.round(ms/total*100)}%</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("tableMeta").textContent = `${pairs.length} entries`;
}

/***** OVERVIEW RENDER *****/
function loadAndRender(){
  document.getElementById("dateText").textContent = dateNice();

  chrome.runtime.sendMessage({type:"GET_TODAY_STATS"}, (resp)=>{
    if(!resp) return;
    const day = resp.day || { totalMs:0, perDomain:{} };
    const total = day.totalMs || 0;
    const rawPairs = Object.entries(day.perDomain || {}).filter(([,t])=>t>=5000);
    rawPairs.sort((a,b)=>b[1]-a[1]);

    document.getElementById("totalTime").textContent = fmt(total);
    document.getElementById("siteCount").textContent = String(rawPairs.length);
    if(rawPairs.length){
      const [topDom, topMs] = rawPairs[0];
      document.getElementById("topSite").textContent = topDom;
      document.getElementById("topTime").textContent = fmt(topMs);
      document.getElementById("topShare").textContent = total>0 ? `${Math.round(topMs/total*100)}%` : "0%";
    } else {
      document.getElementById("topSite").textContent = "—";
      document.getElementById("topTime").textContent = "0m 00s";
      document.getElementById("topShare").textContent = "0%";
    }

    const top7 = topNWithOthers(rawPairs,7);
    const labels = top7.map(([d])=>d);
    const values = top7.map(([,t])=>t);

    drawBars(document.getElementById("barChart").getContext("2d"), labels, values);
    drawDonut(
      document.getElementById("pieChart").getContext("2d"),
      labels, values,
      document.getElementById("legend"),
      total
    );

    fillTable(document.getElementById("sitesTbody"), rawPairs, total);
  });
}

/***** HISTORY RENDER *****/
function loadHistory(){
  chrome.storage.local.get("statsByDay", ({statsByDay={}})=>{
    const days = Object.keys(statsByDay).sort().reverse().slice(0,7);
    const list=document.getElementById("historyList");
    list.innerHTML="";
    days.forEach(dayKey=>{
      const entry=statsByDay[dayKey];
      const li=document.createElement("li");
      li.className="db-history-item";
      li.innerHTML = `<strong>${dayKey}</strong> — ${fmt(entry.totalMs)}<br>
        <small>${Object.entries(entry.perDomain||{}).slice(0,3).map(([d,ms])=>`${d}: ${fmt(ms)}`).join(", ")}</small>`;
      list.appendChild(li);
    });
  });
}

/***** PAGE SWITCHING *****/
document.addEventListener("DOMContentLoaded", ()=>{
  // initial overview
  loadAndRender();
  setInterval(loadAndRender, 5000);

  const navItems = document.querySelectorAll(".nav-item[data-page]");
  const pages = document.querySelectorAll(".page");

  navItems.forEach(item=>{
    item.addEventListener("click",()=>{
      navItems.forEach(i=>i.classList.remove("active"));
      pages.forEach(p=>p.classList.remove("active"));

      item.classList.add("active");
      const pg=item.getAttribute("data-page");
      document.getElementById("page-"+pg).classList.add("active");

      if(pg==="overview") loadAndRender();
      if(pg==="history") loadHistory();
    });
  });
});
