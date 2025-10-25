/* K3RN4LP4N1C — Image Detector front-end */

/* CHANGED: central logo URL (fetched remotely) */
const LOGO_URL = "https://i.ibb.co/pvjw7QrQ/K3-RN4-LP4-N1-C.png";

/* Apply the logo URL to all <img data-logo> and to the favicon */
(function setLogoAssets() {
  document.querySelectorAll('img[data-logo]').forEach(img => {
    img.src = LOGO_URL;
    img.decoding = 'async';
    img.loading = 'eager';
  });
  const ico = document.getElementById('favicon');
  if (ico) ico.href = LOGO_URL;
})();

(function () {
  const form = document.getElementById('analyzeForm');
  const baseUrl = document.getElementById('baseUrl');
  const endpointSel = document.getElementById('endpoint');
  const sendAs = document.getElementById('sendAs');
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');
  const progressWrap = document.querySelector('.progress-wrap');
  const progressBar = document.getElementById('progress');
  const preview = document.getElementById('preview');
  const thumb = document.getElementById('thumb');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const resultCard = document.getElementById('resultCard');
  const raw = document.getElementById('raw');
  const about = document.getElementById('about');
  const aboutBtn = document.getElementById('aboutBtn');

  let selectedFile = null;

  function humanSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2).replace(/\.00$/, '') + ' ' + sizes[i];
  }

  function resetUI() {
    selectedFile = null;
    fileInput.value = '';
    preview.hidden = true;
    submitBtn.disabled = true;
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    resultCard.className = 'result-card muted';
    raw.textContent = '';
    document.getElementById('pill').textContent = 'Waiting…';
  }

  function showPreview(file) {
    preview.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = humanSize(file.size);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      thumb.src = url;
      thumb.alt = file.name;
      thumb.onload = () => URL.revokeObjectURL(url);
    } else {
      thumb.src = '';
      thumb.alt = '';
    }
  }

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedFile = e.dataTransfer.files[0];
      showPreview(selectedFile);
      submitBtn.disabled = false;
      if (!sendAs.value) sendAs.value = 'exiftool_test.png';
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedFile = e.target.files[0];
      showPreview(selectedFile);
      submitBtn.disabled = false;
      if (!sendAs.value) sendAs.value = 'exiftool_test.png';
    }
  });

  // About
  aboutBtn.addEventListener('click', () => about.showModal());

  // Reset
  resetBtn.addEventListener('click', resetUI);

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    // Build target URL
    const base = (baseUrl.value || '').trim().replace(/\/+$/,''); // strip trailing slash
    const path = endpointSel.value || '/metadata';
    const url = base + path;

    // Build FormData with user-controlled filename
    const fd = new FormData();
    const name = (sendAs.value || selectedFile.name || 'upload.bin').trim();
    const fileForSend = new File([selectedFile], name, { type: selectedFile.type || 'application/octet-stream' });
    fd.append('file', fileForSend, name);

    // UI state
    submitBtn.disabled = true;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    resultCard.className = 'result-card muted';
    document.getElementById('pill').textContent = 'Uploading…';

    // Use XHR for progress
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        progressBar.style.width = pct + '%';
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      progressBar.style.width = '100%';

      try {
        const data = JSON.parse(xhr.responseText);
        raw.textContent = JSON.stringify(data, null, 2);

        const ok = !!data.ok;
        const isImage = !!data.is_image;

        const pill = document.getElementById('pill');
        if (ok && isImage) {
          resultCard.className = 'result-card ok';
          pill.textContent = 'Image ✔';
        } else if (ok && !isImage) {
          resultCard.className = 'result-card bad';
          pill.textContent = 'Not an image ✖';
        } else {
          resultCard.className = 'result-card bad';
          pill.textContent = 'Error';
        }
      } catch (err) {
        resultCard.className = 'result-card bad';
        document.getElementById('pill').textContent = 'Parse error';
        raw.textContent = (xhr.responseText || '').substring(0, 4000);
      } finally {
        submitBtn.disabled = false;
      }
    };

    xhr.onerror = () => {
      resultCard.className = 'result-card bad';
      document.getElementById('pill').textContent = 'Network error';
      raw.textContent = `POST ${url}\n\n` + (xhr.responseText || '(no response)');
      submitBtn.disabled = false;
    };

    xhr.send(fd);
  });

  // Initialize UI
  resetUI();
})();