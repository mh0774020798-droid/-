// ==========================================
// משתנים גלובליים (לסיכום אשכולות)
// ==========================================
let lastTopicId = null;
let isClosedByUser = false;
const mediaEmojiMap = { 'image': '🖼️', 'video': '🎥' };

// ==========================================
// חלק 1: החלפת סמלי מדיה וטיפול חכם בקישורים (כוכביות באמצע הטקסט)
// ==========================================
function replaceMediaAndLinksInPosts() {
    const posts = document.querySelectorAll('[component="post/content"], .post-content');
    
    posts.forEach(post => {
        const nodebbRegex = /\[(image|video):\s*[^\]]+\]/gi;
        const mp4Regex = /\[([^\]]*\.mp4)\](?:\([^\)]+\))?/gi;

        const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.parentElement.closest('.spoiler-wrapper') || node.parentElement.classList.contains('spoiler-trigger')) {
                continue;
            }
            let val = node.nodeValue;
            val = val.replace(nodebbRegex, (m, t) => mediaEmojiMap[t.toLowerCase()] || m);
            val = val.replace(mp4Regex, '🎥');
            if (node.nodeValue !== val) {
                node.nodeValue = val;
            }
        }

        const links = post.querySelectorAll('a:not(.spoiler-trigger):not(.stars-processed)');
        links.forEach(link => {
            const originalHref = link.href;
            const originalText = link.textContent.trim();
            
            // דילוג על תיוגי משתמשים (Mentions) או קישורים ריקים
            if (!originalHref || originalHref.startsWith('javascript:') || 
                originalText.startsWith('@') || 
                link.classList.contains('plugin-mentions-a') || 
                link.classList.contains('plugin-mentions-user')) {
                return;
            }

            link.classList.add('stars-processed'); 

            // חיתוך הטקסט בדיוק באמצע ושתילת הכוכביות
            const midIndex = Math.floor(originalText.length / 2);
            const startText = originalText.substring(0, midIndex);
            const endText = originalText.substring(midIndex);
            
            link.textContent = startText + "*****" + endText;

            // שמירת הכתובת המקורית לפתיחה
            link.setAttribute('data-original-href', originalHref);

            link.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation();

                const cleanUrl = link.getAttribute('data-original-href');
                
                // הסרת הכוכביות בעת הלחיצה
                if (link.textContent.includes('*****')) {
                    link.textContent = link.textContent.replace('*****', '');
                }
                
                window.open(cleanUrl, '_blank');
            });
        });
    });
}

// ==========================================
// חלק 2: התראות קופצות על פוסטים/משתמשים במעקב
// ==========================================
function setupNotificationAlerts() {
    if (typeof window.socket !== 'undefined') {
        window.socket.on('event:new_notification', function(data) {
            if (window.app && typeof window.app.alert === 'function') {
                window.app.alert({
                    title: '🔔 התראה חדשה',
                    message: data.bodyShort || 'יש לך התראה חדשה מנושא או משתמש במעקב!',
                    type: 'info',
                    timeout: 5000,
                    clickfn: function() {
                        if (data.path) {
                            window.location.href = (data.path.startsWith('/') ? '' : '/') + data.path;
                        }
                    }
                });
            }
        });
    }
}

