/* K3RN4LP4N1C — Image Detector front-end */

/* Central logo URL (fetched remotely) */
const LOGO_URL = "https://i.ibb.co/pvjw7QrQ/K3-RN4-LP4-N1-C.png";

/* Fixed backend target */
const BASE_URL = "https://architectural-presumptuously-jeanine.ngrok-free.dev/command-injection";
const ENDPOINT = "/metadata";
const TARGET_URL = BASE_URL.replace(/\/+$/, "") + ENDPOINT; // ensure single slash

/* Fallback thumbnail for non-images or failed previews */
const FALLBACK_THUMB = "https://i.ibb.co/cX2VxzDn/unknown-file.png";

/* Apply the logo URL to all <img data-logo> and to the favicon */
(function setLogoAssets() {
  document.querySelectorAll('img[data-logo]').forEach(img => {
    img.src = LOGO_URL;
    img.decoding = "async";
    img.loading = "eager";
  });
  const ico = document.getElementById("favicon");
  if (ico) ico.href = LOGO_URL;
})();

(function () {
  const form = document.getElementById("analyzeForm");
  const fileInput = document.getElementById("fileInput");
  const dropzone = document.getElementById("dropzone");
  const submitBtn = document.getElementById("submitBtn");
  const resetBtn = document.getElementById("resetBtn");
  const progressWrap = document.querySelector(".progress-wrap");
  const progressBar = document.getElementById("progress");
  const preview = document.getElementById("preview");
  const thumb = document.getElementById("thumb");
  const fileName = document.getElementById("fileName");
  const fileSize = document.getElementById("fileSize");
  const resultCard = document.getElementById("resultCard");
  const raw = document.getElementById("raw");
  const about = document.getElementById("about");
  const aboutBtn = document.getElementById("aboutBtn");
  const pill = document.getElementById("pill");

  let selectedFile = null;

  function humanSize(bytes) {
    if (!bytes) return "0 B";
    const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2).replace(/\.00$/, "") + " " + sizes[i];
  }

  function resetUI() {
    selectedFile = null;
    fileInput.value = "";
    preview.hidden = true;
    submitBtn.disabled = true;
    progressWrap.hidden = true;
    progressBar.style.width = "0%";
    resultCard.className = "result-card muted";
    raw.textContent = "";
    pill.textContent = "Waiting…";
  }

  function showPreview(file) {
    preview.hidden = false;
    fileName.textContent = file.name || "upload";
    fileSize.textContent = humanSize(file.size || 0);

    if (file.type && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      thumb.src = url;
      thumb.alt = file.name || "image";
      thumb.onerror = () => {
        thumb.onerror = null;
        thumb.src = FALLBACK_THUMB;
      };
      thumb.onload = () => URL.revokeObjectURL(url);
    } else {
      thumb.onerror = null;
      thumb.src = FALLBACK_THUMB;
      thumb.alt = "unknown file";
    }
  }

  // Drag and drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedFile = e.dataTransfer.files[0];
      showPreview(selectedFile);
      submitBtn.disabled = false;
    }
  });

  // Click to open file picker
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedFile = e.target.files[0];
      showPreview(selectedFile);
      submitBtn.disabled = false;
    }
  });

  // About
  aboutBtn.addEventListener("click", () => about.showModal());

  // Reset
  resetBtn.addEventListener("click", resetUI);

  // Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    // Build FormData with the original file. Do not override the filename parameter.
    const fd = new FormData();
    fd.append("file", selectedFile);

    // UI state
    submitBtn.disabled = true;
    progressWrap.hidden = false;
    progressBar.style.width = "0%";
    resultCard.className = "result-card muted";
    pill.textContent = "Uploading…";
    raw.textContent = "";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", TARGET_URL, true);

    // Upload progress, cap at 90 percent until server responds
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.min(90, Math.floor((evt.loaded / evt.total) * 90));
        progressBar.style.width = pct + "%";
      } else {
        // Unknown size, show a modest progress
        progressBar.style.width = "30%";
      }
    };

    // Success or error
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;

      // Move to 100 percent only once the response arrives
      progressBar.style.width = "100%";

      let status = xhr.status || 0;
      let text = xhr.responseText || "";
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_) {
        payload = null;
      }

      // Default UI
      let ok = false, isImage = false, message = "Unknown response";
      if (payload && typeof payload === "object") {
        ok = !!payload.ok;
        isImage = !!payload.is_image;
        message = ok ? (isImage ? "✅ Looks like an image" : "❌ Not an image") : "Server reported an error";
      } else if (status >= 200 && status < 300) {
        message = "Response received";
      } else if (status === 0) {
        message = "Network error";
      } else {
        message = `HTTP ${status}`;
      }

      pill.textContent = message;
      if (ok && isImage) {
        resultCard.className = "result-card ok";
      } else if (ok && !isImage) {
        resultCard.className = "result-card warn";
      } else {
        resultCard.className = "result-card bad";
      }

      raw.textContent = payload ? JSON.stringify(payload, null, 2) : (text || "<no body>");

      // Re-enable controls
      submitBtn.disabled = false;
    };

    xhr.onerror = () => {
      progressBar.style.width = "100%";
      resultCard.className = "result-card bad";
      pill.textContent = "Network error";
      raw.textContent = xhr.responseText || "<no body>";
      submitBtn.disabled = false;
    };

    xhr.ontimeout = () => {
      progressBar.style.width = "100%";
      resultCard.className = "result-card bad";
      pill.textContent = "Request timed out";
      raw.textContent = "";
      submitBtn.disabled = false;
    };

    xhr.send(fd);
  });

  // Initialize
  resetUI();
})();
