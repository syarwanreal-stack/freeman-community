(() => {
  const cfg = window.FREEMAN_CONFIG || {};
  const ready = typeof cfg.supabaseUrl === "string" && cfg.supabaseUrl.startsWith("https://") &&
    !cfg.supabaseUrl.includes("PROJECT_REF") && typeof cfg.supabaseAnonKey === "string" &&
    cfg.supabaseAnonKey.length > 0 && !cfg.supabaseAnonKey.includes("PASTE_");
  const client = ready && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const list = document.querySelector("#group-list");
  const search = document.querySelector("#search");
  const categoryFilter = document.querySelector("#category-filter");
  const sortOrder = document.querySelector("#sort-order");
  const requestForm = document.querySelector("#request-form");
  const status = document.querySelector("#form-status");
  let groups = [];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeWhatsApp = link => /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+(?:[/?#].*)?$/.test(String(link || ""));
  const initials = name => Array.from(String(name || "S").trim()).slice(0,1).join("").toUpperCase() || "S";
  const getClicks = id => Number(localStorage.getItem("sgroup-clicks-" + id) || 0);
  function render() {
    if (!list) return;
    const q = (search?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "";
    let filtered = groups.filter(g => [g.name,g.category,g.description].join(" ").toLowerCase().includes(q) && (!category || g.category === category));
    if (sortOrder?.value === "az") filtered.sort((a,b) => String(a.name).localeCompare(String(b.name),"id"));
    else if (sortOrder?.value === "popular") filtered.sort((a,b) => getClicks(b.id)-getClicks(a.id));
    else filtered.sort((a,b) => String(b.created_at||"").localeCompare(String(a.created_at||"")));
    const count = document.querySelector("#result-count");
    if (count) count.textContent = filtered.length + (filtered.length === 1 ? " grup ditemukan" : " grup ditemukan");
    const statGroups = document.querySelector("#stat-groups");
    if (statGroups) statGroups.textContent = String(groups.length);
    list.innerHTML = filtered.length ? filtered.map(g => {
      const categoryName = esc(g.category || "Other");
      const name = esc(g.name || "Grup tanpa nama");
      const desc = esc(g.description || "Belum ada deskripsi untuk grup ini.");
      return `<article class="group-card">
        <div class="card-topline"><span class="group-avatar" aria-hidden="true">${initials(g.name)}</span><span class="tag">${categoryName}</span></div>
        <h3>${name}</h3><p>${desc}</p>
        <div class="card-actions"><button type="button" class="detail-button" data-detail="${esc(g.id)}">Lihat detail <span>↗</span></button><button type="button" data-share="${esc(g.id)}" aria-label="Bagikan grup ${name}">↗ Bagikan</button></div>
      </article>`;
    }).join("") : '<div class="empty-state">Belum ada grup yang cocok. Coba kata kunci atau kategori lain.</div>';
    list.querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click", () => showDetails(button.dataset.detail)));
    list.querySelectorAll("[data-share]").forEach(button => button.addEventListener("click", () => shareGroup(button.dataset.share)));
  }
  function findGroup(id) { return groups.find(g => String(g.id) === String(id)); }
  function showDetails(id) {
    const g = findGroup(id); if (!g) return;
    const dialog = document.createElement("dialog");
    dialog.className = "group-dialog";
    dialog.innerHTML = `<div class="dialog-head"><span class="group-avatar">${initials(g.name)}</span><button class="dialog-close" type="button" aria-label="Tutup detail">×</button></div>
      <span class="tag">${esc(g.category || "Other")}</span><h2>${esc(g.name || "Grup tanpa nama")}</h2>
      <p class="dialog-description">${esc(g.description || "Belum ada deskripsi untuk grup ini.")}</p>
      <div class="dialog-meta"><span>◷ Terdaftar di SGROUP</span><span>↗ ${getClicks(g.id)} klik dari perangkat ini</span></div>
      <div class="dialog-actions"><button class="primary-button join-button" type="button" ${safeWhatsApp(g.link) ? "" : "disabled"}>Lanjut ke WhatsApp ↗</button><button class="report-button" type="button">Laporkan grup</button></div>
      <p class="dialog-note">Periksa nama dan deskripsi sebelum melanjutkan. SGROUP akan meminta konfirmasi sebelum membuka WhatsApp.</p>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector(".report-button").addEventListener("click", () => {
      const subject = encodeURIComponent("Laporan grup SGROUP: " + (g.name || "Tanpa nama"));
      const body = encodeURIComponent("Nama grup: " + (g.name || "") + "\nKategori: " + (g.category || "") + "\nLink grup: " + (g.link || "") + "\n\nAlasan laporan: ");
      window.location.href = "mailto:?subject=" + subject + "&body=" + body;
      dialog.close();
    });
    dialog.querySelector(".join-button").addEventListener("click", () => {
      if (!safeWhatsApp(g.link)) return;
      if (!window.confirm("Kamu akan meninggalkan SGROUP dan membuka undangan WhatsApp untuk grup “" + (g.name || "ini") + "”. Lanjutkan?")) return;
      const key = "sgroup-clicks-" + g.id;
      localStorage.setItem(key, String(getClicks(g.id) + 1));
      window.open(g.link, "_blank", "noopener,noreferrer");
      dialog.close(); render();
    });
    dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }
  async function shareGroup(id) {
    const g = findGroup(id); if (!g) return;
    const shareData = {title: (g.name || "Grup") + " — SGROUP", text: (g.description || "Temukan grup ini di SGROUP") + "\nKategori: " + (g.category || "Other"), url: location.href.split("#")[0] + "#groups"};
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareData.text + "\n" + shareData.url); alert("Info grup berhasil disalin untuk dibagikan."); }
      else window.prompt("Salin teks ini untuk dibagikan:", shareData.text + "\n" + shareData.url);
    } catch (e) { if (e?.name !== "AbortError") console.error("Gagal membagikan grup:", e); }
  }
  async function load() {
    if (!list) return;
    const visits = document.querySelector("#stat-visits");
    const visitKey = "sgroup-visits-count";
    const visited = sessionStorage.getItem("sgroup-visited-this-session");
    let totalVisits = Number(localStorage.getItem(visitKey) || 0);
    if (!visited) { totalVisits += 1; localStorage.setItem(visitKey, String(totalVisits)); sessionStorage.setItem("sgroup-visited-this-session","1"); }
    if (visits) visits.textContent = totalVisits.toLocaleString("id-ID");
    const year = document.querySelector("#year"); if (year) year.textContent = new Date().getFullYear();
    if (!client) { list.innerHTML = '<div class="empty-state">Konfigurasi Supabase belum benar. Periksa config.js.</div>'; return; }
    const {data,error} = await client.from("groups").select("id,name,link,category,description,created_at").order("created_at",{ascending:false});
    if (error) { console.error("Gagal memuat grup:",error); list.innerHTML = '<div class="empty-state">Grup belum bisa dimuat. Periksa koneksi dan konfigurasi Supabase.</div>'; return; }
    groups = data || []; render();
  }
  search?.addEventListener("input",render);
  categoryFilter?.addEventListener("change",render);
  sortOrder?.addEventListener("change",render);
  if (requestForm && status) {
    requestForm.addEventListener("submit",async e => {
      e.preventDefault(); status.classList.remove("error");
      const f = new FormData(requestForm);
      const payload = {name:String(f.get("name")||"").trim(),link:String(f.get("link")||"").trim(),category:String(f.get("category")||"").trim(),description:String(f.get("description")||"").trim()};
      if (!payload.name || payload.name.length>80) { status.textContent="Nama grup wajib diisi dan maksimal 80 karakter."; status.classList.add("error"); return; }
      if (!safeWhatsApp(payload.link)) { status.textContent="Masukkan link undangan WhatsApp yang valid (chat.whatsapp.com)."; status.classList.add("error"); return; }
      if (!["Gaming","Community","JualBeli","TeamOnline","NoRules","Other"].includes(payload.category)) { status.textContent="Pilih kategori yang tersedia."; status.classList.add("error"); return; }
      if (!payload.description || payload.description.length>500) { status.textContent="Deskripsi wajib diisi dan maksimal 500 karakter."; status.classList.add("error"); return; }
      const endpoint=cfg.submitRequestFunctionUrl, anonKey=cfg.supabaseAnonKey;
      if (typeof endpoint!=="string" || !endpoint.startsWith("https://") || endpoint.includes("PROJECT_REF") || !anonKey) { status.textContent="Konfigurasi endpoint atau publishable key belum benar di config.js."; status.classList.add("error"); return; }
      const submitButton=requestForm.querySelector('button[type="submit"],input[type="submit"]');
      if(submitButton) submitButton.disabled=true;
      status.textContent="Mengirim request untuk ditinjau…";
      try {
        const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${anonKey}`,"apikey":anonKey},body:JSON.stringify(payload)});
        const responseText=await response.text(); let data={};
        try { data=responseText?JSON.parse(responseText):{}; } catch { data={details:responseText.slice(0,300)}; }
        if(!response.ok) { const detail=data.error||data.message||data.msg||data.details||response.statusText||"Server menolak request."; throw new Error(`HTTP ${response.status}: ${String(detail).slice(0,300)}`); }
        status.textContent="Request berhasil dikirim. Admin akan meninjaunya sebelum ditampilkan.";
        requestForm.reset();
      } catch(err) { console.error("Pengiriman request gagal:",err); status.textContent="Gagal mengirim: "+(err?.message||"Kesalahan tidak diketahui")+"."; status.classList.add("error"); }
      finally { if(submitButton) submitButton.disabled=false; }
    });
  }
  load();
})();