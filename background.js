// background.js — MV3, Firefox compatible
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'injectPayload') return false;

    const { tabId, payload } = message;

    function buildAndNavigate(payload) {
        try {
            const currentUrl = window.location.href;

            const hashIndex = currentUrl.indexOf('#');
            const hash = hashIndex !== -1 ? currentUrl.slice(hashIndex) : '';
            const urlWithoutHash = hashIndex !== -1 ? currentUrl.slice(0, hashIndex) : currentUrl;
            const queryIndex = urlWithoutHash.indexOf('?');
            const baseUrl = queryIndex !== -1 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
            const queryString = queryIndex !== -1 ? urlWithoutHash.slice(queryIndex + 1) : '';

            let finalUrl;
            if (payload.startsWith('#')) {
                finalUrl = baseUrl + (queryString ? '?' + queryString : '') + payload;
            } else if (payload.startsWith('?')) {
                finalUrl = baseUrl + payload + hash;
            } else if (payload.startsWith('&')) {
                finalUrl = queryString
                ? baseUrl + '?' + queryString + payload + hash
                : baseUrl + '?' + payload.slice(1) + hash;
            } else if (queryString) {
                const params = queryString.split('&');
                const firstParam = params[0].split('=')[0];
                params[0] = firstParam + '=' + payload;
                finalUrl = baseUrl + '?' + params.join('&') + hash;
            } else {
                finalUrl = baseUrl + '?param=' + payload + hash;
            }

            if (finalUrl && finalUrl !== currentUrl) {
                setTimeout(() => { window.location.href = finalUrl; }, 0);
            }
        } catch(e) {
            console.error('Injection error:', e);
        }
    }

    // MV3: scripting.executeScript with func + args
    browser.scripting.executeScript({
        target: { tabId: tabId },
        func: buildAndNavigate,
        args: [payload]
    })
    .then(() => sendResponse({ success: true }))
    .catch((e) => {
        const msg = (e.message || '').toLowerCase();
        // Navigation/frame errors just mean the redirect happened — treat as success
        if (msg.includes('navigation') || msg.includes('frame') || msg.includes('unexpected') || msg.includes('no tab')) {
            sendResponse({ success: true, navigationError: true });
        } else {
            console.error('executeScript error:', e);
            sendResponse({ success: false, error: e.message });
        }
    });

    return true; // keep sendResponse channel open
});
