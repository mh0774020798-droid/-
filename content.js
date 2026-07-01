// משתנה גלובלי שיזכור את כתובת העמוד הנוכחי ואם המשתמש סגר את החלונית
let lastTopicId = null;
let isClosedByUser = false;

// ==========================================
// חלק 1: החלפת סמלי מדיה
// ==========================================
function updateMediaIcons() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const regex = /\[(image|video):\s*[^\]]+\]/gi;
    const mp4Regex = /\[([^\]]*\.mp4)\]/gi;

    while (node = walker.nextNode()) {
        if (node.nodeValue && (node.nodeValue.match(regex) || node.nodeValue.match(mp4Regex))) {
            node.nodeValue = node.nodeValue
                .replace(regex, (m, t) => (t.toLowerCase() === 'image' ? '🖼️' : '🎥'))
                .replace(mp4Regex, '🎥');
        }
    }
}

// ==========================================
// חלק 2: הפעלה ומעקב דינמי (עבור סמלי המדיה והחלפת אשכולות)
// ==========================================
const observer = new MutationObserver(() => {
    updateMediaIcons();
    
    // בדיקה אם עברנו אשכול כדי לאפס את מצב הסגירה
    const topicEl = document.querySelector('[component="topic"]');
    if (topicEl) {
        const currentTopicId = topicEl.getAttribute('data-tid');
        if (currentTopicId !== lastTopicId) {
            lastTopicId = currentTopicId;
            isClosedByUser = false; // איפוס – באשכול חדש החלונית תחזור
            createGeminiSummarizer();
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// ==========================================
// חלק 3: התראות קופצות על פוסטים/משתמשים במעקב
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
// חלק 4: סיכום אשכול ע"י Gemini AI (גרירה, מיזעור, סגירה וקישור למפתח)
// ==========================================
function createGeminiSummarizer() {
    // אם המשתמש סגר את החלונית באשכול זה, או שאנחנו לא באשכול, או שהיא כבר קיימת - לא יוצרים אותה
    if (isClosedByUser || !document.querySelector('[component="topic"]') || document.getElementById('gemini-summarizer-container')) return;

    // יצירת המיכל הראשי
    const container = document.createElement('div');
    container.id = 'gemini-summarizer-container';
    container.style.cssText = `
        position: fixed; top: 70px; left: 20px; z-index: 9999;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 300px;
        font-family: system-ui, sans-serif; direction: rtl; overflow: hidden;
    `;

    // כותרת החלונית (אזור הגרירה)
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

    // גוף החלונית
    const body = document.createElement('div');
    body.id = 'gemini-summarizer-body';
    body.style.cssText = `padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;`;

    // תיבת קלט למפתח ה-API
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.placeholder = 'הזן מפתח Google Studio API...';
    keyInput.style.cssText = `width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; margin-bottom: 2px;`;
    
    if(localStorage.getItem('gemini_api_key')) {
        keyInput.value = localStorage.getItem('gemini_api_key');
    }
    body.appendChild(keyInput);

    // קישור לעמוד המפתחים של גוגל סטודיו
    const linkContainer = document.createElement('div');
    linkContainer.style.cssText = `font-size: 11px; margin-top: -4px; margin-bottom: 4px;`;
    linkContainer.innerHTML = `<a href="https://aistudio.google.com/api-keys?project=project-c76f0d6b-607f-453b-ab5" target="_blank" style="color: #028090; text-decoration: underline; font-weight: 500;">🔑 לחץ כאן לקבלת מפתח ב-Google Studio</a>`;
    body.appendChild(linkContainer);

    // כפתור ביצוע הסיכום
    const sumBtn = document.createElement('button');
    sumBtn.innerText = '✨ סכם מהיר ב-Gemini AI';
    sumBtn.style.cssText = `background: #00a896; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;`;
    body.appendChild(sumBtn);

    // אזור הצגת תוצאת הסיכום
    const resultArea = document.createElement('div');
    resultArea.id = 'gemini-result-area';
    resultArea.style.cssText = `font-size: 13px; color: #222; line-height: 1.6; white-space: pre-wrap; margin-top: 5px; border-top: 1px dashed #ddd; padding-top: 8px;`;
    body.appendChild(resultArea);

    container.appendChild(body);
    document.body.appendChild(container);

    // 1. מנגנון גרירה (Drag and Drop)
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

    // 2. מנגנון מיזעור והרחבה
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

    // 3. מנגנון סגירה סופית באשכול הנוכחי
    const closeBtn = document.getElementById('gemini-close-btn');
    closeBtn.onclick = () => {
        isClosedByUser = true;
        container.remove();
    };

    // אירוע לחיצה על כפתור הסיכום
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

        resultArea.innerHTML = "⏳ Gemini מנתח את האשכול, אנא המתן...";
        sumBtn.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `אתה אנליסט מומחה שתפקידו לסכם אשכול פורום מורכב בצורה המקצועית, העמוקה והברורה ביותר בעברית.
הנה תוכן האשכול (הודעות מופרדות ב- ---):
\n${threadContent}\n
אנא בצע ניתוח וסיכום ברמה גבוהה מאוד לפי המבנה הבא:
1. 🎯 **הנושא המרכזי / מהות הדיון:** (תמצות קצר של הבעיה או הנושא שהועלה בפוסט הראשון).
2. 💬 **נקודות מרכזיות ועמדות בולטות:** (מה היו הפתרונות, הרעיונות או חילוקי הדעות העיקריים שעלו מצד המשתמשים השונים).
3. 🏁 **שורה תחתונה / מסקנה:** (האם נמצא פתרון? מהי המסקנה הסופית של האשכול).

כתוב בצורה קולחת, אינטליגנטית ומאורגנת היטב.`
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                resultArea.innerText = data.candidates[0].content.parts[0].text;
            } else {
                console.error("Gemini Error Response:", data);
                resultArea.innerText = "שגיאה: לא התקבלה תשובה תקינה מהמודל. ודא שהמפתח תקין ופעיל.";
            }
        } catch (err) {
            console.error(err);
            resultArea.innerText = "התרחשה שגיאה בתקשורת עם Gemini API.";
        } finally {
            sumBtn.disabled = false;
        }
    };
}

// הרצה ראשונית
updateMediaIcons();
setupNotificationAlerts();
createGeminiSummarizer();
