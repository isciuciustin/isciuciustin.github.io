/* ============================================================================
   isciuciustin.github.io — interaction layer
   Vanilla. No dependencies. Every effect is additive: with JS off the page is
   a complete, readable résumé.
   ========================================================================= */

(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function pick(str) { return str.charAt(Math.floor(Math.random() * str.length)); }

    /* ---------------------------------------------------------------------
       1. The logo — per-glyph decrypt, chromatic hover, alias flip on click
       --------------------------------------------------------------------- */

    var NOISE = "!<>-_\\/[]{}=+*^?#01ABCDEF@$%&";

    // Each segment's alias, revealed on click before decrypting back.
    var ALIASES = {
        JUSTIN: "R00T",
        HAKR: "0xDEADBEEF",
        FLEXER: "SUD0"
    };

    function setGlyph(span, ch) {
        span.textContent = ch;
        span.setAttribute("data-c", ch);
    }

    function renderSegment(seg, text) {
        seg.textContent = "";
        for (var i = 0; i < text.length; i++) {
            var span = document.createElement("span");
            span.className = "g";
            setGlyph(span, text.charAt(i));
            seg.appendChild(span);
        }
    }

    // Scrambles a segment into `text`, locking glyphs in left to right.
    function scrambleTo(seg, text, done) {
        clearInterval(seg._timer);

        if (reduceMotion) {
            renderSegment(seg, text);
            if (done) { done(); }
            return;
        }

        if (seg.children.length !== text.length) {
            renderSegment(seg, text);
        }

        var spans = Array.prototype.slice.call(seg.children);
        var revealAt = spans.map(function (_, i) {
            return 3 + i * 2 + Math.floor(Math.random() * 3);
        });
        var total = Math.max.apply(null, revealAt) + 1;
        var frame = 0;

        seg._timer = setInterval(function () {
            spans.forEach(function (span, i) {
                setGlyph(span, frame >= revealAt[i] ? text.charAt(i) : pick(NOISE));
            });
            if (++frame > total) {
                clearInterval(seg._timer);
                spans.forEach(function (span, i) { setGlyph(span, text.charAt(i)); });
                if (done) { done(); }
            }
        }, 38);
    }

    // Fires the page-wide pulse. One CSS variable drives the whole thing.
    function glitchPulse() {
        if (reduceMotion) { return; }
        var root = document.documentElement;
        document.body.classList.add("is-glitching");
        root.style.setProperty("--glitch", "1");
        setTimeout(function () { root.style.setProperty("--glitch", "0"); }, 180);
        setTimeout(function () { document.body.classList.remove("is-glitching"); }, 320);
    }

    // True when the link points at the page we are already on.
    function isSamePage(a) {
        var norm = function (p) { return p.replace(/\/index\.html$/, "/"); };
        try {
            return norm(new URL(a.href).pathname) === norm(window.location.pathname);
        } catch (e) {
            return false;
        }
    }

    function initLogo() {
        var logo = $(".logo");
        if (!logo) { return; }

        var segs = $$(".logo__seg", logo);
        if (!segs.length) { return; }

        segs.forEach(function (seg) {
            seg._word = seg.getAttribute("data-word") || seg.textContent.trim();
            renderSegment(seg, seg._word);
        });

        // Boot-time decrypt, staggered across the three segments.
        if (!reduceMotion) {
            segs.forEach(function (seg, i) {
                setTimeout(function () { scrambleTo(seg, seg._word); }, i * 120);
            });
        }

        // Click: flip to the alias, hold, then decrypt back.
        logo.addEventListener("click", function (ev) {
            if (!isSamePage(logo)) { return; }   // on other pages it still navigates home
            ev.preventDefault();

            glitchPulse();
            logo.classList.add("is-hot");

            segs.forEach(function (seg, i) {
                var alias = ALIASES[seg._word] || seg._word;
                setTimeout(function () {
                    scrambleTo(seg, alias, function () {
                        setTimeout(function () { scrambleTo(seg, seg._word); }, 620);
                    });
                }, i * 90);
            });

            setTimeout(function () { logo.classList.remove("is-hot"); }, 1600);
        });

        // Idle life: nudge one random glyph every few seconds.
        if (!reduceMotion) {
            setInterval(function () {
                if (document.hidden) { return; }
                var seg = segs[Math.floor(Math.random() * segs.length)];
                if (seg._timer) { return; }              // don't fight a running animation
                var spans = seg.children;
                if (!spans.length) { return; }
                var idx = Math.floor(Math.random() * spans.length);
                var span = spans[idx];
                var real = seg._word.charAt(idx);
                setGlyph(span, pick(NOISE));
                setTimeout(function () { setGlyph(span, real); }, 70);
            }, 2600);
        }
    }

    /* ---------------------------------------------------------------------
       2. Accordions — real buttons, real regions, grid-row height animation
       --------------------------------------------------------------------- */

    function initSections() {
        var buttons = $$(".sect__btn");
        if (!buttons.length) { return; }

        var pairs = buttons.map(function (btn) {
            var panel = document.getElementById(btn.getAttribute("aria-controls"));

            // Stagger index, per list, so the reveal cascades. Capped so a long
            // list doesn't push the last item out to an absurd delay.
            var maxIndex = 0;
            if (panel) {
                $$(".list", panel).forEach(function (list) {
                    $$("li", list).forEach(function (li, i) {
                        var n = Math.min(i, 10);
                        li.style.setProperty("--i", n);
                        if (n > maxIndex) { maxIndex = n; }
                    });
                });
            }

            return { btn: btn, panel: panel, revealMs: 340 + maxIndex * 40 + 120 };
        }).filter(function (p) { return p.panel; });

        function setOpen(pair, open) {
            pair.btn.setAttribute("aria-expanded", open ? "true" : "false");
            pair.panel.classList.toggle("is-open", open);

            var state = $(".sect__state", pair.btn);
            if (state) { state.textContent = open ? "[-]" : "[+]"; }

            // The stagger runs off a transient class. Once it is removed the
            // list items carry no animation, so they can never be left hidden.
            clearTimeout(pair._revealTimer);
            if (open && !reduceMotion) {
                pair.panel.classList.add("is-revealing");
                pair._revealTimer = setTimeout(function () {
                    pair.panel.classList.remove("is-revealing");
                }, pair.revealMs);
            } else {
                pair.panel.classList.remove("is-revealing");
            }
        }

        pairs.forEach(function (pair) {
            setOpen(pair, false);   // JS closes what the no-JS stylesheet leaves open

            pair.btn.addEventListener("click", function () {
                var open = pair.btn.getAttribute("aria-expanded") !== "true";
                setOpen(pair, open);
                if (open) {
                    // Keep deep links working without yanking the scroll position.
                    history.replaceState(null, "", "#" + pair.panel.id);
                }
            });
        });

        // Honour an incoming #hash — on first load and on every later hash change,
        // since jumping to #Skills from an already-open page is a same-document
        // navigation that never re-runs init().
        function openFromHash(scroll) {
            var hash = window.location.hash.replace("#", "");
            if (!hash) { return; }

            var target = pairs.filter(function (p) { return p.panel.id === hash; })[0];
            if (!target) { return; }

            setOpen(target, true);
            if (scroll) {
                setTimeout(function () {
                    target.btn.scrollIntoView({
                        block: "center",
                        behavior: reduceMotion ? "auto" : "smooth"
                    });
                }, 60);
            }
        }

        openFromHash(true);
        window.addEventListener("hashchange", function () { openFromHash(true); });

        // Expand / collapse everything.
        var toggleAll = $("#toggle-all");
        if (toggleAll) {
            toggleAll.addEventListener("click", function () {
                var anyClosed = pairs.some(function (p) {
                    return p.btn.getAttribute("aria-expanded") !== "true";
                });
                pairs.forEach(function (p) { setOpen(p, anyClosed); });
                toggleAll.textContent = anyClosed
                    ? "root@justin:~# ./collapse --all"
                    : "root@justin:~# ./expand --all";
            });
        }
    }

    /* ---------------------------------------------------------------------
       3. Digital rain
       --------------------------------------------------------------------- */

    function initRain() {
        if (reduceMotion) { return; }

        var canvas = document.getElementById("rain");
        if (!canvas || !canvas.getContext) { return; }

        var ctx = canvas.getContext("2d");
        var GLYPHS = "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/\\|=+*";

        var fontSize, cols, drops, running = false, rafId = null, last = 0;

        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            fontSize = window.innerWidth < 640 ? 12 : 16;
            cols = Math.ceil(window.innerWidth / fontSize);
            drops = [];
            for (var i = 0; i < cols; i++) {
                drops[i] = Math.random() * -60;
            }
        }

        function frame(t) {
            if (!running) { return; }
            rafId = window.requestAnimationFrame(frame);

            if (t - last < 42) { return; }   // ~24fps is plenty for rain
            last = t;

            var w = window.innerWidth, h = window.innerHeight;

            ctx.fillStyle = "rgba(10, 14, 10, 0.14)";
            ctx.fillRect(0, 0, w, h);
            ctx.font = fontSize + 'px "JetBrains Mono", monospace';

            for (var i = 0; i < cols; i++) {
                var y = drops[i] * fontSize;
                ctx.fillStyle = Math.random() < 0.02 ? "#ffffff" : "#39ff6a";
                ctx.fillText(pick(GLYPHS), i * fontSize, y);
                if (y > h && Math.random() > 0.975) { drops[i] = 0; }
                drops[i]++;
            }
        }

        function start() {
            if (running) { return; }
            running = true;
            last = 0;
            rafId = window.requestAnimationFrame(frame);
        }

        function stop() {
            running = false;
            if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
        }

        resize();
        start();

        var resizeTimer;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 200);
        });

        // Don't burn cycles in a background tab.
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) { stop(); } else { start(); }
        });
    }

    /* ---------------------------------------------------------------------
       4. Boot sequence — an overlay ON TOP of rendered content, never a gate
       --------------------------------------------------------------------- */

    var BOOT_LINES = [
        ["[ <span class='ok'>OK</span> ] Mounting /dev/résumé ...", 0],
        ["[ <span class='ok'>OK</span> ] Loading JetBrainsMono.woff2", 0],
        ["[ <span class='ok'>OK</span> ] Establishing TLS session", 0],
        ["[ <span class='warn'>!!</span> ] Bypassing perimeter ACL ...", 0],
        ["[ <span class='warn'>!!</span> ] Escalating: uid=0(root) gid=0(root)", 0],
        ["[ <span class='bad'>&gt;&gt;</span> ] Payload delivered: index.html", 0],
        ["", 0],
        ["    &gt; whoami", 0],
        ["    isciuc iustin-constantin", 0],
        ["    &gt; cat /etc/motd", 0],
        ["    <span class='bad'>THIS SITE HAS BEEN DEFACED.</span>", 0],
        ["    <span class='ok'>The résumé below is authentic.</span>", 0]
    ];

    function initBoot() {
        if (reduceMotion) { return; }
        if (sessionStorage.getItem("booted") === "1") { return; }

        try {
            sessionStorage.setItem("booted", "1");
        } catch (e) { /* private mode — just play it every time */ }

        var overlay = document.createElement("div");
        overlay.className = "boot";
        overlay.setAttribute("aria-hidden", "true");   // SR users read the real page

        var log = document.createElement("pre");
        log.style.margin = "0";
        overlay.appendChild(log);

        var skip = document.createElement("span");
        skip.className = "boot__skip";
        skip.textContent = "press any key to skip";
        overlay.appendChild(skip);

        document.body.appendChild(overlay);

        var i = 0, timer;

        function finish() {
            clearInterval(timer);
            overlay.classList.add("is-done");
            setTimeout(function () {
                if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
            }, 450);
            ["keydown", "click", "wheel", "touchstart"].forEach(function (ev) {
                window.removeEventListener(ev, finish);
            });
        }

        timer = setInterval(function () {
            if (i >= BOOT_LINES.length) { finish(); return; }
            log.innerHTML += BOOT_LINES[i][0] + "\n";
            i++;
        }, 90);

        ["keydown", "click", "wheel", "touchstart"].forEach(function (ev) {
            window.addEventListener(ev, finish, { passive: true });
        });

        setTimeout(finish, 4000);   // hard ceiling, whatever happens
    }

    /* ---------------------------------------------------------------------
       5. Copy-to-clipboard on each code sample
       --------------------------------------------------------------------- */

    // Async clipboard where it exists, execCommand where it doesn't (older
    // browsers, and any non-secure context such as a plain http:// preview).
    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.top = "-1000px";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);

            var ok = false;
            try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
            document.body.removeChild(ta);

            if (ok) { resolve(); } else { reject(new Error("copy rejected")); }
        });
    }

    function initCopyButtons() {
        var cards = $$(".code-card");
        if (!cards.length) { return; }

        // One shared live region, so a screen reader hears the result.
        var announce = document.createElement("p");
        announce.className = "visually-hidden";
        announce.setAttribute("role", "status");
        announce.setAttribute("aria-live", "polite");
        document.body.appendChild(announce);

        cards.forEach(function (card) {
            var code = $("pre code", card);
            var bar = $(".code-card__bar", card);
            if (!code || !bar) { return; }

            var nameEl = $(".code-card__name", card);
            var name = nameEl ? nameEl.textContent.trim() : "code sample";

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-btn";
            btn.textContent = "[copy]";
            btn.setAttribute("aria-label", "Copy " + name + " to clipboard");
            bar.appendChild(btn);

            btn.addEventListener("click", function () {
                clearTimeout(btn._resetTimer);

                copyText(code.textContent).then(function () {
                    btn.textContent = "[copied]";
                    btn.classList.remove("is-err");
                    btn.classList.add("is-ok");
                    card.classList.add("is-copied");
                    announce.textContent = name + " copied to clipboard";
                }, function () {
                    btn.textContent = "[press ctrl+c]";
                    btn.classList.remove("is-ok");
                    btn.classList.add("is-err");
                    announce.textContent = "Could not copy " + name + " automatically";
                }).then(function () {
                    btn._resetTimer = setTimeout(function () {
                        btn.textContent = "[copy]";
                        btn.classList.remove("is-ok", "is-err");
                        card.classList.remove("is-copied");
                    }, 1800);
                });
            });
        });
    }

    /* ---------------------------------------------------------------------
       6. Footer uptime
       --------------------------------------------------------------------- */

    function initUptime() {
        var el = $("#uptime");
        if (!el) { return; }

        var t0 = Date.now();
        function pad(n) { return (n < 10 ? "0" : "") + n; }

        setInterval(function () {
            var s = Math.floor((Date.now() - t0) / 1000);
            el.textContent = pad(Math.floor(s / 3600)) + ":" +
                pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
        }, 1000);
    }

    /* ------------------------------------------------------------------- */

    function init() {
        initSections();
        initLogo();
        initRain();
        initCopyButtons();
        initUptime();
        initBoot();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
