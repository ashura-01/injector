document.addEventListener("DOMContentLoaded", async () => {
  // Check if browser API is available
  if (typeof browser === 'undefined') {
    console.error('Browser API not available');
    showTemporaryMessage('Browser API not available', 'error');
    return;
  }

  const payload = document.getElementById("payload");
  const injectBtn = document.getElementById("injectBtn");
  const bypass = document.getElementById("bypass");
  const urlCodeBtn = document.getElementById("urlCode");
  const base64Btn = document.getElementById("base64");
  const hexCodeBtn = document.getElementById("hexCode");
  const modeBox = document.getElementById("modeBox");
  const typeBox = document.getElementById("typeBox");
  const payloadBox = document.getElementById("payloadBox");
  const htmlcodebtn = document.getElementById("htmlcode");

  // Configuration
  const PAYLOAD_BATCH_SIZE = 10; // Load 10 payloads at a time
  let currentMode = null;
  let currentType = null;
  let currentPage = 0;
  let isLoadingMore = false;
  let allLoadedPayloads = []; // Store loaded payloads for current mode/type
  let totalPayloadCount = 0; // Store total count without loading all
  let searchTerm = ''; // For search functionality
  let PAYLOAD_DB = {}; // Will hold the database

  // Show loading state
  payloadBox.innerHTML = "<div class='loading'>Loading payload database...</div>";

  /* ---------- AUTO WRAP SELECTION ---------- */
  payload.addEventListener("keydown", (e) => {
    const pairs = {
      "'": "'", '"': '"', '`': '`', '(': ')', '[': ']', '{': '}'
    };

    if (pairs[e.key]) {
      let s = payload.selectionStart, eEnd = payload.selectionEnd;

      if (s !== eEnd) {
        e.preventDefault();

        const selectedText = payload.value.slice(s, eEnd);
        const wrapperOpen = e.key;
        const wrapperClose = pairs[e.key];

        const newValue = payload.value.slice(0, s) +
        wrapperOpen + selectedText + wrapperClose +
        payload.value.slice(eEnd);

        payload.value = newValue;
        payload.selectionStart = s;
        payload.selectionEnd = eEnd + 2;
        autoGrow(payload);
      }
    }
  });

  /* ---------- AUTO GROW & HIGHLIGHTING ---------- */
  let growTimeout;

  function updateHighlighting() {
    const highlightLayer = document.getElementById("highlighting");
    if (!highlightLayer) return;

    let text = payload.value;

    // Escape HTML first
    text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

    // Apply syntax highlighting
    text = text
    .replace(/("(.*?)")/g, '<span class="token-string">$1</span>')
    .replace(/('(.*?)')/g, '<span class="token-string">$1</span>')
    .replace(/\b(alert|script|window|document|fetch|eval|UNION|SELECT|OR|FROM|WHERE|INSERT|UPDATE|DELETE)\b/gi, '<span class="token-keyword">$1</span>')
    .replace(/(&lt;[^&]+&gt;)/g, '<span class="token-tag">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');

    highlightLayer.innerHTML = text + "\n";
  }

  function autoGrow(el) {
    clearTimeout(growTimeout);
    growTimeout = setTimeout(() => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";

      const highlightLayer = document.getElementById("highlighting");
      if (highlightLayer) {
        highlightLayer.style.height = el.style.height;
      }

      updateHighlighting();
    }, 10);
  }

  payload.addEventListener("input", () => autoGrow(payload));
  setTimeout(() => updateHighlighting(), 100);

  /* ---------- SAFE COPY ---------- */
  function copyText(text) {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
    showTemporaryMessage('Copied to clipboard!');
  }

  /* ---------- INJECTION LOGIC ---------- */
  let isInjecting = false;
  let lastInjectionTime = 0;
  const MIN_INJECTION_INTERVAL = 500;
  let pendingPayload = null;
  let injectionTimer = null;

  injectBtn.onclick = async () => {
    const p = payload.value.trim();
    if (!p) return;

    if (pendingPayload) {
      console.log("Clearing previous pending payload:", pendingPayload);
      pendingPayload = null;
    }

    if (injectionTimer) {
      clearTimeout(injectionTimer);
      injectionTimer = null;
    }

    if (isInjecting) {
      console.log("Already injecting, setting as pending:", p);
      pendingPayload = p;

      injectionTimer = setTimeout(() => {
        if (pendingPayload) {
          console.log("Auto-clearing stale pending payload");
          pendingPayload = null;
        }
      }, 2000);

      return;
    }

    const now = Date.now();
    if (now - lastInjectionTime < MIN_INJECTION_INTERVAL) {
      console.log("Rate limited, waiting...");
      setTimeout(() => processInjection(p), MIN_INJECTION_INTERVAL - (now - lastInjectionTime));
      return;
    }

    await processInjection(p);
  };

  async function processInjection(p) {
    if (injectionTimer) {
      clearTimeout(injectionTimer);
      injectionTimer = null;
    }

    isInjecting = true;
    copyText(p);

    try {
      // Method 1: Try using executeScript
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          const tabId = tabs[0].id;

          await browser.tabs.executeScript(tabId, {
            code: `
            (function() {
              setTimeout(() => {
                try {
                  const payload = ${JSON.stringify(p)};
                  const currentUrl = window.location.href;

                  const buildUrl = (currentUrl, payload) => {
                    const hashIndex = currentUrl.indexOf('#');
                    const hash = hashIndex !== -1 ? currentUrl.slice(hashIndex) : '';
                    const urlWithoutHash = hashIndex !== -1 ? currentUrl.slice(0, hashIndex) : currentUrl;

                    const queryIndex = urlWithoutHash.indexOf('?');
                    const baseUrl = queryIndex !== -1 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
                    const queryString = queryIndex !== -1 ? urlWithoutHash.slice(queryIndex + 1) : '';

                    if (payload.startsWith('#')) {
                      return baseUrl + (queryString ? '?' + queryString : '') + payload;
                    }
                    else if (payload.startsWith('?')) {
                      return baseUrl + payload + hash;
                    }
                    else if (payload.startsWith('&')) {
                      if (queryString) {
                        return baseUrl + '?' + queryString + payload + hash;
                      } else {
                        return baseUrl + '?' + payload.slice(1) + hash;
                      }
                    }
                    else if (queryString) {
                      const params = queryString.split('&');
                      if (params.length > 0) {
                        const firstParam = params[0].split('=')[0];
                        params[0] = firstParam + '=' + payload;
                        return baseUrl + '?' + params.join('&') + hash;
                      } else {
                        return baseUrl + '?param=' + payload + hash;
                      }
                    }
                    else {
                      return baseUrl + '?param=' + payload + hash;
                    }
                  };

                  const finalUrl = buildUrl(currentUrl, payload);

                  if (finalUrl && finalUrl !== currentUrl) {
                    window.location.replace(finalUrl);
                  }
                } catch (e) {
                  console.error("Injection error:", e);
                }
              }, 50);
            })();
            `,
            runAt: 'document_end'
          });

          console.log("Injection attempted via tabs.executeScript");
          lastInjectionTime = Date.now();
          pendingPayload = null;

          setTimeout(() => {
            isInjecting = false;
          }, MIN_INJECTION_INTERVAL);

          return;
        }
      } catch (tabError) {
        console.log("Tab execution failed:", tabError);
      }

      // Method 2: Use devtools.inspectedWindow.eval
      const [result, error] = await browser.devtools.inspectedWindow.eval(`
      (function() {
        try {
          const payload = ${JSON.stringify(p)};
          const currentUrl = window.location.href;

          const buildUrl = (currentUrl, payload) => {
            const hashIndex = currentUrl.indexOf('#');
            const hash = hashIndex !== -1 ? currentUrl.slice(hashIndex) : '';
            const urlWithoutHash = hashIndex !== -1 ? currentUrl.slice(0, hashIndex) : currentUrl;

            const queryIndex = urlWithoutHash.indexOf('?');
            const baseUrl = queryIndex !== -1 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
            const queryString = queryIndex !== -1 ? urlWithoutHash.slice(queryIndex + 1) : '';

            if (payload.startsWith('#')) {
              return baseUrl + (queryString ? '?' + queryString : '') + payload;
            }
            else if (payload.startsWith('?')) {
              return baseUrl + payload + hash;
            }
            else if (payload.startsWith('&')) {
              if (queryString) {
                return baseUrl + '?' + queryString + payload + hash;
              } else {
                return baseUrl + '?' + payload.slice(1) + hash;
              }
            }
            else if (queryString) {
              const params = queryString.split('&');
              if (params.length > 0) {
                const firstParam = params[0].split('=')[0];
                params[0] = firstParam + '=' + payload;
                return baseUrl + '?' + params.join('&') + hash;
              } else {
                return baseUrl + '?param=' + payload + hash;
              }
            }
            else {
              return baseUrl + '?param=' + payload + hash;
            }
          };

          const finalUrl = buildUrl(currentUrl, payload);

          if (finalUrl && finalUrl !== currentUrl) {
            window.location.href = finalUrl;
            return { success: true };
          }
          return { success: false, message: 'URL unchanged' };
        } catch (e) {
          return { success: false, error: e.toString() };
        }
      })();
      `);

      if (error) {
        console.error("DevTools eval error:", error);
        showTemporaryMessage('Injection failed: ' + error, 'error');
      } else if (result && result.success) {
        console.log("Injection successful");
      }

      lastInjectionTime = Date.now();
      pendingPayload = null;

    } catch (e) {
      console.error("Injection failed:", e);
      showTemporaryMessage('Injection failed. Try refreshing the page.', 'error');
      pendingPayload = null;
    } finally {
      setTimeout(() => {
        isInjecting = false;
        pendingPayload = null;
      }, MIN_INJECTION_INTERVAL);
    }
  }

  /* ---------- HTML ENCODE/DECODE ---------- */
  let htmlToggle = false;

  htmlcodebtn.onclick = () => {
    transform(s => {
      if (!htmlToggle) {
        // Encode
        return s.replace(/[&<>"'\/=`]/g, char => {
          const entities = {
            '&': '&#x26;', '<': '&#x3C;', '>': '&#x3E;',
            '"': '&#x22;', "'": '&#x27;', '/': '&#x2F;',
            '=': '&#x3D;', '`': '&#x60;'
          };
          return entities[char] || char;
        });
      } else {
        // Decode
        return s.replace(/&#x([0-9A-F]{2});/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
        );
      }
    });
    htmlToggle = !htmlToggle;
    htmlcodebtn.textContent = htmlToggle ? 'HTML Decode' : 'HTML Encode';
  };

  /* ---------- SELECTION TRANSFORM ---------- */
  function transform(fn) {
    let s = payload.selectionStart, e = payload.selectionEnd;
    if (s === e) {
      showTemporaryMessage('Select text first!', 'info');
      return;
    }
    const out = fn(payload.value.slice(s, e));
    payload.value = payload.value.slice(0, s) + out + payload.value.slice(e);
    payload.selectionStart = s;
    payload.selectionEnd = s + out.length;
    autoGrow(payload);
  }

  /* ---------- URL TOGGLE ---------- */
  urlCodeBtn.onclick = () => transform(s => {
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      try {
        let d = s;
        while (d.includes('%')) {
          let n = decodeURIComponent(d);
          if (n === d) break;
          d = n;
        }
        return d;
      } catch { return s; }
    }
    return encodeURIComponent(s);
  });

  /* ---------- BASE64 TOGGLE ---------- */
  base64Btn.onclick = () => transform(s => {
    const b64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (b64Regex.test(s) && s.length > 3) {
      try {
        return atob(s);
      } catch { }
    }
    return btoa(s);
  });

  /* ---------- HEX TOGGLE ---------- */
  hexCodeBtn.onclick = () => transform(s => {
    const isHex = /^[0-9A-Fa-f\s]+$/.test(s) && s.replace(/\s+/g, '').length % 2 === 0;
    if (isHex) {
      try {
        const clean = s.replace(/\s+/g, '');
        let res = '';
        for (let i = 0; i < clean.length; i += 2) {
          res += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
        }
        return res;
      } catch { }
    }
    return s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
  });

  /* ---------- BYPASS ---------- */
  // [
  //   "'", '"', '`', '\\', '/', '<', '>', '#', ';', '|', '&', '&&', '||',
  //   '%00', '%0a', '%0d', '%09', '%20', '$()', '${}', '%3c', '%3e', '/">',
  //                         '<!--', '-->', '{{', '}}', '${', '}}', '{{'
  // ].forEach(c => {
  //   const b = document.createElement("span");
  //   b.className = "badge bypass";
  //   b.textContent = c;
  //   b.onclick = () => copyText(c);
  //   bypass.appendChild(b);
  // });

  /* ========== OPTIMIZED PAYLOAD DATABASE LOADING ========== */

  // Load the payload database
  // Add this function to your panel.js (add it after PAYLOAD_DB is loaded)
  function generateCategoryColors(modes) {
    let styleSheet = '';

    modes.forEach((mode, index) => {
      // Generate hue based on string hash (more consistent than index)
      const hash = mode.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0);

      const hue = Math.abs(hash % 360);
      const color = `hsl(${hue}, 75%, 65%)`;        // Brighter text
      const borderColor = `hsl(${hue}, 75%, 25%)`;   // Darker border
      const hoverBg = `hsla(${hue}, 50%, 15%, 0.8)`; // Subtle hover background

      styleSheet += `
      #modeBox .badge.mode[data-mode="${mode}"] {
      color: ${color} !important;
      border-color: ${borderColor} !important;
      background-color: var(--bg-darker) !important;
      }
      #modeBox .badge.mode[data-mode="${mode}"]:hover {
      background-color: ${hoverBg} !important;
      border-color: ${color} !important;
      }
      #modeBox .badge.mode.active[data-mode="${mode}"] {
      background-color: var(--accent) !important;
      color: var(--bg-darker) !important;
      border-color: var(--accent-hover) !important;
      }
      `;
    });

    // Add or update style tag
    let styleTag = document.getElementById('dynamic-category-colors');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-category-colors';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = styleSheet;
  }

  // Modify your loadPayloadStructure function to include color generation
  async function loadPayloadStructure() {
    try {
      const url = browser.runtime.getURL("payload_db.json");
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      PAYLOAD_DB = await response.json();

      // Generate dynamic colors for all categories
      const modes = Object.keys(PAYLOAD_DB);
      generateCategoryColors(modes);

      // Initialize with just the structure
      initAppStructure();

    } catch (error) {
      console.error("Error loading payloads:", error);
      payloadBox.innerHTML = "<div class='error'>Error loading payload database</div>";
    }
  }

  // Initialize only mode and type structure without loading payloads
  function initAppStructure() {
    modeBox.innerHTML = "";
    typeBox.innerHTML = "";
    payloadBox.innerHTML = "<div class='loading'>Select a category to load payloads</div>";

    const modes = Object.keys(PAYLOAD_DB);

    if (modes.length === 0) {
      payloadBox.innerHTML = "<div class='error'>No payloads found</div>";
      return;
    }

    modes.forEach((m, i) => {
      const b = document.createElement("span");
      b.className = "badge mode";
      b.dataset.mode = m;
      b.textContent = m.toUpperCase();

      b.onclick = () => {
        document.querySelectorAll(".badge.mode").forEach(x => x.classList.remove("active"));
        b.classList.add("active");

        currentMode = m;
        renderTypes(m);
      };

      modeBox.appendChild(b);

      if (i === 0) {
        b.classList.add("active");
        currentMode = m;
        renderTypes(m);
      }
    });
  }

  function renderTypes(m) {
    typeBox.innerHTML = "";

    // Show loading in payload box
    payloadBox.innerHTML = "<div class='loading'>Loading types...</div>";

    if (!PAYLOAD_DB[m]) return;

    const types = Object.keys(PAYLOAD_DB[m]);

    types.forEach((t, i) => {
      const b = document.createElement("span");
      b.className = "badge type";
      b.textContent = t;

      b.onclick = () => {
        document.querySelectorAll(".badge.type").forEach(x => x.classList.remove("active"));
        b.classList.add("active");

        currentType = t;
        currentPage = 0;
        searchTerm = ''; // Reset search

        // Store total count but don't load all payloads yet
        if (PAYLOAD_DB[m] && PAYLOAD_DB[m][t]) {
          allLoadedPayloads = []; // Clear previous payloads
          totalPayloadCount = PAYLOAD_DB[m][t].length;
          loadPayloadBatch(m, t, 0, true); // Load first batch
        }
      };

      typeBox.appendChild(b);

      if (i === 0) {
        b.classList.add("active");
        currentType = t;

        // Store total count but don't load all payloads yet
        if (PAYLOAD_DB[m] && PAYLOAD_DB[m][t]) {
          allLoadedPayloads = [];
          totalPayloadCount = PAYLOAD_DB[m][t].length;
          loadPayloadBatch(m, t, 0, true);
        }
      }
    });
  }

  // Load payloads in batches
  function loadPayloadBatch(mode, type, page = 0, reset = false) {
    if (!PAYLOAD_DB[mode] || !PAYLOAD_DB[mode][type]) return;

    const allDbPayloads = PAYLOAD_DB[mode][type];

    if (reset) {
      currentPage = 0;
      payloadBox.innerHTML = "";

      // Add search box if there are many payloads
      if (totalPayloadCount > 20) {
        addSearchBox();
      }

      // Show count info
      addPayloadCountInfo(totalPayloadCount);
    }

    const start = page * PAYLOAD_BATCH_SIZE;
    const end = Math.min(start + PAYLOAD_BATCH_SIZE, allDbPayloads.length);

    if (start >= allDbPayloads.length) return;

    // Load only the current batch from the full DB
    const currentBatch = allDbPayloads.slice(start, end);

    // Store in our local array for search functionality
    if (reset) {
      allLoadedPayloads = currentBatch;
    } else {
      allLoadedPayloads = [...allLoadedPayloads, ...currentBatch];
    }

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();

    currentBatch.forEach(p => {
      const d = document.createElement("div");
      d.className = "badge payload";
      d.textContent = p;
      d.onclick = () => {
        payload.value = p;
        autoGrow(payload);
        copyText(p);
      };
      fragment.appendChild(d);
    });

    payloadBox.appendChild(fragment);

    // Check if we have more payloads to load
    const loadedCount = allLoadedPayloads.length;

    if (loadedCount < totalPayloadCount) {
      // Remove existing load more button if any
      const existingBtn = document.getElementById("loadMoreBtn");
      if (existingBtn) existingBtn.remove();

      addLoadMoreButton(mode, type, page + 1, loadedCount, totalPayloadCount);
    } else {
      // Remove load more button if all loaded
      const existingBtn = document.getElementById("loadMoreBtn");
      if (existingBtn) existingBtn.remove();

      // Show end message
      addEndMessage();
    }
  }

  function addPayloadCountInfo(total) {
    // Remove existing count info if any
    const existingCount = document.getElementById("payloadCountInfo");
    if (existingCount) existingCount.remove();

    const countInfo = document.createElement("div");
    countInfo.id = "payloadCountInfo";
    countInfo.className = "count-info";
    countInfo.textContent = `Total: ${total} payloads • Showing ${PAYLOAD_BATCH_SIZE}`;

    // Insert after search box if exists, otherwise at the beginning
    const searchBox = document.getElementById("searchContainer");
    if (searchBox) {
      searchBox.insertAdjacentElement('afterend', countInfo);
    } else {
      payloadBox.insertBefore(countInfo, payloadBox.firstChild);
    }
  }

  function addSearchBox() {
    // Remove existing search if any
    const existingSearch = document.getElementById("searchContainer");
    if (existingSearch) existingSearch.remove();

    const searchContainer = document.createElement("div");
    searchContainer.id = "searchContainer";
    searchContainer.className = "search-box";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "search-input";
    searchInput.placeholder = "🔍 Search in loaded payloads... (Press Enter)";

    searchInput.onkeyup = (e) => {
      if (e.key === 'Enter') {
        searchTerm = e.target.value.toLowerCase();
        filterPayloads();
      }
    };

    searchInput.oninput = (e) => {
      if (e.target.value === '') {
        searchTerm = '';
        renderLoadedPayloads();
      }
    };

    // Add search button
    const searchBtn = document.createElement("button");
    searchBtn.textContent = "Search";
    searchBtn.style.marginTop = "5px";
    searchBtn.style.width = "100%";
    searchBtn.onclick = () => {
      searchTerm = searchInput.value.toLowerCase();
      filterPayloads();
    };

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchBtn);

    payloadBox.insertBefore(searchContainer, payloadBox.firstChild);
  }

  function filterPayloads() {
    if (!searchTerm) {
      renderLoadedPayloads();
      return;
    }

    // Search only in loaded payloads
    const filtered = allLoadedPayloads.filter(p =>
    p.toLowerCase().includes(searchTerm)
    );

    renderFilteredPayloads(filtered);
  }

  function renderLoadedPayloads() {
    // Keep the search box and count info but re-render all loaded payloads
    const searchContainer = document.getElementById("searchContainer");
    const countInfo = document.getElementById("payloadCountInfo");

    // Store elements to preserve
    const searchHTML = searchContainer ? searchContainer.outerHTML : '';
    const countHTML = countInfo ? countInfo.outerHTML : '';

    payloadBox.innerHTML = searchHTML + countHTML;

    // Re-render all loaded payloads
    const fragment = document.createDocumentFragment();

    allLoadedPayloads.forEach(p => {
      const d = document.createElement("div");
      d.className = "badge payload";
      d.textContent = p;
      d.onclick = () => {
        payload.value = p;
        autoGrow(payload);
        copyText(p);
      };
      fragment.appendChild(d);
    });

    payloadBox.appendChild(fragment);

    // Restore load more button if needed
    const loadedCount = allLoadedPayloads.length;
    if (loadedCount < totalPayloadCount) {
      addLoadMoreButton(currentMode, currentType, Math.floor(loadedCount / PAYLOAD_BATCH_SIZE), loadedCount, totalPayloadCount);
    } else if (loadedCount === totalPayloadCount && totalPayloadCount > 0) {
      addEndMessage();
    }
  }

  function renderFilteredPayloads(filtered) {
    // Keep search box but replace results
    const searchContainer = document.getElementById("searchContainer");
    const searchHTML = searchContainer ? searchContainer.outerHTML : '';

    payloadBox.innerHTML = searchHTML;

    if (filtered.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "loading";
      noResults.style.padding = "20px";
      noResults.textContent = "🔍 No matching payloads in loaded set";
      payloadBox.appendChild(noResults);
      return;
    }

    // Show search results info
    const resultInfo = document.createElement("div");
    resultInfo.className = "count-info";
    resultInfo.textContent = `🔍 Found ${filtered.length} matches in loaded payloads`;
    payloadBox.appendChild(resultInfo);

    const fragment = document.createDocumentFragment();

    filtered.forEach(p => {
      const d = document.createElement("div");
      d.className = "badge payload";

      // Highlight search term
      if (searchTerm) {
        const index = p.toLowerCase().indexOf(searchTerm);
        if (index !== -1) {
          const before = p.substring(0, index);
          const match = p.substring(index, index + searchTerm.length);
          const after = p.substring(index + searchTerm.length);
          d.innerHTML = `${before}<span class="search-highlight">${match}</span>${after}`;
        } else {
          d.textContent = p;
        }
      } else {
        d.textContent = p;
      }

      d.onclick = () => {
        payload.value = p;
        autoGrow(payload);
        copyText(p);
      };
      fragment.appendChild(d);
    });

    payloadBox.appendChild(fragment);
  }

  function addLoadMoreButton(mode, type, nextPage, loadedCount, totalCount) {
    // Remove existing load more button if any
    const existingBtn = document.getElementById("loadMoreBtn");
    if (existingBtn) existingBtn.remove();

    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.id = "loadMoreBtn";
    loadMoreBtn.className = "load-more-btn";
    loadMoreBtn.innerHTML = `⬇️ Load More (${loadedCount}/${totalCount}) ⬇️`;

    loadMoreBtn.onclick = () => {
      loadMoreBtn.innerHTML = '⏳ Loading...';
      loadMoreBtn.disabled = true;

      setTimeout(() => {
        loadPayloadBatch(mode, type, nextPage);
      }, 100);
    };

    payloadBox.appendChild(loadMoreBtn);
  }

  function addEndMessage() {
    // Remove existing end message if any
    const existingMsg = document.getElementById("endMessage");
    if (existingMsg) existingMsg.remove();

    const endMsg = document.createElement("div");
    endMsg.id = "endMessage";
    endMsg.className = "end-message";
    endMsg.textContent = '<<---------end------->>';
    payloadBox.appendChild(endMsg);
  }

  /* ---------- ADD CACHE FOR FREQUENTLY ACCESSED PAYLOADS ---------- */
  const payloadCache = new Map();

  function getCachedPayload(mode, type) {
    const key = `${mode}:${type}`;
    if (payloadCache.has(key)) {
      return payloadCache.get(key);
    }
    return null;
  }

  function cachePayload(mode, type, data) {
    const key = `${mode}:${type}`;
    payloadCache.set(key, data);

    // Limit cache size to prevent memory issues
    if (payloadCache.size > 10) {
      const firstKey = payloadCache.keys().next().value;
      payloadCache.delete(firstKey);
    }
  }

  // Helper function for temporary messages
  function showTemporaryMessage(text, type = 'info') {
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    padding: 8px 12px;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    ${type === 'error' ? 'background: #f44336;' : 'background: #4caf50;'}
    `;
    msgDiv.textContent = text;
    document.body.appendChild(msgDiv);
    setTimeout(() => msgDiv.remove(), 2000);
  }

  // Add keyboard shortcut for injection (Ctrl+Enter)
  payload.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      injectBtn.click();
    }
  });

  /* ---------- LOAD THE DATABASE ---------- */
  await loadPayloadStructure();
});
