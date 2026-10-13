(() => {
  const cfg = window.FREEMAN_CONFIG || {};

  const ready =
    typeof cfg.supabaseUrl === "string" &&
    cfg.supabaseUrl.startsWith("https://") &&
    !cfg.supabaseUrl.includes("PROJECT_REF") &&
    typeof cfg.supabaseAnonKey === "string" &&
    cfg.supabaseAnonKey.length > 0 &&
    !cfg.supabaseAnonKey.includes("PASTE_");

  const client =
    ready && window.supabase
      ? window.supabase.createClient(
          cfg.supabaseUrl,
          cfg.supabaseAnonKey
        )
      : null;

  const list = document.querySelector("#group-list");
  const search = document.querySelector("#search");
  const requestForm = document.querySelector("#request-form");
  const status = document.querySelector("#form-status");

  let groups = [];

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  function render() {
    if (!list || !search) return;

    const q = (search.value || "").toLowerCase();

    const filtered = groups.filter((g) =>
      [g.name, g.category, g.description]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    list.innerHTML = filtered.length
      ? filtered.map((g) => `
          <article class="group-card">
            <span class="tag">${esc(g.category)}</span>
            <h3>${esc(g.name)}</h3>
            <p>${esc(g.description)}</p>
            ${
              g.link
                ? `<a class="button-link"
                     href="${esc(g.link)}"
                     target="_blank"
                     rel="noopener noreferrer">Buka grup ↗</a>`
                : '<span class="muted">Link belum tersedia</span>'
            }
          </article>
        `).join("")
      : "<p>Belum ada grup yang cocok.</p>";
  }

  async function load() {
    if (!list) return;

    if (!client) {
      list.innerHTML =
        "<p class='notice'>Konfigurasi Supabase belum benar. Periksa config.js.</p>";
      return;
    }

    const { data, error } = await client
      .from("groups")
      .select("id,name,link,category,description")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal memuat grup:", error);
      list.innerHTML =
        "<p class='notice'>Gagal memuat grup. Periksa Console atau konfigurasi Supabase.</p>";
      return;
    }

    groups = data || [];
    render();
  }

  if (search) {
    search.addEventListener("input", render);
  }

  if (requestForm && status) {
    requestForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const f = new FormData(requestForm);

      const payload = {
        name: String(f.get("name") || "").trim(),
        link: String(f.get("link") || "").trim(),
        category: String(f.get("category") || "").trim(),
        description: String(f.get("description") || "").trim()
      };

      if (!payload.name || payload.name.length > 80) {
        status.textContent = "Nama grup wajib diisi dan maksimal 80 karakter.";
        return;
      }

      if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+(?:[/?#].*)?$/.test(payload.link)) {
        status.textContent =
          "Link harus berupa link undangan WhatsApp yang valid (chat.whatsapp.com).";
        return;
      }

      if (!payload.category) {
        status.textContent = "Pilih kategori grup terlebih dahulu.";
        return;
      }

      if (!payload.description || payload.description.length > 500) {
        status.textContent =
          "Deskripsi wajib diisi dan maksimal 500 karakter.";
        return;
      }

      const endpoint = cfg.submitRequestFunctionUrl;

      if (
        typeof endpoint !== "string" ||
        !endpoint.startsWith("https://") ||
        endpoint.includes("PROJECT_REF")
      ) {
        status.textContent =
          "URL Edge Function belum dikonfigurasi dengan benar di config.js.";
        return;
      }

      const submitButton = requestForm.querySelector(
        'button[type="submit"], input[type="submit"]'
      );

      if (submitButton) submitButton.disabled = true;

      status.textContent = "Mengirim request...";

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        let data = {};

        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = { details: responseText.slice(0, 300) };
        }

        if (!response.ok) {
          const detail =
            data.error ||
            data.message ||
            data.msg ||
            data.details ||
            response.statusText ||
            "Server menolak request.";

          throw new Error(
            `HTTP ${response.status}: ${String(detail).slice(0, 300)}`
          );
        }

        if (data.ok === false) {
          throw new Error(
            data.error || "Server belum mengonfirmasi penyimpanan request."
          );
        }

        status.textContent =
          "Request berhasil dikirim untuk ditinjau admin.";

        requestForm.reset();
      } catch (err) {
        console.error("Pengiriman request gagal:", err);

        status.textContent =
          "Gagal mengirim: " +
          (err?.message || "Kesalahan tidak diketahui") +
          ". Periksa Edge Functions di Supabase.";

      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  load();
})();