// ==========================================
// חלק 3: סיכום אשכול ע"י Gemini AI
// ==========================================
function createGeminiSummarizer() {
    if (isClosedByUser || !document.querySelector('[component="topic"]') || document.getElementById('gemini-summarizer-container')) return;

    const container = document.createElement('div');
    container.id = 'gemini-summarizer-container';
    container.style.cssText = `
        position: fixed; top: 70px; left: 20px; z-index: 9999;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 300px;
        font-family: system-ui, sans-serif; direction: rtl; overflow: hidden;
    `;

    const header = document.createElement('div');
    header.id = 'gemini-summarizer-header';
    header.style.cssText = `
        background: #028090; color: #fff; padding: 12px; font-weight: bold;
        display: flex; justify-content: space-between; align-items: center; 
        cursor: move; user-select: none;
    `;
    header.innerHTML = `
        <span>⚡ סיכום אשכול - Gemini AI</span>
        <div style="display: flex; gap: 10px; font-size: 14px;">
            <span id="gemini-minimize-btn" style="cursor: pointer; padding: 0 4px;">➖</span>
            <span id="gemini-close-btn" style="cursor: pointer; padding: 0 4px;">❌</span>
        </div>
    `;
    container.appendChild(header);

    const body = document.createElement('div');
    body.id = 'gemini-summarizer-body';
    body.style.cssText = `padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;`;

    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.placeholder = 'הזן מפתח Google Studio API...';
    keyInput.style.cssText = `width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; margin-bottom: 2px;`;
    
    if(localStorage.getItem('gemini_api_key')) {
        keyInput.value = localStorage.getItem('gemini_api_key');
    }
    body.appendChild(keyInput);

    const linkContainer = document.createElement('div');
    linkContainer.style.cssText = `font-size: 11px; margin-top: -4px; margin-bottom: 4px;`;
    linkContainer.innerHTML = `<a href="https://aistudio.google.com/api-keys?project=project-c76f0d6b-607f-453b-ab5" target="_blank" style="color: #028090; text-decoration: underline; font-weight: 500;">🔑 לחץ כאן לקבלת מפתח ב-Google Studio</a>`;
    body.appendChild(linkContainer);

    const sumBtn = document.createElement('button');
    sumBtn.innerText = '✨ סכם תמציתי ב-Gemini AI';
    sumBtn.style.cssText = `background: #00a896; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;`;
    body.appendChild(sumBtn);

    const resultArea = document.createElement('div');
    resultArea.id = 'gemini-result-area';
    resultArea.style.cssText = `font-size: 13px; color: #222; line-height: 1.6; white-space: pre-wrap; margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 8px;`;
    body.appendChild(resultArea);

    container.appendChild(body);
    document.body.appendChild(container);

    let isDragging = false;
    let currentX = 0, currentY = 0, initialX = 0, initialY = 0;
    let xOffset = 0, yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.id === 'gemini-minimize-btn' || e.target.id === 'gemini-close-btn') return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }

    function dragEnd() {
        isDragging = false;
    }

    const minimizeBtn = document.getElementById('gemini-minimize-btn');
    minimizeBtn.onclick = () => {
        if (body.style.display === 'none') {
            body.style.display = 'flex';
            minimizeBtn.innerText = '➖';
        } else {
            body.style.display = 'none';
            minimizeBtn.innerText = '➕';
        }
    };

    const closeBtn = document.getElementById('gemini-close-btn');
    closeBtn.onclick = () => {
        isClosedByUser = true;
        container.remove();
    };

    sumBtn.onclick = async () => {
        const apiKey = keyInput.value.trim();
        if (!apiKey) { alert('אנא הכנס מפתח API קודם לכן.'); return; }
        
        localStorage.setItem('gemini_api_key', apiKey);

        const posts = document.querySelectorAll('[component="post"]');
        let threadContent = "";
        
        posts.forEach((post, index) => {
            const author = post.getAttribute('data-username') || `משתמש ${index+1}`;
            const contentEl = post.querySelector('[component="post/content"]');
            if (contentEl) {
                threadContent += `[כותב: ${author}]: ${contentEl.innerText}\n---\n`;
            }
        });

        if (!threadContent) { resultArea.innerText = "לא נמצא תוכן לסיכום."; return; }

        resultArea.innerHTML = "⏳ Gemini מנתח את האשכול באופן תמציתי...";
        sumBtn.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `בצע סיכום קצר, תמציתי וממוקד מאוד (בנקודות קצרות וברורות) של אשכול הפורום הבא בעברית. 
אל תרחיב במילים, תהיה ענייני וישר לעניין:

${threadContent}

מבנה נדרש:
🎯 **הנושא:** (בשורה אחת)
💬 **נקודות מרכזיות:** (2-4 נקודות קצרות על מה שנאמר)
🏁 **שורה תחתונה:** (המסקנה או הפתרון הסופי)`
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                resultArea.innerText = data.candidates[0].content.parts[0].text;
            } else {
                console.error("Gemini Error Response:", data);
                resultArea.innerText = "שגיאה: לא התקבלה תשובה תקינה מהמודל.";
            }
        } catch (err) {
            console.error(err);
            resultArea.innerText = "התרחשה שגיאה בתקשורת עם Gemini API.";
        } finally {
            sumBtn.disabled = false;
        }
    };
}

// ==========================================
// חלק 4: הפעלה והאזנה לשינויים דינמיים בעמוד
// ==========================================
const observer = new MutationObserver(() => {
    replaceMediaAndLinksInPosts();
    
    const topicEl = document.querySelector('[component="topic"]');
    if (topicEl) {
        const currentTopicId = topicEl.getAttribute('data-tid');
        if (currentTopicId !== lastTopicId) {
            lastTopicId = currentTopicId;
            isClosedByUser = false; 
            createGeminiSummarizer();
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// הרצה ראשונית בטעינת העמוד
replaceMediaAndLinksInPosts();
setupNotificationAlerts();
createGeminiSummarizer();
