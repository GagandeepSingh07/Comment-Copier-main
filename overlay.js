(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const sizeEl = document.getElementById('size');
    const dpr = window.devicePixelRatio || 1;

    let originX = 0, originY = 0;
    let drawing = false;
    let start = null;
    let current = null;

    function resize() {
        // Pin the canvas's on-screen (CSS) size to the viewport explicitly.
        // Without this, setting canvas.width/height to physical-pixel values
        // (for a crisp backing store on HiDPI/scaled displays) also becomes
        // the canvas's default LAYOUT size when no CSS size is set — at 125%
        // scaling that made the canvas render ~25% larger than the actual
        // screen in each direction, overflowing the window and making the
        // overlay scrollable/draggable past the real screen edge.
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render();
    }

    function render() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        // Dim the whole virtual desktop.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, w, h);

        if (!current) return;

        const r = normalized(current);
        // Clear the dim inside the selection so that region is visible.
        ctx.clearRect(r.x, r.y, r.width, r.height);
        // Selection border.
        ctx.strokeStyle = '#2f81f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
        // Corner handles.
        ctx.fillStyle = '#2f81f7';
        const hs = 6;
        ctx.fillRect(r.x - hs / 2, r.y - hs / 2, hs, hs);
        ctx.fillRect(r.x + r.width - hs / 2, r.y - hs / 2, hs, hs);
        ctx.fillRect(r.x - hs / 2, r.y + r.height - hs / 2, hs, hs);
        ctx.fillRect(r.x + r.width - hs / 2, r.y + r.height - hs / 2, hs, hs);

        if (r.width > 0 && r.height > 0) {
            sizeEl.style.display = 'block';
            sizeEl.textContent = `${Math.round(r.width)} \u00d7 ${Math.round(r.height)} px`;
        } else {
            sizeEl.style.display = 'none';
        }
    }

    function normalized(r) {
        return {
            x: Math.min(r.x, r.x + r.w),
            y: Math.min(r.y, r.y + r.h),
            width: Math.abs(r.w),
            height: Math.abs(r.h),
        };
    }

    const onDown = (e) => {
        drawing = true;
        start = { x: e.clientX, y: e.clientY };
        current = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
        render();
    };

    const onMove = (e) => {
        if (!drawing || !start) return;
        current = { x: start.x, y: start.y, w: e.clientX - start.x, h: e.clientY - start.y };
        render();
    };

    const onUp = (e) => {
        if (!drawing) return;
        drawing = false;
        if (!current) { current = null; render(); return; }
        const r = normalized(current);
        current = null;
        render();
        if (r.width >= 4 && r.height >= 4) {
            if (window.overlayAPI) {
                window.overlayAPI.select({ x: r.x, y: r.y, width: r.width, height: r.height });
            }
        }
    };

    const onKey = (e) => {
        if (e.key === 'Escape') {
            if (window.overlayAPI) window.overlayAPI.cancel();
        }
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    document.addEventListener('contextmenu', (e) => {
        if (!drawing && !current) e.preventDefault();
    });

    if (window.overlayAPI && window.overlayAPI.onInit) {
        window.overlayAPI.onInit((payload) => {
            originX = payload.originX;
            originY = payload.originY;
            if (payload.existing && payload.existing.width > 0 && payload.existing.height > 0) {
                current = {
                    x: payload.existing.x,
                    y: payload.existing.y,
                    w: payload.existing.width,
                    h: payload.existing.height,
                };
                render();
            }
            // Focus so keydown (Esc) is received.
            window.focus();
        });
    }

    resize();
    window.focus();
})();
