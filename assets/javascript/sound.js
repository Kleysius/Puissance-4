/*
 * Effets sonores synthétisés avec la Web Audio API : aucun fichier audio à charger.
 */
(function (global) {
    'use strict';

    let ctx = null;
    let master = null;
    let enabled = true;

    function audio() {
        if (!enabled) return null;
        if (!ctx) {
            const AC = global.AudioContext || global.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.5;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(freq, { type = 'sine', start = 0, dur = 0.15, vol = 0.3, slide = 0 } = {}) {
        const a = audio();
        if (!a) return;
        const t = a.currentTime + start;
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    function noise({ start = 0, dur = 0.08, vol = 0.25, freq = 1800 } = {}) {
        const a = audio();
        if (!a) return;
        const t = a.currentTime + start;
        const len = Math.ceil(a.sampleRate * dur);
        const buffer = a.createBuffer(1, len, a.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = a.createBufferSource();
        src.buffer = buffer;
        const filter = a.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 1.2;
        const gain = a.createGain();
        gain.gain.value = vol;
        src.connect(filter).connect(gain).connect(master);
        src.start(t);
    }

    const Sound = {
        get enabled() {
            return enabled;
        },
        set enabled(v) {
            enabled = !!v;
        },
        // Déverrouille l'audio sur le premier geste de l'utilisateur
        unlock() {
            audio();
        },
        hover() {
            tone(880, { type: 'sine', dur: 0.04, vol: 0.04 });
        },
        click() {
            tone(660, { type: 'triangle', dur: 0.06, vol: 0.12 });
        },
        // Plus le jeton tombe bas, plus le « clac » est grave
        drop(depth = 0) {
            noise({ dur: 0.07, vol: 0.35, freq: 2400 - depth * 220 });
            tone(210 - depth * 18, { type: 'sine', dur: 0.12, vol: 0.35, slide: -60 });
        },
        // Les jetons tombent quand on ouvre le plateau
        release() {
            for (let i = 0; i < 7; i++) {
                noise({ start: i * 0.045 + Math.random() * 0.03, dur: 0.05, vol: 0.18, freq: 1400 + Math.random() * 1400 });
            }
        },
        undo() {
            tone(520, { type: 'triangle', dur: 0.12, vol: 0.12, slide: 260 });
        },
        hint() {
            [988, 1319].forEach((f, i) => tone(f, { type: 'sine', start: i * 0.07, dur: 0.18, vol: 0.12 }));
        },
        win() {
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
                tone(f, { type: 'square', start: i * 0.09, dur: 0.22, vol: 0.09 }));
            tone(1046.5, { type: 'triangle', start: 0.45, dur: 0.6, vol: 0.18 });
        },
        lose() {
            [392, 349.23, 311.13, 261.63].forEach((f, i) =>
                tone(f, { type: 'sawtooth', start: i * 0.14, dur: 0.25, vol: 0.07 }));
        },
        draw() {
            [440, 440].forEach((f, i) => tone(f, { type: 'triangle', start: i * 0.16, dur: 0.14, vol: 0.14 }));
        },
    };

    global.Sound = Sound;
})(window);
