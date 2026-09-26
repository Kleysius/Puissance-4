/*
 * Moteur du Puissance 4 : règles + IA (negamax alpha-beta).
 * Aucune dépendance au DOM : exposé sous window.P4 (ou module.exports pour les tests).
 * Convention : row 0 = rangée du BAS, col 0 = colonne de gauche.
 */
(function (global) {
    'use strict';

    const COLS = 7;
    const ROWS = 6;
    const SIZE = COLS * ROWS;
    const EMPTY = 0;
    const RED = 1;
    const YELLOW = 2;
    // On explore le centre en premier : meilleur élagage alpha-beta
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const WIN_SCORE = 1000000;

    const idx = (r, c) => r * COLS + c;
    const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

    // Toutes les fenêtres de 4 cases alignées (69 au total), pour l'heuristique
    const WINDOWS = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            for (const [dr, dc] of DIRS) {
                if (!inside(r + 3 * dr, c + 3 * dc)) continue;
                WINDOWS.push([0, 1, 2, 3].map(k => idx(r + k * dr, c + k * dc)));
            }
        }
    }

    function countDir(cells, r, c, dr, dc, player) {
        let n = 0;
        r += dr;
        c += dc;
        while (inside(r, c) && cells[idx(r, c)] === player) {
            n++;
            r += dr;
            c += dc;
        }
        return n;
    }

    class Game {
        constructor(starter = RED) {
            this.reset(starter);
        }

        reset(starter = RED) {
            this.cells = new Int8Array(SIZE);
            this.heights = new Int8Array(COLS);
            this.moves = [];
            this.starter = starter;
            this.current = starter;
            this.winner = EMPTY;
            this.lines = [];
            this.over = false;
        }

        get moveCount() {
            return this.moves.length;
        }

        get isDraw() {
            return this.over && this.winner === EMPTY;
        }

        at(r, c) {
            return this.cells[idx(r, c)];
        }

        canPlay(c) {
            return !this.over && c >= 0 && c < COLS && this.heights[c] < ROWS;
        }

        validMoves() {
            return ORDER.filter(c => this.heights[c] < ROWS);
        }

        play(c) {
            if (!this.canPlay(c)) return null;
            const player = this.current;
            const row = this.heights[c];
            this.cells[idx(row, c)] = player;
            this.heights[c]++;
            this.moves.push(c);

            const lines = this.linesThrough(row, c);
            if (lines.length) {
                this.winner = player;
                this.lines = lines;
                this.over = true;
            } else if (this.moves.length === SIZE) {
                this.over = true;
            } else {
                this.current = player === RED ? YELLOW : RED;
            }
            return { row, col: c, player };
        }

        undo() {
            if (!this.moves.length) return null;
            const c = this.moves.pop();
            this.heights[c]--;
            const row = this.heights[c];
            const player = this.cells[idx(row, c)];
            this.cells[idx(row, c)] = EMPTY;
            this.current = player;
            this.winner = EMPTY;
            this.lines = [];
            this.over = false;
            return { row, col: c, player };
        }

        // Renvoie chaque alignement gagnant (≥ 4) passant par (row, col)
        linesThrough(row, col) {
            const player = this.cells[idx(row, col)];
            const lines = [];
            if (player === EMPTY) return lines;
            for (const [dr, dc] of DIRS) {
                const back = countDir(this.cells, row, col, -dr, -dc, player);
                const fwd = countDir(this.cells, row, col, dr, dc, player);
                if (back + fwd + 1 >= 4) {
                    const line = [];
                    for (let k = -back; k <= fwd; k++) {
                        line.push({ row: row + k * dr, col: col + k * dc });
                    }
                    lines.push(line);
                }
            }
            return lines;
        }
    }

    /* ---------------------------------------------------------------- IA */

    const LEVELS = {
        easy: { depth: 2, noise: 0.4, time: 200 },
        medium: { depth: 5, noise: 0.1, time: 400 },
        hard: { depth: 9, noise: 0, time: 700 },
        expert: { depth: SIZE, noise: 0, time: 1400 },
    };

    const TIMEOUT = {};

    /**
     * Cherche le meilleur coup pour `game.current`.
     * Renvoie { col, score, depth, scores } — scores[c] est l'évaluation de chaque colonne.
     */
    function search(game, { depth: maxDepth = 8, time = 800 } = {}) {
        const cells = Int8Array.from(game.cells);
        const heights = Int8Array.from(game.heights);
        const me = game.current;
        let filled = game.moveCount;
        const deadline = now() + time;
        let nodes = 0;

        function isWinningMove(c, p) {
            const r = heights[c];
            for (const [dr, dc] of DIRS) {
                if (countDir(cells, r, c, dr, dc, p) + countDir(cells, r, c, -dr, -dc, p) >= 3) {
                    return true;
                }
            }
            return false;
        }

        function evaluate(p) {
            const o = p === RED ? YELLOW : RED;
            let score = 0;
            for (let r = 0; r < ROWS; r++) {
                const v = cells[idx(r, 3)];
                if (v === p) score += 4;
                else if (v === o) score -= 4;
            }
            for (let w = 0; w < WINDOWS.length; w++) {
                const win = WINDOWS[w];
                let mine = 0;
                let theirs = 0;
                for (let k = 0; k < 4; k++) {
                    const v = cells[win[k]];
                    if (v === p) mine++;
                    else if (v === o) theirs++;
                }
                if (theirs === 0) {
                    if (mine === 3) score += 12;
                    else if (mine === 2) score += 3;
                } else if (mine === 0) {
                    if (theirs === 3) score -= 14;
                    else if (theirs === 2) score -= 3;
                }
            }
            return score;
        }

        function negamax(depth, alpha, beta, p, ply) {
            if ((++nodes & 2047) === 0 && now() > deadline) throw TIMEOUT;

            for (let i = 0; i < COLS; i++) {
                const c = ORDER[i];
                if (heights[c] < ROWS && isWinningMove(c, p)) return WIN_SCORE - ply;
            }
            if (filled === SIZE - 1 || filled === SIZE) return 0;
            if (depth === 0) return evaluate(p);

            const o = p === RED ? YELLOW : RED;
            let best = -Infinity;
            for (let i = 0; i < COLS; i++) {
                const c = ORDER[i];
                if (heights[c] >= ROWS) continue;
                cells[idx(heights[c], c)] = p;
                heights[c]++;
                filled++;
                const score = -negamax(depth - 1, -beta, -alpha, o, ply + 1);
                filled--;
                heights[c]--;
                cells[idx(heights[c], c)] = EMPTY;
                if (score > best) best = score;
                if (best > alpha) alpha = best;
                if (alpha >= beta) break;
            }
            return best;
        }

        const moves = ORDER.filter(c => heights[c] < ROWS);
        if (!moves.length) return { col: -1, score: 0, depth: 0, scores: [] };

        // Victoire immédiate : inutile de chercher plus loin
        for (const c of moves) {
            if (isWinningMove(c, me)) {
                const scores = [];
                scores[c] = WIN_SCORE;
                return { col: c, score: WIN_SCORE, depth: 1, scores };
            }
        }

        const opp = me === RED ? YELLOW : RED;
        let result = { col: moves[0], score: 0, depth: 0, scores: [] };
        let order = moves.slice();

        // Approfondissement itératif : on garde le résultat de la dernière profondeur complète
        for (let depth = 1; depth <= Math.min(maxDepth, SIZE - filled); depth++) {
            const scores = [];
            let best = -Infinity;
            try {
                for (const c of order) {
                    cells[idx(heights[c], c)] = me;
                    heights[c]++;
                    filled++;
                    let score;
                    try {
                        // Fenêtre (best - 1) pour obtenir des scores exacts en cas d'égalité
                        score = -negamax(depth - 1, -Infinity, -(best - 1), opp, 1);
                    } finally {
                        filled--;
                        heights[c]--;
                        cells[idx(heights[c], c)] = EMPTY;
                    }
                    scores[c] = score;
                    if (score > best) best = score;
                }
            } catch (e) {
                if (e === TIMEOUT) break;
                throw e;
            }

            const top = order.filter(c => scores[c] === best);
            result = { col: top[Math.floor(Math.random() * top.length)], score: best, depth, scores };
            // Meilleurs coups d'abord à la profondeur suivante
            order = order.slice().sort((a, b) => scores[b] - scores[a]);
            if (Math.abs(best) >= WIN_SCORE - SIZE) break; // issue forcée trouvée
        }
        return result;
    }

    function aiMove(game, level = 'medium') {
        const cfg = LEVELS[level] || LEVELS.medium;
        const res = search(game, cfg);
        if (cfg.noise && Math.random() < cfg.noise && res.score < WIN_SCORE - SIZE) {
            // Une petite erreur « humaine », en évitant les coups qui perdent tout de suite
            const safe = game.validMoves().filter(c => !(res.scores[c] <= -(WIN_SCORE - SIZE)));
            const pool = safe.length ? safe : game.validMoves();
            return pool[Math.floor(Math.random() * pool.length)];
        }
        return res.col;
    }

    function now() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    const api = { COLS, ROWS, EMPTY, RED, YELLOW, WIN_SCORE, LEVELS, Game, search, aiMove };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else global.P4 = api;
})(typeof window !== 'undefined' ? window : globalThis);
