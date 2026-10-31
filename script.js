/* ==========================================================
   Portfolio book — flip logic.

   Quick mental model:
   - Each .sheet is one piece of paper. It has a front face
     and a back face. When we add .flipped to a sheet, it
     rotates 180° and we're now looking at its back.

   - On desktop we flip whole sheets. The "current" number is
     how many sheets are already flipped (0 = cover, 4 = back).

   - On phones we show one page at a time inside a book frame,
     with a short 3D page-turn animation.
   ========================================================== */

(function () {

    const bookEl   = document.getElementById('book');
    const sheets   = Array.from(document.querySelectorAll('.sheet'));
    const prevBtn  = document.getElementById('prevBtn');
    const nextBtn  = document.getElementById('nextBtn');
    const statusEl = document.getElementById('status');
    const toastEl  = document.getElementById('toast');

    const SHEET_COUNT = sheets.length;
    const PAGE_COUNT  = SHEET_COUNT * 2;
    const FLIP_MS     = 900;                // keep in sync with CSS

    // current state
    let flippedSheets = 0;   // desktop: how many sheets are on the left
    let currentPage   = 0;   // mobile: which face is visible
    let mobileMode    = false;
    let busy          = false;   // true while a flip is animating
    let mobileTurnId  = 0;

    /* ---------- tiny helpers ---------- */

    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    function toast(text) {
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
    }

    // what to show in the little status label
    function labelFor(sheetIndex) {
        if (sheetIndex === 0) return 'Cover';
        if (sheetIndex === SHEET_COUNT) return 'Back cover';
        return `${sheetIndex * 2} – ${sheetIndex * 2 + 1}`;
    }

    /* ---------- desktop: stack sheets in the right order ---------- */

    function restack() {
        // flipped sheets pile up on the left, unflipped on the right
        sheets.forEach((sheet, i) => {
            sheet.style.zIndex = (i < flippedSheets)
                ? String(i + 1)
                : String(SHEET_COUNT - i + 10);
        });
    }

    /* ---------- desktop: flip to a given sheet index ---------- */

    function flipTo(target) {
        target = clamp(target, 0, SHEET_COUNT);
        if (busy || target === flippedSheets) return;
        busy = true;

        const changed = [];

        sheets.forEach((sheet, i) => {
            const shouldBeFlipped = i < target;
            const currentlyFlipped = sheet.classList.contains('flipped');

            if (shouldBeFlipped !== currentlyFlipped) {
                changed.push(i);
                sheet.classList.add('flipping');
            }
            sheet.classList.toggle('flipped', shouldBeFlipped);
        });

        flippedSheets = target;

        // keep the moving sheet on top while it turns
        sheets.forEach((sheet, i) => {
            sheet.style.zIndex = changed.includes(i)
                ? '300'
                : (i < flippedSheets ? String(i + 1) : String(SHEET_COUNT - i + 10));
        });

        refreshUI();

        setTimeout(() => {
            sheets.forEach(s => s.classList.remove('flipping'));
            restack();
            busy = false;
        }, FLIP_MS);
    }

    /* ---------- mobile: show one face at a time ---------- */

    function renderMobile(direction, previousPage) {
        const turnId = ++mobileTurnId;
        const sheetIndex = Math.floor(currentPage / 2);
        const showingBack = currentPage % 2 === 1;
        const previousSheetIndex = direction ? Math.floor(previousPage / 2) : -1;
        const previousFaceIsBack = previousPage % 2 === 1;

        sheets.forEach((sheet, i) => {
            const isActive = i === sheetIndex;
            const isOutgoing = i === previousSheetIndex && direction;
            sheet.classList.toggle('m-active', isActive || isOutgoing);
            sheet.classList.toggle('m-outgoing', Boolean(isOutgoing));

            const front = sheet.querySelector('.face.front');
            const back  = sheet.querySelector('.face.back');
            const outgoingFace = previousFaceIsBack ? back : front;
            const incomingFace = showingBack ? back : front;

            [front, back].forEach(face => {
                if (!face) return;
                face.classList.remove('m-turn-out-next', 'm-turn-out-prev');
                face.onanimationend = null;
                face.classList.toggle('m-show', isActive && face === incomingFace);
            });

            if (isOutgoing && outgoingFace) {
                outgoingFace.classList.add('m-show');
                outgoingFace.classList.add(direction === 'next' ? 'm-turn-out-next' : 'm-turn-out-prev');
                outgoingFace.onanimationend = () => {
                    if (turnId !== mobileTurnId) return;
                    outgoingFace.classList.remove('m-show', 'm-turn-out-next', 'm-turn-out-prev');
                    sheet.classList.remove('m-outgoing');
                    outgoingFace.onanimationend = null;
                };
            }
        });
    }

    /* ---------- refresh nav / label ---------- */

    function refreshUI() {
        if (mobileMode) {
            statusEl.textContent = `Page ${currentPage + 1} / ${PAGE_COUNT}`;
            prevBtn.disabled = currentPage === 0;
            nextBtn.disabled = currentPage === PAGE_COUNT - 1;
        } else {
            statusEl.textContent = labelFor(flippedSheets);
            prevBtn.disabled = flippedSheets === 0;
            nextBtn.disabled = flippedSheets === SHEET_COUNT;
        }
    }

    /* ---------- user actions ---------- */

    function goNext() {
        if (mobileMode) {
            if (currentPage < PAGE_COUNT - 1) {
                const previousPage = currentPage;
                currentPage++;
                renderMobile('next', previousPage);
                refreshUI();
            }
        } else {
            flipTo(flippedSheets + 1);
        }
    }

    function goPrev() {
        if (mobileMode) {
            if (currentPage > 0) {
                const previousPage = currentPage;
                currentPage--;
                renderMobile('prev', previousPage);
                refreshUI();
            }
        } else {
            flipTo(flippedSheets - 1);
        }
    }

    // Jump straight to a page number (used by "View Projects" etc.)
    function jumpTo(pageIndex) {
        pageIndex = clamp(pageIndex, 0, PAGE_COUNT - 1);

        if (mobileMode) {
            const direction = pageIndex === currentPage ? null : pageIndex > currentPage ? 'next' : 'prev';
            const previousPage = currentPage;
            currentPage = pageIndex;
            renderMobile(direction, previousPage);
            refreshUI();
        } else {
            flipTo(Math.ceil(pageIndex / 2));
        }
    }

    /* ---------- desktop ↔ mobile switch ---------- */

    function switchMode(shouldBeMobile) {
        if (shouldBeMobile === mobileMode) return;
        mobileMode = shouldBeMobile;
        document.body.classList.toggle('mobile', mobileMode);

        if (mobileMode) {
            // pick up where we left off
            currentPage = Math.min(flippedSheets * 2, PAGE_COUNT - 1);

            sheets.forEach(s => {
                s.classList.remove('flipped', 'flipping');
                s.style.zIndex = '';
            });
            renderMobile();
        } else {
            mobileTurnId++;
            flippedSheets = Math.min(Math.ceil(currentPage / 2), SHEET_COUNT);

            sheets.forEach((s, i) => {
                s.classList.add('no-anim');
                s.classList.toggle('flipped', i < flippedSheets);
                s.classList.remove('m-active', 'm-outgoing');
                [s.querySelector('.face.front'), s.querySelector('.face.back')].forEach(face => {
                    face.classList.remove('m-show', 'm-turn-next', 'm-turn-prev', 'm-turn-out-next', 'm-turn-out-prev');
                    face.onanimationend = null;
                });
            });

            // force a reflow so removing .no-anim actually re-enables transitions
            void bookEl.offsetWidth;
            sheets.forEach(s => s.classList.remove('no-anim'));
            restack();
        }

        refreshUI();
    }

    /* ---------- scale the book to fit the screen ---------- */

    function fitToScreen() {
        if (mobileMode) {
            document.documentElement.style.setProperty('--s', '1');
            return;
        }
        const availW = window.innerWidth - 56;
        const availH = window.innerHeight - 200;
        const scale = Math.min(availW / 1040, availH / 660, 1);
        document.documentElement.style.setProperty('--s', String(Math.max(0.3, scale)));
    }

    function handleResize() {
        switchMode(window.innerWidth < 860);
        fitToScreen();
        refreshUI();
    }

    /* ---------- wire up the buttons ---------- */

    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);

    /* keyboard shortcuts — handy on desktop */
    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea')) return;

        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
        if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); goPrev(); }
        if (e.key === 'Home') { e.preventDefault(); jumpTo(0); }
        if (e.key === 'End')  { e.preventDefault(); jumpTo(PAGE_COUNT - 1); }
    });

    /* swipe / drag on the book itself */
    let drag = null;

    bookEl.addEventListener('pointerdown', e => {
        if (e.target.closest('input, textarea, button, a, form')) return;
        drag = { x: e.clientX, y: e.clientY, time: Date.now() };
    });

    bookEl.addEventListener('pointerup', e => {
        if (!drag) return;

        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const dt = Date.now() - drag.time;
        drag = null;

        // ignore slow drags and mostly-vertical movements
        if (dt > 900) return;
        if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

        dx < 0 ? goNext() : goPrev();
    });

    bookEl.addEventListener('pointercancel', () => { drag = null; });

    /* buttons / links inside the pages that jump around */
    document.querySelectorAll('[data-go]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const page = parseInt(el.dataset.go, 10);
            if (!isNaN(page)) jumpTo(page);
        });
    });

    /* demo-only links — just show a toast */
    document.querySelectorAll('[data-demo]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            toast(el.dataset.demo || 'Demo action.');
        });
    });

    /* contact form — validates and pretends to send */
    const form = document.getElementById('contactForm');
    form.addEventListener('submit', e => {
        e.preventDefault();

        const name  = form.querySelector('#cf-name').value.trim();
        const email = form.querySelector('#cf-email').value.trim();
        const msg   = form.querySelector('#cf-msg').value.trim();

        if (!name || !email || !msg) return toast('Please fill in all fields.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('That email doesn\'t look right.');

        form.reset();
        toast('Message sent — I\'ll reply within 24 hours ✓');
    });

    /* ---------- boot ---------- */

    function init() {
        mobileMode = window.innerWidth < 860;
        document.body.classList.toggle('mobile', mobileMode);

        if (mobileMode) {
            currentPage = 0;
            renderMobile();
        } else {
            flippedSheets = 0;
            restack();
        }

        fitToScreen();
        refreshUI();
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));

    init();

})();