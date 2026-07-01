// ==========================================
// חלק 1: החלפת סמלי מדיה (תמונות וסרטונים כולל MP4)
// ==========================================
const mediaEmojiMap = {
    'image': '🖼️',
    'video': '🎥'
};

function replaceMediaText(node) {
    // זיהוי תבניות NodeBB כמו [image: ...] או [video: ...] - עכשיו תופס גם נקודות וסיומות
    const nodebbRegex = /\[(image|video):\s*[^\]]+\]/gi;
    
    // זיהוי ישיר של קבצי סרטונים (כמו קבצים שמסתיימים ב-.mp4) בתוך סוגריים מרובעים
    const mp4Regex = /\[([^\]]*\.mp4)\](?:\([^\)]+\))?/gi;

    if (node.nodeType === Node.TEXT_NODE) {
        let val = node.nodeValue;
        
        // החלפת תבניות מובנות (image/video)
        val = val.replace(nodebbRegex, (match, mediaType) => {
            return mediaEmojiMap[mediaType.toLowerCase()] || match;
        });

        // החלפת אזכורים ישירים של קבצי MP4 בסמל של סרטון
        val = val.replace(mp4Regex, '🎥');

        node.nodeValue = val;
    } else {
        for (let i = 0; i < node.childNodes.length; i++) {
            replaceMediaText(node.childNodes[i]);
        }
    }
}

// ==========================================
// חלק 2: שדרוג עורך הטקסט (כתיבת פוסטים)
// ==========================================
function enhanceComposer() {
    const textareas = document.querySelectorAll('.composer textarea, .write');

    textareas.forEach(textarea => {
        if (textarea.dataset.enhanced) return;
        textarea.dataset.enhanced = "true";

        textarea.setAttribute('dir', 'auto');

        textarea.addEventListener('keyup', () => {
            let val = textarea.value;
            let originalLength = val.length;

            val = val.replace(/([^\n])(::: spoiler|\[spoiler\]|>!)/g, '$1\n\n$2');

            if (val.length !== originalLength) {
                let cursorPos = textarea.selectionStart;
                textarea.value = val;
                textarea.selectionStart = textarea.selectionEnd = cursorPos + (val.length - originalLength);
            }
        });
        
        window.addEventListener('beforeunload', (e) => {
            if (textarea.value.trim().length > 10) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    });
}

// ==========================================
// חלק 3: הפעלה והאזנה לשינויים בעמוד
// ==========================================
replaceMediaText(document.body);
enhanceComposer();

const observer = new MutationObserver((mutations) => {
    let shouldEnhanceComposer = false;

    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((addedNode) => {
            replaceMediaText(addedNode);
            
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
                if (addedNode.classList && addedNode.classList.contains('composer')) {
                    shouldEnhanceComposer = true;
                }
            }
        });
    });

    if (shouldEnhanceComposer) {
        enhanceComposer();
    }
});

observer.observe(document.body, { childList: true, subtree: true });