/*
 * Interface du Puissance 4 : rendu, animations, contrôles et menu.
 * S'appuie sur window.P4 (engine.js) et window.Sound (sound.js).
 */
(function () {
    'use strict';

    const { Game, RED, YELLOW, COLS, ROWS, aiMove, search } = window.P4;
    const Sound = window.Sound;

    const $ = sel => document.querySelector(sel);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const LEVEL_LABEL = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', expert: 'Expert' };
    const LEVEL_HINT = {
        easy: 'Idéal pour découvrir le jeu.',
        medium: 'Voit quelques coups à l\'avance, mais peut se tromper.',
        hard: 'Calcule 9 coups à l\'avance. Accroche-toi.',
        expert: 'Réfléchit plus de 12 coups à l\'avance. Bonne chance…',
    };
    const THEME_COLOR = { sunset: '#140a24', midnight: '#060c12' };

    /* ------------------------------------------------------------ Stockage */

    const store = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? Object.assign({}, fallback, JSON.parse(raw)) : fallback;
            } catch {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {
                /* navigation privée : on joue sans sauvegarde */
            }
        },
    };

    const firstVisit = store.get('p4-settings', null) === null;
    const settings = store.get('p4-settings', {
        mode: 'ai',
        level: 'medium',
        red: '',
        yellow: '',
        theme: 'sunset',
        sound: true,
    });
    const scores = store.get('p4-scores', {});

    /* ------------------------------------------------------------ DOM */

    const body = document.body;
    const area = $('#board-area');
    const board = area.querySelector('.board');
    const ghost = area.querySelector('.ghost');
    const discsEl = $('#discs');
    const hitsEl = $('#hits');
    const winSvg = $('#win-lines');
    const statusEl = $('#status');
    const drawsEl = $('#draws');
    const resultEl = $('#result');
    const menu = $('#menu');
    const form = $('#menu-form');
    const players = {
        [RED]: $('.player--red'),
        [YELLOW]: $('.player--yellow'),
    };
    const btn = {
        undo: $('#btn-undo'),
        hint: $('#btn-hint'),
        restart: $('#btn-restart'),
        theme: $('#btn-theme'),
        sound: $('#btn-sound'),
        menu: $('#btn-menu'),
        rematch: $('#btn-rematch'),
        resultMenu: $('#btn-result-menu'),
        resultClose: $('#result-close'),
        resetScores: $('#btn-reset-scores'),
    };

    for (let c = 0; c < COLS; c++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.col = c;
        hitsEl.appendChild(b);
    }
    const hitButtons = [...hitsEl.children];

    const preview = document.createElement('div');
    preview.className = 'disc disc--preview';
    discsEl.appendChild(preview);

    /* ------------------------------------------------------------ État */

    const game = new Game(RED);
    let nextStarter = RED;
    let aimCol = 3;
    let busy = false;
    let thinking = false;
    let thinkToken = 0;
    let hintCol = -1;
    let hintTimer = 0;
    let pointerInside = false;
    let pointerCol = 3;

    const isAI = () => settings.mode === 'ai';
    const isAITurn = () => isAI() && game.current === YELLOW && !game.over;
    const canInteract = () => !game.over && !busy && !thinking && !isAITurn() && !menu.open;
    const scoreKey = () => (isAI() ? `ai-${settings.level}` : 'pvp');
    const currentScore = () => (scores[scoreKey()] = scores[scoreKey()] || { 1: 0, 2: 0, d: 0 });

    function nameOf(p) {
        if (p === RED) return settings.red || 'Rouge';
        return isAI() ? `IA ${LEVEL_LABEL[settings.level]}` : settings.yellow || 'Jaune';
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]);
    }

    const tag = p => `<strong class="t-${p}">${escapeHtml(nameOf(p))}</strong>`;

    /* ------------------------------------------------------------ Rendu */

    function render() {
        const interact = canInteract();
        area.classList.toggle('can-play', interact);
        area.classList.toggle('is-thinking', thinking);
        area.dataset.turn = game.current;

        hitButtons.forEach((b, c) => {
            const full = game.heights[c] >= ROWS;
            b.setAttribute('aria-disabled', String(full || !interact));
            b.setAttribute('aria-label', `Colonne ${c + 1}${full ? ' (pleine)' : ''}`);
        });

        const score = currentScore();
        [RED, YELLOW].forEach(p => {
            const card = players[p];
            card.querySelector('.player__name').textContent = nameOf(p);
            card.querySelector('.player__turn').textContent = p === YELLOW && isAI() ? 'Réfléchit…' : 'À toi de jouer';
            card.querySelector('.player__score span').textContent = score[p];
            card.classList.toggle('is-active', !game.over && game.current === p);
            card.classList.toggle('is-winner', game.winner === p);
            card.classList.toggle('is-ai', p === YELLOW && isAI());
        });

        const mode = isAI() ? `Contre l'IA · ${LEVEL_LABEL[settings.level]}` : 'Deux joueurs';
        drawsEl.textContent = score.d ? `${mode} · ${score.d} match${score.d > 1 ? 's' : ''} nul${score.d > 1 ? 's' : ''}` : mode;

        statusEl.innerHTML = statusText();

        btn.undo.disabled = !canUndo();
        btn.hint.disabled = !interact;
        updatePreview();
    }

    function statusText() {
        if (game.over) {
            return game.winner ? `${tag(game.winner)} aligne quatre jetons !` : 'Match nul, la grille est pleine.';
        }
        if (thinking || isAITurn()) {
            return `${tag(YELLOW)} réfléchit<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
        }
        if (hintCol >= 0) return `Indice : essaie la <strong>colonne ${hintCol + 1}</strong>`;
        if (game.moveCount < 2 && firstVisit) {
            return `${tag(game.current)}, clique sur une colonne pour lâcher ton jeton`;
        }
        return isAI() ? `À toi de jouer, ${tag(game.current)}` : `Au tour de ${tag(game.current)}`;
    }

    function updatePreview() {
        const full = game.heights[aimCol] >= ROWS;
        preview.hidden = full || !canInteract();
        if (preview.hidden) return;
        preview.classList.toggle('disc--red', game.current === RED);
        preview.classList.toggle('disc--yellow', game.current === YELLOW);
        preview.style.setProperty('--c', aimCol);
        preview.style.setProperty('--r', ROWS - 1 - game.heights[aimCol]);
    }

    function setAim(col, show = true) {
        aimCol = Math.max(0, Math.min(COLS - 1, col));
        area.style.setProperty('--col', aimCol);
        area.classList.toggle('is-aiming', show);
        updatePreview();
    }

    function bumpScore(p) {
        const el = players[p].querySelector('.player__score span');
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    }

    /* ------------------------------------------------------------ Jetons */

    function spawnDisc(move) {
        const el = document.createElement('div');
        el.className = `disc disc--${move.player === RED ? 'red' : 'yellow'} is-last`;
        el.style.setProperty('--c', move.col);
        el.style.setProperty('--r', ROWS - 1 - move.row);
        el.dataset.pos = `${move.row}-${move.col}`;
        const last = discsEl.querySelector('.is-last');
        if (last) last.classList.remove('is-last');
        discsEl.insertBefore(el, preview);
        return el;
    }

    function discAt(row, col) {
        return discsEl.querySelector(`[data-pos="${row}-${col}"]`);
    }

    // Chute avec rebonds ; la promesse se résout à l'impact
    function animateDrop(el, move) {
        const depth = ROWS - 1 - move.row;
        const land = () => {
            Sound.drop(depth);
            board.classList.remove('thud');
            void board.offsetWidth;
            board.classList.add('thud');
        };
        if (reduceMotion.matches) {
            land();
            return Promise.resolve();
        }
        const cell = discsEl.clientHeight / ROWS;
        const dy = ghost.getBoundingClientRect().top - el.getBoundingClientRect().top;
        const fall = 170 + 110 * Math.sqrt(depth + 1);
        const total = fall / 0.6;
        el.animate([
            { transform: `translateY(${dy}px)`, easing: 'cubic-bezier(.5, 0, 1, .6)' },
            { transform: 'translateY(0)', offset: 0.6, easing: 'cubic-bezier(0, .5, .5, 1)' },
            { transform: `translateY(${-cell * 0.18}px)`, offset: 0.76, easing: 'cubic-bezier(.5, 0, 1, .5)' },
            { transform: 'translateY(0)', offset: 0.88, easing: 'cubic-bezier(0, .5, .5, 1)' },
            { transform: `translateY(${-cell * 0.05}px)`, offset: 0.94, easing: 'ease-in' },
            { transform: 'translateY(0)' },
        ], { duration: total });
        return wait(fall).then(land);
    }

    async function releaseDiscs() {
        const discs = [...discsEl.querySelectorAll('.disc:not(.disc--preview)')];
        winSvg.innerHTML = '';
        board.classList.remove('has-winner');
        if (!discs.length) return;
        if (reduceMotion.matches) {
            discs.forEach(d => d.remove());
            return;
        }
        Sound.release();
        const h = discsEl.clientHeight;
        await Promise.all(discs.map(d => d.animate(
            [{ transform: 'translateY(0)' }, { transform: `translateY(${h * 1.15}px)` }],
            { duration: 520, delay: Math.random() * 90, easing: 'cubic-bezier(.55, 0, 1, .45)', fill: 'forwards' },
        ).finished.catch(() => { })));
        discs.forEach(d => d.remove());
    }

    /* ------------------------------------------------------------ Déroulement */

    async function playMove(col) {
        clearHint();
        const move = game.play(col);
        if (!move) return;
        busy = true;
        render();
        const el = spawnDisc(move);
        await animateDrop(el, move);
        busy = false;

        if (game.over) {
            finish();
        } else if (isAITurn()) {
            aiTurn();
        } else {
            if (pointerInside) setAim(pointerCol, true);
            render();
        }
    }

    function humanPlay(col) {
        if (!canInteract()) return;
        if (!game.canPlay(col)) {
            deny(col);
            return;
        }
        setAim(col, area.classList.contains('is-aiming'));
        playMove(col);
    }

    function deny(col) {
        Sound.click();
        if (!reduceMotion.matches) {
            ghost.animate([
                { transform: `translateX(${col * 100}%)` },
                { transform: `translateX(${col * 100 - 8}%)` },
                { transform: `translateX(${col * 100 + 8}%)` },
                { transform: `translateX(${col * 100}%)` },
            ], { duration: 220 });
        }
    }

    async function aiTurn() {
        thinking = true;
        const token = ++thinkToken;
        render();
        await wait(90);
        if (token !== thinkToken) return;

        const t0 = performance.now();
        const col = aiMove(game, settings.level);
        const spent = performance.now() - t0;

        // L'IA « hésite » un peu au-dessus du plateau avant de jouer
        if (!reduceMotion.matches) {
            const hops = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < hops; i++) {
                const options = game.validMoves().filter(c => c !== aimCol);
                if (!options.length) break;
                setAim(options[Math.floor(Math.random() * options.length)], false);
                await wait(170 + Math.random() * 130);
                if (token !== thinkToken) return;
            }
        }
        await wait(Math.max(0, 300 - spent));
        if (token !== thinkToken) return;
        setAim(col, false);
        await wait(reduceMotion.matches ? 0 : 240);
        if (token !== thinkToken) return;

        thinking = false;
        playMove(col);
    }

    function finish() {
        const score = currentScore();
        const winner = game.winner;
        nextStarter = game.starter === RED ? YELLOW : RED;

        if (winner) {
            score[winner]++;
            const color = winner === RED ? 'var(--red)' : 'var(--yellow)';
            area.style.setProperty('--win-color', color);
            board.classList.add('has-winner');
            game.lines.forEach(line => {
                line.forEach(({ row, col }) => {
                    const d = discAt(row, col);
                    if (d) d.classList.add('is-win');
                });
                const a = line[0];
                const b = line[line.length - 1];
                const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l.setAttribute('x1', a.col + 0.5);
                l.setAttribute('y1', ROWS - 1 - a.row + 0.5);
                l.setAttribute('x2', b.col + 0.5);
                l.setAttribute('y2', ROWS - 1 - b.row + 0.5);
                l.setAttribute('pathLength', '1');
                winSvg.appendChild(l);
            });
            const aiWon = isAI() && winner === YELLOW;
            if (aiWon) Sound.lose();
            else {
                Sound.win();
                confetti.burst(winner === RED ? ['#ff2e63', '#ffb3c4', '#ffffff'] : ['#ffd23f', '#fff6c8', '#ffffff']);
            }
            bumpScore(winner);
        } else {
            score.d++;
            area.style.setProperty('--win-color', 'var(--accent)');
            Sound.draw();
        }
        store.set('p4-scores', scores);
        render();
        setTimeout(showResult, reduceMotion.matches ? 200 : 900);
    }

    function showResult() {
        if (!game.over || menu.open) return;
        const winner = game.winner;
        const title = $('#result-title');
        const text = $('#result-text');
        resultEl.classList.toggle('is-draw', !winner);
        // On place la carte à l'opposé de l'alignement gagnant pour le laisser visible
        const line = game.lines[0] || [];
        const mid = line.reduce((sum, cell) => sum + cell.row, 0) / (line.length || 1);
        resultEl.classList.toggle('result--top', !!winner && mid < 2.5);
        resultEl.classList.toggle('result--bottom', !!winner && mid >= 2.5);
        resultEl.style.setProperty('--win-color', winner === RED ? 'var(--red)' : winner === YELLOW ? 'var(--yellow)' : 'var(--accent)');

        const count = p => game.moves.filter((_, i) => (i % 2 === 0 ? game.starter : 3 - game.starter) === p).length;
        if (!winner) {
            title.textContent = 'Match nul';
            text.textContent = 'Grille pleine, personne ne passe.';
        } else if (isAI() && winner === YELLOW) {
            title.textContent = 'L\'IA l\'emporte';
            text.textContent = `Battu en ${count(YELLOW)} coups. Une revanche ?`;
        } else if (isAI()) {
            title.textContent = `Bravo ${nameOf(RED)} !`;
            text.textContent = `Tu as battu l'IA ${LEVEL_LABEL[settings.level].toLowerCase()} en ${count(RED)} coups.`;
        } else {
            title.textContent = `${nameOf(winner)} gagne !`;
            text.textContent = `Victoire en ${count(winner)} coups.`;
        }
        resultEl.hidden = false;
        btn.rematch.focus({ preventScroll: true });
    }

    function hideResult() {
        resultEl.hidden = true;
    }

    async function newGame(starter = game.over ? nextStarter : game.starter) {
        thinkToken++;
        thinking = false;
        clearHint();
        hideResult();
        confetti.clear();
        busy = true;
        render();
        await releaseDiscs();
        game.reset(starter);
        busy = false;
        setAim(pointerInside ? pointerCol : 3, pointerInside);
        render();
        if (isAITurn()) aiTurn();
    }

    function humanMoves() {
        return game.moves.filter((_, i) => (i % 2 === 0 ? game.starter : 3 - game.starter) === RED).length;
    }

    function canUndo() {
        if (busy || game.over || !game.moveCount) return false;
        return isAI() ? humanMoves() > 0 : true;
    }

    function undo() {
        if (!canUndo()) return;
        thinkToken++;
        thinking = false;
        clearHint();
        // Contre l'IA, on revient jusqu'au dernier coup du joueur humain
        do {
            const m = game.undo();
            const d = discAt(m.row, m.col);
            if (d) {
                d.removeAttribute('data-pos');
                d.classList.remove('is-last');
                if (reduceMotion.matches) d.remove();
                else {
                    d.classList.add('is-leaving');
                    d.addEventListener('animationend', () => d.remove(), { once: true });
                }
            }
        } while (isAI() && game.current === YELLOW && game.moveCount);

        const lastCol = game.moves[game.moves.length - 1];
        if (lastCol !== undefined) {
            const d = discAt(game.heights[lastCol] - 1, lastCol);
            if (d) d.classList.add('is-last');
        }
        Sound.undo();
        render();
        if (isAITurn()) aiTurn();
    }

    function clearHint() {
        clearTimeout(hintTimer);
        hintCol = -1;
        area.classList.remove('is-hint');
    }

    function hint() {
        if (!canInteract()) return;
        const res = search(game, { depth: 10, time: 450 });
        if (res.col < 0) return;
        clearHint();
        hintCol = res.col;
        setAim(res.col, true);
        area.classList.add('is-hint');
        Sound.hint();
        render();
        hintTimer = setTimeout(() => {
            clearHint();
            render();
        }, 2600);
    }

    /* ------------------------------------------------------------ Confettis */

    const confetti = (() => {
        const canvas = $('#confetti');
        const ctx = canvas.getContext('2d');
        let parts = [];
        let raf = 0;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function tick() {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            parts.forEach(p => {
                p.vy += 0.32;
                p.vx *= 0.985;
                p.vy *= 0.985;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                p.flip += 0.12;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                if (p.round) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.cos(p.flip));
                }
                ctx.restore();
            });
            parts = parts.filter(p => p.y < window.innerHeight + 40);
            raf = parts.length ? requestAnimationFrame(tick) : 0;
        }

        return {
            burst(colors) {
                if (reduceMotion.matches) return;
                resize();
                const w = window.innerWidth;
                const h = window.innerHeight;
                const power = Math.min(1.25, Math.max(0.75, h / 800));
                [[0, 1], [w, -1]].forEach(([x, dir]) => {
                    for (let i = 0; i < 90; i++) {
                        const angle = (-60 - Math.random() * 25) * (Math.PI / 180);
                        const speed = (14 + Math.random() * 12) * power;
                        parts.push({
                            x,
                            y: h,
                            vx: Math.cos(angle) * speed * dir,
                            vy: Math.sin(angle) * speed,
                            size: 7 + Math.random() * 7,
                            rot: Math.random() * Math.PI,
                            vr: (Math.random() - 0.5) * 0.3,
                            flip: Math.random() * Math.PI,
                            round: Math.random() < 0.3,
                            color: colors[Math.floor(Math.random() * colors.length)],
                        });
                    }
                });
                if (!raf) raf = requestAnimationFrame(tick);
            },
            clear() {
                parts = [];
            },
        };
    })();

    /* ------------------------------------------------------------ Réglages */

    function applyTheme() {
        body.dataset.theme = settings.theme;
        btn.theme.querySelector('use').setAttribute('href', settings.theme === 'sunset' ? '#i-moon' : '#i-sun');
        btn.theme.setAttribute('aria-label', settings.theme === 'sunset' ? 'Passer au thème minuit' : 'Passer au thème coucher de soleil');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME_COLOR[settings.theme]);
    }

    function applySound() {
        Sound.enabled = settings.sound;
        btn.sound.querySelector('use').setAttribute('href', settings.sound ? '#i-sound' : '#i-mute');
        btn.sound.setAttribute('aria-pressed', String(settings.sound));
        btn.sound.setAttribute('aria-label', settings.sound ? 'Couper le son' : 'Activer le son');
    }

    function saveSettings() {
        store.set('p4-settings', settings);
    }

    function toggleTheme() {
        settings.theme = settings.theme === 'sunset' ? 'midnight' : 'sunset';
        applyTheme();
        saveSettings();
        Sound.click();
    }

    function toggleSound() {
        settings.sound = !settings.sound;
        applySound();
        saveSettings();
        Sound.click();
    }

    function syncMenu() {
        const mode = form.elements.mode.value;
        $('#field-level').hidden = mode !== 'ai';
        $('#name-yellow').hidden = mode === 'ai';
        form.querySelector('.names').classList.toggle('is-solo', mode === 'ai');
        $('#level-hint').textContent = LEVEL_HINT[form.elements.level.value];
    }

    function openMenu() {
        if (menu.open) return;
        form.elements.mode.value = settings.mode;
        form.elements.level.value = settings.level;
        form.elements.red.value = settings.red;
        form.elements.yellow.value = settings.yellow;
        syncMenu();
        menu.returnValue = '';
        hideResult();
        menu.showModal();
        render();
    }

    menu.addEventListener('close', () => {
        if (menu.returnValue === 'play') {
            settings.mode = form.elements.mode.value;
            settings.level = form.elements.level.value;
            settings.red = form.elements.red.value.trim();
            settings.yellow = form.elements.yellow.value.trim();
            saveSettings();
            newGame(RED);
        } else {
            render();
            if (game.over) showResult();
        }
    });

    form.addEventListener('change', () => {
        syncMenu();
        Sound.click();
    });

    menu.addEventListener('click', e => {
        if (e.target === menu) menu.close();
    });

    $('#menu-close').addEventListener('click', () => menu.close());

    btn.resetScores.addEventListener('click', () => {
        scores[scoreKey()] = { 1: 0, 2: 0, d: 0 };
        store.set('p4-scores', scores);
        render();
        const label = btn.resetScores.textContent;
        btn.resetScores.textContent = 'Scores remis à zéro ✓';
        setTimeout(() => (btn.resetScores.textContent = label), 1400);
    });

    /* ------------------------------------------------------------ Événements */

    hitsEl.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        pointerInside = true;
        const b = e.target.closest('button');
        if (!b) return;
        pointerCol = +b.dataset.col;
        if (canInteract() && (pointerCol !== aimCol || !area.classList.contains('is-aiming'))) setAim(pointerCol, true);
    });

    hitsEl.addEventListener('pointerleave', () => {
        pointerInside = false;
        if (canInteract()) area.classList.remove('is-aiming');
    });

    hitsEl.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b) humanPlay(+b.dataset.col);
    });

    hitsEl.addEventListener('focusin', e => {
        const b = e.target.closest('button');
        if (b && canInteract() && b.matches(':focus-visible')) setAim(+b.dataset.col, true);
    });

    btn.undo.addEventListener('click', undo);
    btn.hint.addEventListener('click', hint);
    btn.restart.addEventListener('click', () => newGame());
    btn.theme.addEventListener('click', toggleTheme);
    btn.sound.addEventListener('click', toggleSound);
    btn.menu.addEventListener('click', openMenu);
    btn.rematch.addEventListener('click', () => newGame(nextStarter));
    btn.resultMenu.addEventListener('click', openMenu);
    btn.resultClose.addEventListener('click', hideResult);

    ['pointerdown', 'keydown'].forEach(type =>
        window.addEventListener(type, () => Sound.unlock(), { once: true, capture: true }));

    document.addEventListener('keydown', e => {
        if (menu.open || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest('input, textarea, select')) return;
        const onButton = !!e.target.closest('button');
        const inHits = !!e.target.closest('#hits');
        const key = e.key;

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            if (!canInteract()) return;
            e.preventDefault();
            const col = Math.max(0, Math.min(COLS - 1, aimCol + (key === 'ArrowLeft' ? -1 : 1)));
            if (inHits) hitButtons[col].focus();
            if (col !== aimCol || !area.classList.contains('is-aiming')) Sound.hover();
            setAim(col, true);
            return;
        }
        if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
            if (onButton && key !== 'ArrowDown') return; // le bouton gère lui-même Entrée/Espace
            e.preventDefault();
            if (!resultEl.hidden) newGame(nextStarter);
            else humanPlay(aimCol);
            return;
        }
        if (/^[1-7]$/.test(key)) {
            const col = +key - 1;
            if (canInteract()) {
                setAim(col, true);
                humanPlay(col);
            }
            return;
        }
        switch (key.toLowerCase()) {
            case 'u':
                undo();
                break;
            case 'h':
                hint();
                break;
            case 'r':
                newGame(game.over ? nextStarter : undefined);
                break;
            case 'm':
                toggleSound();
                break;
            case 't':
                toggleTheme();
                break;
            case 'escape':
                if (!resultEl.hidden) hideResult();
                else openMenu();
                break;
        }
    });

    /* ------------------------------------------------------------ Démarrage */

    applyTheme();
    applySound();
    setAim(3, false);
    render();
    if (firstVisit) openMenu();
})();
