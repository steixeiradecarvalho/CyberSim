import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Hexagon, c as Eye, l as Download, n as VolumeX, o as GitBranch, r as Volume2, s as FlipHorizontal2, t as Waves, u as Braces } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DCuVIY5D.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var earthscore_lexicon_default = {
	version: "2.0",
	tradition: "Notação própria, em dívida com a lógica triádica de Peirce e com a ideia de Earthscore (Ryan): signos que se treinam, não ícones de vitória.",
	symbols: [
		{
			"id": "flow",
			"name": "Espiral de cisalhamento",
			"reads": "Como o gesto e o campo se enrolam sem precisarem coincidir."
		},
		{
			"id": "tension",
			"name": "Linha portante",
			"reads": "Esforço que segura a forma sem travá-la. Homeodinâmica não é nó desfeito."
		},
		{
			"id": "mediation",
			"name": "Tríade oca",
			"reads": "O terceiro que atrasa, traduz e devolve. O ponteiro não toca o campo."
		}
	]
};
function clamp(v, min = 0, max = 1) {
	return v < min ? min : v > max ? max : v;
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function smoothstep(edge0, edge1, x) {
	const t = clamp((x - edge0) / (edge1 - edge0 || 1));
	return t * t * (3 - 2 * t);
}
function expSmooth(current, target, dt, rate) {
	const k = 1 - Math.exp(-rate * dt);
	return current + (target - current) * k;
}
/**
* Síntese granular mínima em Web Audio.
* Janela de Hanning pré-calculada. Frequência do grão: 60 Hz → 2000 Hz com a tensão.
* Ganhos só mudam via setTargetAtTime, para não estalar.
*/
var AudioEngine = class {
	ctx = null;
	master = null;
	fund = null;
	fundGain = null;
	partial = null;
	partialGain = null;
	noiseGain = null;
	grain = null;
	hann = null;
	tension = .2;
	harmony = .5;
	resonance = 0;
	nextGrain = 0;
	voices = 0;
	muted = false;
	ready = false;
	constructor(bus) {
		bus.onReport((report) => this.follow(report));
	}
	unlock() {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		if (!Ctx) return;
		if (!this.ctx) {
			this.ctx = new Ctx({ latencyHint: "interactive" });
			this.build(this.ctx);
		}
		this.ctx.resume();
		this.ready = true;
	}
	resume() {
		if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
	}
	setMuted(muted) {
		this.muted = muted;
		this.pushGains();
	}
	settle() {
		this.tension = expSmooth(this.tension, .18, .1, 2);
		this.harmony = expSmooth(this.harmony, .82, .1, 2);
		this.pushGains();
	}
	follow(report) {
		if (report.module === "observer") return;
		this.tension = expSmooth(this.tension, report.tension, .1, 4);
		this.harmony = expSmooth(this.harmony, report.harmony, .1, 3);
		this.resonance = expSmooth(this.resonance, report.resonance, .1, 3);
		this.pushGains();
		this.scheduleGrain();
	}
	build(ctx) {
		const master = ctx.createGain();
		master.gain.value = 0;
		master.connect(ctx.destination);
		this.master = master;
		const fundGain = ctx.createGain();
		fundGain.gain.value = 0;
		const fund = ctx.createOscillator();
		fund.type = "sine";
		fund.frequency.value = 110;
		fund.connect(fundGain).connect(master);
		fund.start();
		this.fund = fund;
		this.fundGain = fundGain;
		const partialGain = ctx.createGain();
		partialGain.gain.value = 0;
		const partial = ctx.createOscillator();
		partial.type = "triangle";
		partial.frequency.value = 220;
		partial.connect(partialGain).connect(master);
		partial.start();
		this.partial = partial;
		this.partialGain = partialGain;
		const noiseLen = ctx.sampleRate;
		const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
		const data = noiseBuf.getChannelData(0);
		let brown = 0;
		for (let i = 0; i < noiseLen; i++) {
			const white = Math.random() * 2 - 1;
			brown = brown * .98 + white * .02;
			data[i] = brown * 3.2;
		}
		const noise = ctx.createBufferSource();
		noise.buffer = noiseBuf;
		noise.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 800;
		filter.Q.value = .7;
		const noiseGain = ctx.createGain();
		noiseGain.gain.value = 0;
		noise.connect(filter).connect(noiseGain).connect(master);
		noise.start();
		this.noiseGain = noiseGain;
		const hannLen = 512;
		this.hann = new Float32Array(hannLen);
		for (let i = 0; i < hannLen; i++) this.hann[i] = .5 * (1 - Math.cos(2 * Math.PI * i / 511));
		const grainLen = 4096;
		const grain = ctx.createBuffer(1, grainLen, ctx.sampleRate);
		const g = grain.getChannelData(0);
		for (let i = 0; i < grainLen; i++) {
			const window = this.hann[Math.floor(i / grainLen * hannLen)] ?? 0;
			g[i] = window * Math.sin(2 * Math.PI * 220 * i / ctx.sampleRate);
		}
		this.grain = grain;
		this.pushGains();
	}
	pushGains() {
		const ctx = this.ctx;
		if (!ctx || !this.master || !this.fund || !this.fundGain || !this.partial || !this.partialGain || !this.noiseGain) return;
		const now = ctx.currentTime;
		const tau = .08;
		const audible = this.muted || !this.ready ? 0 : .22;
		this.master.gain.setTargetAtTime(audible, now, .05);
		const fundamental = 55 * 2 ** (this.tension * 3.1);
		const consonant = this.harmony > .62 ? 2 : 2 + (1 - this.harmony) * 1.37;
		this.fund.frequency.setTargetAtTime(fundamental, now, tau);
		this.partial.frequency.setTargetAtTime(fundamental * consonant, now, tau);
		this.fundGain.gain.setTargetAtTime(.18 + this.harmony * .22, now, tau);
		this.partialGain.gain.setTargetAtTime(.04 + (1 - this.harmony) * .16, now, tau);
		this.noiseGain.gain.setTargetAtTime((1 - this.harmony) * this.tension * .18, now, tau);
	}
	scheduleGrain() {
		const ctx = this.ctx;
		if (!ctx || !this.grain || !this.master || this.muted || !this.ready) return;
		const now = ctx.currentTime;
		if (now < this.nextGrain || this.voices > 8) return;
		const tension = clamp(this.tension);
		const curve = smoothstep(0, 1, tension);
		let freq = 60 + curve * 1940;
		if (this.harmony > .62) {
			const fundamental = 55 * 2 ** (tension * 3.1);
			freq = fundamental * Math.max(1, Math.round(freq / fundamental));
		}
		const source = ctx.createBufferSource();
		source.buffer = this.grain;
		source.playbackRate.value = clamp(freq / 220, .25, 12);
		const gain = ctx.createGain();
		const amp = (.05 + (1 - this.harmony) * .12) * (.4 + this.resonance * .6);
		gain.gain.setValueAtTime(1e-4, now);
		gain.gain.exponentialRampToValueAtTime(Math.max(.001, amp), now + .03);
		gain.gain.exponentialRampToValueAtTime(1e-4, now + .22);
		source.connect(gain).connect(this.master);
		source.start(now);
		source.stop(now + .24);
		this.voices += 1;
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
			this.voices = Math.max(0, this.voices - 1);
		};
		const interval = .18 - curve * .1;
		this.nextGrain = now + interval;
	}
};
/**
* Barramento estritamente tipado. Não há emit genérico.
* `lastInput` / `lastReport` são a retenção do próprio barramento para
* assinantes que precisam da amostra completa no mesmo turno do sinal.
*/
var EventBus = class {
	sympathy = /* @__PURE__ */ new Set();
	resonance = /* @__PURE__ */ new Set();
	filtered = /* @__PURE__ */ new Set();
	mirror = /* @__PURE__ */ new Set();
	lexicon = /* @__PURE__ */ new Set();
	report = /* @__PURE__ */ new Set();
	memory = /* @__PURE__ */ new Set();
	lastInput = null;
	lastReport = null;
	onSympathy(handler) {
		this.sympathy.add(handler);
		return () => this.sympathy.delete(handler);
	}
	onResonance(handler) {
		this.resonance.add(handler);
		return () => this.resonance.delete(handler);
	}
	onFiltered(handler) {
		this.filtered.add(handler);
		return () => this.filtered.delete(handler);
	}
	onMirror(handler) {
		this.mirror.add(handler);
		return () => this.mirror.delete(handler);
	}
	onLexicon(handler) {
		this.lexicon.add(handler);
		return () => this.lexicon.delete(handler);
	}
	onReport(handler) {
		this.report.add(handler);
		return () => this.report.delete(handler);
	}
	onMemory(handler) {
		this.memory.add(handler);
		return () => this.memory.delete(handler);
	}
	emitSympathy(module, resonance, phaseOffset) {
		for (const handler of this.sympathy) handler(module, resonance, phaseOffset);
	}
	emitResonance(module, duration, homeodynamicFlag) {
		for (const handler of this.resonance) handler(module, duration, homeodynamicFlag);
	}
	emitFiltered(sample) {
		this.lastInput = sample;
		for (const handler of this.filtered) handler(sample.velocity, sample.acceleration, sample.mirrorLag);
	}
	emitMirror(enabled) {
		for (const handler of this.mirror) handler(enabled);
	}
	emitLexicon(symbolId, clarity) {
		for (const handler of this.lexicon) handler(symbolId, clarity);
	}
	emitReport(report) {
		this.lastReport = report;
		for (const handler of this.report) handler(report);
	}
	emitMemory(node) {
		for (const handler of this.memory) handler(node);
	}
	counts() {
		return {
			sympathy_state_changed: this.sympathy.size,
			resonance_event: this.resonance.size,
			filtered_input: this.filtered.size,
			mirror_mode_toggled: this.mirror.size,
			lexicon_unlocked: this.lexicon.size,
			circuit_report: this.report.size,
			dialogic_memory_recorded: this.memory.size
		};
	}
};
var CAP = 480;
/**
* Kalman 2D simplificado (posição) + pipeline MirrorMode.
* Atraso triádico: 0.5s–2s, média em torno do instante atrasado, ruído senoidal controlado.
* Nenhum módulo deve ler o ponteiro fora daqui.
*/
var InputFilter = class {
	mirror = false;
	delay = 1.1;
	sample = {
		velocity: {
			x: 0,
			y: 0
		},
		acceleration: 0,
		mirrorLag: 0,
		position: {
			x: .5,
			y: .5
		},
		raw: {
			x: .5,
			y: .5
		},
		filtered: {
			x: .5,
			y: .5
		},
		mirror: {
			x: .5,
			y: .5
		},
		hasPointer: false
	};
	estX = .5;
	estY = .5;
	pX = 1;
	pY = 1;
	q = .02;
	r = .08;
	measX = .5;
	measY = .5;
	prevX = .5;
	prevY = .5;
	prevSpeed = 0;
	seen = false;
	histX = new Float32Array(CAP);
	histY = new Float32Array(CAP);
	histT = new Float32Array(CAP);
	write = 0;
	count = 0;
	time = 0;
	traceRaw = /* @__PURE__ */ new Float32Array(96);
	traceFiltered = /* @__PURE__ */ new Float32Array(96);
	traceMirror = /* @__PURE__ */ new Float32Array(96);
	traceWrite = 0;
	bus;
	constructor(bus) {
		this.bus = bus;
	}
	setPointer(x, y) {
		this.measX = clamp(x);
		this.measY = clamp(y);
		this.sample.raw.x = this.measX;
		this.sample.raw.y = this.measY;
		this.seen = true;
		this.sample.hasPointer = true;
	}
	setMirror(enabled) {
		if (this.mirror === enabled) return;
		this.mirror = enabled;
		this.bus.emitMirror(enabled);
	}
	setDelay(seconds) {
		this.delay = clamp(seconds, .5, 2);
	}
	step(dt) {
		this.time += dt;
		const kX = this.kalman(this.estX, this.pX, this.measX);
		const kY = this.kalman(this.estY, this.pY, this.measY);
		this.estX = kX.x;
		this.pX = kX.p;
		this.estY = kY.x;
		this.pY = kY.p;
		const vx = dt > 1e-5 ? (this.estX - this.prevX) / dt : 0;
		const vy = dt > 1e-5 ? (this.estY - this.prevY) / dt : 0;
		this.prevX = this.estX;
		this.prevY = this.estY;
		const speed = Math.hypot(vx, vy);
		const acceleration = dt > 1e-5 ? (speed - this.prevSpeed) / dt : 0;
		this.prevSpeed = speed;
		this.pushHistory(this.time, this.estX, this.estY);
		const delayed = this.readDelayed(this.delay);
		const wobble = this.mirror ? Math.sin(this.time * 3.1) * .012 * this.delay + Math.sin(this.time * 5.7) * .006 * this.delay : 0;
		const mirrorX = clamp(delayed.x + wobble);
		const mirrorY = clamp(delayed.y + Math.cos(this.time * 2.4) * wobble);
		const useMirror = this.mirror && this.count > 8;
		this.sample.filtered.x = this.estX;
		this.sample.filtered.y = this.estY;
		this.sample.mirror.x = mirrorX;
		this.sample.mirror.y = mirrorY;
		this.sample.position.x = useMirror ? mirrorX : this.estX;
		this.sample.position.y = useMirror ? mirrorY : this.estY;
		this.sample.velocity.x = vx;
		this.sample.velocity.y = vy;
		this.sample.acceleration = acceleration;
		this.sample.mirrorLag = useMirror ? delayed.lag : 0;
		this.traceRaw[this.traceWrite] = this.sample.raw.x;
		this.traceFiltered[this.traceWrite] = this.estX;
		this.traceMirror[this.traceWrite] = mirrorX;
		this.traceWrite = (this.traceWrite + 1) % this.traceRaw.length;
		if (this.seen) this.bus.emitFiltered(this.sample);
	}
	kalman(estimate, covariance, measure) {
		const pPred = covariance + this.q;
		const k = pPred / (pPred + this.r);
		return {
			x: estimate + k * (measure - estimate),
			p: (1 - k) * pPred
		};
	}
	pushHistory(t, x, y) {
		this.histT[this.write] = t;
		this.histX[this.write] = x;
		this.histY[this.write] = y;
		this.write = (this.write + 1) % CAP;
		this.count = Math.min(CAP, this.count + 1);
	}
	readDelayed(delay) {
		if (this.count < 2) return {
			x: this.estX,
			y: this.estY,
			lag: 0
		};
		const newest = (this.write - 1 + CAP) % CAP;
		const oldestIndex = (this.write - this.count + CAP) % CAP;
		const covered = this.histT[newest] - this.histT[oldestIndex];
		const lag = Math.min(delay, Math.max(0, covered));
		const target = this.histT[newest] - lag;
		let newer = newest;
		let older = newest;
		for (let k = 0; k < this.count; k++) {
			const idx = (newest - k + CAP) % CAP;
			if (this.histT[idx] <= target) {
				older = idx;
				newer = k === 0 ? idx : (newest - (k - 1) + CAP) % CAP;
				break;
			}
			older = idx;
		}
		const t0 = this.histT[older];
		const span = this.histT[newer] - t0;
		const u = span > 1e-5 ? clamp((target - t0) / span) : 0;
		return {
			x: this.histX[older] + (this.histX[newer] - this.histX[older]) * u,
			y: this.histY[older] + (this.histY[newer] - this.histY[older]) * u,
			lag
		};
	}
	copyTraces() {
		const raw = [];
		const filtered = [];
		const mirror = [];
		for (let i = 0; i < this.traceRaw.length; i++) {
			const idx = (this.traceWrite + i) % this.traceRaw.length;
			raw.push(this.traceRaw[idx]);
			filtered.push(this.traceFiltered[idx]);
			mirror.push(this.traceMirror[idx]);
		}
		return {
			raw,
			filtered,
			mirror
		};
	}
};
/** Keep in sync with the @theme tokens in src/styles.css. Canvas cannot read utilities. */
var PALETTE = {
	ink: "#07090c",
	panel: "#12171c",
	bone: "#e7e2d4",
	mute: "#8d968c",
	flow: "#3dcaa8",
	tension: "#e4a15a",
	mediate: "#d4c4a8",
	line: "#2c3834"
};
var RGB = {
	ink: [
		7,
		9,
		12
	],
	flow: [
		61,
		202,
		168
	],
	tension: [
		228,
		161,
		90
	],
	bone: [
		231,
		226,
		212
	],
	mediate: [
		212,
		196,
		168
	]
};
function drawFlowMark(ctx, x, y, size, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = PALETTE.flow;
	ctx.lineWidth = 1.25;
	ctx.beginPath();
	ctx.arc(x, y, size, .4, 5.4);
	ctx.stroke();
	ctx.restore();
}
function drawTensionMark(ctx, x, y, size, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = PALETTE.tension;
	ctx.lineWidth = 1.25;
	ctx.beginPath();
	ctx.moveTo(x - size, y);
	ctx.lineTo(x - size * .12, y);
	ctx.moveTo(x + size * .18, y - size * .45);
	ctx.lineTo(x + size, y + size * .2);
	ctx.stroke();
	ctx.restore();
}
function drawMediationMark(ctx, x, y, size, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = PALETTE.mediate;
	const points = [
		[0, -size],
		[-size * .86, size * .5],
		[size * .86, size * .5]
	];
	for (const [dx, dy] of points) {
		ctx.beginPath();
		ctx.arc(x + dx, y + dy, Math.max(1.4, size * .16), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}
/** Gesto, filtro e mediador — a observação da observação, desenhada no campo. */
function drawSecondOrder(ctx, sample, w, h) {
	if (!sample?.hasPointer) return;
	const rawX = sample.raw.x * w;
	const rawY = sample.raw.y * h;
	const filtX = sample.filtered.x * w;
	const filtY = sample.filtered.y * h;
	const medX = sample.position.x * w;
	const medY = sample.position.y * h;
	ctx.save();
	ctx.lineWidth = 1;
	ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
	ctx.strokeStyle = PALETTE.line;
	ctx.globalAlpha = .9;
	ctx.beginPath();
	ctx.moveTo(rawX, rawY);
	ctx.lineTo(filtX, filtY);
	ctx.lineTo(medX, medY);
	ctx.stroke();
	ctx.strokeStyle = PALETTE.mute;
	ctx.strokeRect(rawX - 4, rawY - 4, 8, 8);
	ctx.fillStyle = PALETTE.mute;
	ctx.fillText("gesto", rawX + 8, rawY - 6);
	ctx.strokeStyle = PALETTE.bone;
	ctx.beginPath();
	ctx.arc(filtX, filtY, 6, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = PALETTE.bone;
	ctx.fillText("filtro", filtX + 10, filtY + 14);
	drawMediationMark(ctx, medX, medY, 9, .95);
	ctx.globalAlpha = .9;
	ctx.fillStyle = PALETTE.mediate;
	ctx.fillText("mediador", medX + 12, medY - 8);
	ctx.restore();
}
var W = 96;
var H = 54;
var N = 5184;
var BUF = 48;
/**
* Vórtice laminar. O ponteiro não injeta força.
* O MediatorProbe lê o campo, gira o erro (o terceiro) e só então empurra o fluido.
* PhaseResonanceAnalyzer: correlação cruzada com atraso entre o gesto filtrado e a velocidade local.
*/
var LaminarCircuit = class {
	id = "laminar_vortex";
	u = new Float32Array(N);
	v = new Float32Array(N);
	u0 = new Float32Array(N);
	v0 = new Float32Array(N);
	dens = new Float32Array(N);
	dens0 = new Float32Array(N);
	shear = new Float32Array(N);
	shear0 = new Float32Array(N);
	curl = new Float32Array(N);
	p = new Float32Array(N);
	div = new Float32Array(N);
	inX = new Float32Array(BUF);
	inY = new Float32Array(BUF);
	flX = new Float32Array(BUF);
	flY = new Float32Array(BUF);
	cursor = 0;
	filled = 0;
	probeX = .5;
	probeY = .5;
	forceX = 0;
	forceY = 0;
	emitAcc = 0;
	time = 0;
	homeoHold = 0;
	homeoArmed = false;
	reading = "O fluido já gira. O mediador ainda não ouviu você.";
	readingHold = 0;
	pendingReading = this.reading;
	qualityFull = true;
	input = null;
	image = null;
	plate = null;
	marks = /* @__PURE__ */ new Int32Array(8);
	markScore = /* @__PURE__ */ new Float32Array(8);
	out = {
		module: "laminar_vortex",
		resonance: 0,
		phaseOffset: 0,
		tension: .15,
		harmony: .45,
		complexity: .2,
		homeodynamic: false,
		reading: this.reading,
		porosity: 1
	};
	bus;
	constructor(bus) {
		this.bus = bus;
		this.seed();
		bus.onFiltered((_velocity, _acceleration, _lag) => {
			this.input = bus.lastInput;
		});
	}
	setQuality(full) {
		this.qualityFull = full;
	}
	seed() {
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			const x = i / W - .5;
			const y = j / H - .48;
			this.u[idx] = -y * 46;
			this.v[idx] = x * 62;
			const r = x * x + y * y;
			this.dens[idx] = Math.exp(-r * 10) * .85;
			this.shear[idx] = Math.exp(-((x + .18) ** 2 + (y - .08) ** 2) * 18) * .45;
		}
		this.project(this.u, this.v);
	}
	step(dt) {
		this.time += dt;
		const input = this.input;
		const targetX = input?.position.x ?? .5;
		const targetY = input?.position.y ?? .5;
		this.probeX = lerp(this.probeX, targetX, 1 - Math.exp(-dt * 2.4));
		this.probeY = lerp(this.probeY, targetY, 1 - Math.exp(-dt * 2.4));
		const local = this.sampleVelocity(this.probeX, this.probeY);
		const desiredX = (input?.velocity.x ?? 0) * W * .55;
		const desiredY = (input?.velocity.y ?? 0) * H * .55;
		const errX = desiredX - local.x;
		const errY = desiredY - local.y;
		const ang = .9 + .45 * Math.sin(this.time * .7);
		const rotX = errX * Math.cos(ang) - errY * Math.sin(ang);
		const rotY = errX * Math.sin(ang) + errY * Math.cos(ang);
		const follow = 1 - Math.exp(-dt * 3.2);
		this.forceX = lerp(this.forceX, rotX, follow);
		this.forceY = lerp(this.forceY, rotY, follow);
		this.splat(this.u, this.probeX, this.probeY, this.forceX * dt * 8, 5.5);
		this.splat(this.v, this.probeX, this.probeY, this.forceY * dt * 8, 5.5);
		const push = Math.hypot(this.forceX, this.forceY);
		this.splat(this.dens, this.probeX, this.probeY, Math.min(.45, push * .004), 4.2);
		if (this.averageSpeed() < 8) {
			this.splat(this.u, .5, .42, -18 * dt, 10);
			this.splat(this.v, .62, .5, 18 * dt, 10);
		}
		this.advect(this.u0, this.u, this.u, this.v, dt, 1);
		this.advect(this.v0, this.v, this.u, this.v, dt, 1);
		this.swapVel();
		this.project(this.u, this.v);
		this.curlField();
		if (this.qualityFull) this.confinement(dt);
		this.project(this.u, this.v);
		this.advect(this.dens0, this.dens, this.u, this.v, dt, .997);
		this.swapDens();
		this.advect(this.shear0, this.shear, this.u, this.v, dt, .994);
		const shearTmp = this.shear;
		this.shear = this.shear0;
		this.shear0 = shearTmp;
		this.depositShear();
		this.analyze(local, desiredX, desiredY, dt);
		this.emitAcc += dt;
		if (this.emitAcc >= .1) {
			this.emitAcc = 0;
			this.publish();
		}
	}
	analyze(local, desiredX, desiredY, dt) {
		this.inX[this.cursor] = desiredX;
		this.inY[this.cursor] = desiredY;
		this.flX[this.cursor] = local.x;
		this.flY[this.cursor] = local.y;
		this.cursor = (this.cursor + 1) % BUF;
		this.filled = Math.min(BUF, this.filled + 1);
		const n = this.filled;
		if (n < 16) return;
		let mx = 0;
		let my = 0;
		let fx = 0;
		let fy = 0;
		for (let i = 0; i < n; i++) {
			const ia = (this.cursor - n + i + BUF) % BUF;
			mx += this.inX[ia];
			my += this.inY[ia];
			fx += this.flX[ia];
			fy += this.flY[ia];
		}
		mx /= n;
		my /= n;
		fx /= n;
		fy /= n;
		let best = -2;
		let bestLag = 0;
		const maxLag = Math.max(1, Math.floor(n / 2));
		for (let lag = 0; lag < maxLag; lag++) {
			let s = 0;
			let sa = 0;
			let sb = 0;
			for (let i = 0; i < n - lag; i++) {
				const ia = (this.cursor - n + i + BUF) % BUF;
				const ib = (this.cursor - n + i + lag + BUF) % BUF;
				const ax = this.inX[ia] - mx;
				const ay = this.inY[ia] - my;
				const bx = this.flX[ib] - fx;
				const by = this.flY[ib] - fy;
				s += ax * bx + ay * by;
				sa += ax * ax + ay * ay;
				sb += bx * bx + by * by;
			}
			const c = s / Math.sqrt(sa * sb + 1e-8);
			if (c > best) {
				best = c;
				bestLag = lag;
			}
		}
		const targetRes = clamp((best + 1) / 2);
		const heard = Math.hypot(desiredX, desiredY) < 8 ? targetRes * .15 : targetRes;
		this.out.resonance = lerp(this.out.resonance, heard, .12);
		this.out.phaseOffset = lerp(this.out.phaseOffset, bestLag / n, .12);
		let curlSum = 0;
		let curlSq = 0;
		let count = 0;
		const cx = Math.floor(clamp(this.probeX, .05, .95) * 95);
		const cy = Math.floor(clamp(this.probeY, .05, .95) * 53);
		const i0 = Math.max(1, cx - 6);
		const i1 = Math.min(94, cx + 6);
		const j0 = Math.max(1, cy - 6);
		const j1 = Math.min(52, cy + 6);
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const c = this.curl[i + j * W];
			curlSum += Math.abs(c);
			curlSq += c * c;
			count++;
		}
		const meanAbs = curlSum / (count || 1);
		const std = Math.sqrt(Math.max(0, curlSq / (count || 1)));
		this.out.tension = lerp(this.out.tension, clamp(meanAbs / 28), .08);
		this.out.complexity = lerp(this.out.complexity, clamp(std / 22), .08);
		const aligned = 1 - clamp(this.out.phaseOffset * 2);
		this.out.harmony = lerp(this.out.harmony, clamp(this.out.resonance * aligned * (1 - this.out.tension * .35)), .08);
		const living = this.out.tension > .08 && this.out.tension < .62;
		const locked = this.out.resonance > .64 && living;
		this.out.homeodynamic = locked;
		if (locked) this.homeoHold += dt;
		else {
			if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
			this.homeoHold = 0;
			this.homeoArmed = false;
		}
		if (this.homeoHold > 1.2) this.homeoArmed = true;
		this.chooseReading(dt);
	}
	chooseReading(dt) {
		const lag = this.input?.mirrorLag ?? 0;
		let next = "Força só entra depois da rotação do mediador. Fluxo e cisalhamento são leituras.";
		if (lag > .2) next = "O espelho segura o gesto. O vórtice conversa com o atraso, não com a mão.";
		else if (this.out.homeodynamic) next = "Fase estável e vórtice vivo. Homeodinâmica aqui é um redemoinho que se reconhece.";
		else if (this.out.resonance > .68) next = "A correlação encostou. Não é acerto: o campo e o gesto passaram a se medir.";
		else if (this.out.resonance < .38) next = "O mediador traduz. O vórtice ainda não reconhece o ritmo do gesto.";
		if (next !== this.pendingReading) {
			this.pendingReading = next;
			this.readingHold = 0;
		} else this.readingHold += dt;
		if (this.readingHold > .45) this.reading = this.pendingReading;
		this.out.reading = this.reading;
	}
	publish() {
		this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
		this.bus.emitReport(this.out);
	}
	report() {
		return this.out;
	}
	flushEpisode() {
		if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
		this.homeoHold = 0;
		this.homeoArmed = false;
	}
	sampleVelocity(nx, ny) {
		const x = clamp(nx, 0, .999) * 95;
		const y = clamp(ny, 0, .999) * 53;
		const i0 = Math.floor(x);
		const j0 = Math.floor(y);
		const i1 = Math.min(95, i0 + 1);
		const j1 = Math.min(53, j0 + 1);
		const sx = x - i0;
		const sy = y - j0;
		return {
			x: this.bilerp(this.u, i0, j0, i1, j1, sx, sy),
			y: this.bilerp(this.v, i0, j0, i1, j1, sx, sy)
		};
	}
	bilerp(f, i0, j0, i1, j1, sx, sy) {
		const a = f[i0 + j0 * W];
		const b = f[i1 + j0 * W];
		const c = f[i0 + j1 * W];
		const d = f[i1 + j1 * W];
		return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
	}
	splat(field, nx, ny, amount, radius) {
		if (amount === 0) return;
		const cx = nx * 95;
		const cy = ny * 53;
		const r2 = radius * radius;
		const i0 = Math.max(1, Math.floor(cx - radius));
		const i1 = Math.min(94, Math.ceil(cx + radius));
		const j0 = Math.max(1, Math.floor(cy - radius));
		const j1 = Math.min(52, Math.ceil(cy + radius));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const dx = i - cx;
			const dy = j - cy;
			const d2 = dx * dx + dy * dy;
			if (d2 < r2) field[i + j * W] += amount * Math.exp(-d2 / (r2 * .45));
		}
	}
	advect(dest, src, u, v, dt, dissip) {
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			let x = i - dt * u[idx];
			let y = j - dt * v[idx];
			if (x < .5) x = .5;
			if (x > 94.5) x = 94.5;
			if (y < .5) y = .5;
			if (y > 52.5) y = 52.5;
			const i0 = Math.floor(x);
			const j0 = Math.floor(y);
			const i1 = i0 + 1;
			const j1 = j0 + 1;
			const s1 = x - i0;
			const s0 = 1 - s1;
			const t1 = y - j0;
			const t0 = 1 - t1;
			dest[idx] = dissip * (s0 * (t0 * src[i0 + j0 * W] + t1 * src[i0 + j1 * W]) + s1 * (t0 * src[i1 + j0 * W] + t1 * src[i1 + j1 * W]));
		}
	}
	swapVel() {
		const tu = this.u;
		this.u = this.u0;
		this.u0 = tu;
		const tv = this.v;
		this.v = this.v0;
		this.v0 = tv;
	}
	swapDens() {
		const t = this.dens;
		this.dens = this.dens0;
		this.dens0 = t;
	}
	project(u, v) {
		const { div, p } = this;
		const iters = this.qualityFull ? 16 : 8;
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			div[idx] = -.5 * (u[idx + 1] - u[idx - 1] + v[idx + W] - v[idx - W]);
			p[idx] = 0;
		}
		for (let k = 0; k < iters; k++) for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			p[idx] = (div[idx] + p[idx - 1] + p[idx + 1] + p[idx - W] + p[idx + W]) / 4;
		}
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			u[idx] -= .5 * (p[idx + 1] - p[idx - 1]);
			v[idx] -= .5 * (p[idx + W] - p[idx - W]);
			const sp = Math.hypot(u[idx], v[idx]);
			if (sp > 220) {
				u[idx] *= 220 / sp;
				v[idx] *= 220 / sp;
			}
		}
	}
	curlField() {
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			this.curl[idx] = .5 * (this.v[idx + 1] - this.v[idx - 1] - (this.u[idx + W] - this.u[idx - W]));
		}
	}
	confinement(dt) {
		const eps = 1.2;
		for (let j = 2; j < 52; j++) for (let i = 2; i < 94; i++) {
			const idx = i + j * W;
			const cL = Math.abs(this.curl[idx - 1]);
			const cR = Math.abs(this.curl[idx + 1]);
			const cB = Math.abs(this.curl[idx - W]);
			const cT = Math.abs(this.curl[idx + W]);
			let gx = .5 * (cR - cL);
			let gy = .5 * (cT - cB);
			const mag = Math.hypot(gx, gy) + 1e-6;
			gx /= mag;
			gy /= mag;
			this.u[idx] += dt * eps * gy * this.curl[idx];
			this.v[idx] -= dt * eps * gx * this.curl[idx];
		}
	}
	depositShear() {
		for (let j = 1; j < 53; j++) for (let i = 1; i < 95; i++) {
			const idx = i + j * W;
			const c = Math.abs(this.curl[idx]);
			if (c > 3) this.shear[idx] = Math.min(1.4, this.shear[idx] + c * .0016);
		}
	}
	averageSpeed() {
		let s = 0;
		let n = 0;
		for (let i = 0; i < N; i += 7) {
			s += Math.hypot(this.u[i], this.v[i]);
			n++;
		}
		return s / n;
	}
	draw(ctx, w, h) {
		if (!this.plate || !this.image) {
			this.plate = document.createElement("canvas");
			this.plate.width = W;
			this.plate.height = H;
			this.image = new ImageData(W, H);
		}
		const data = this.image.data;
		const [ir, ig, ib] = RGB.ink;
		const [fr, fg, fb] = RGB.flow;
		const [tr, tg, tb] = RGB.tension;
		for (let i = 0; i < 8; i++) this.markScore[i] = -1;
		for (let p = 0; p < N; p++) {
			const d = this.dens[p];
			const s = this.shear[p];
			const c = Math.abs(this.curl[p]);
			const f = d / (d + .32);
			const sh = s / (s + .28);
			const curlN = c / (c + 10);
			let r = ir + (fr - ir) * f + (tr - ir) * sh * .8 + curlN * 30;
			let g = ig + (fg - ig) * f + (tg - ig) * sh * .75 + curlN * 26;
			let b = ib + (fb - ib) * f + (tb - ib) * sh * .45 + curlN * 18;
			if (r > 255) r = 255;
			if (g > 255) g = 255;
			if (b > 255) b = 255;
			const o = p * 4;
			data[o] = r;
			data[o + 1] = g;
			data[o + 2] = b;
			data[o + 3] = 255;
			if ((p & 15) === 0) this.considerMark(p, c * (.35 + f));
		}
		const plateCtx = this.plate.getContext("2d");
		if (plateCtx) plateCtx.putImageData(this.image, 0, 0);
		ctx.fillStyle = PALETTE.ink;
		ctx.fillRect(0, 0, w, h);
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(this.plate, 0, 0, w, h);
		if (this.qualityFull) {
			ctx.save();
			ctx.strokeStyle = PALETTE.bone;
			ctx.globalAlpha = .15 + this.out.resonance * .55;
			ctx.lineWidth = 1;
			const step = 6;
			for (let j = 2; j < 52; j += step) for (let i = 2; i < 94; i += step) {
				const idx = i + j * W;
				const vx = this.u[idx];
				const vy = this.v[idx];
				const mag = Math.hypot(vx, vy);
				if (mag < 6) continue;
				const x = i / 95 * w;
				const y = j / 53 * h;
				const scale = Math.min(16, mag * .12);
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + vx / mag * scale, y + vy / mag * scale);
				ctx.stroke();
			}
			ctx.restore();
		}
		const alpha = .2 + this.out.resonance * .75;
		for (let m = 0; m < 8; m++) {
			const idx = this.marks[m];
			if (this.markScore[m] < 0 || idx < 0) continue;
			const i = idx % W;
			const j = idx / W | 0;
			const x = i / 95 * w;
			const y = j / 53 * h;
			const kind = idx % 3;
			if (kind === 0) drawFlowMark(ctx, x, y, 8, alpha);
			else if (kind === 1) drawTensionMark(ctx, x, y, 8, alpha);
			else drawMediationMark(ctx, x, y, 7, alpha);
		}
		drawSecondOrder(ctx, this.input, w, h);
		ctx.save();
		ctx.strokeStyle = PALETTE.mediate;
		ctx.globalAlpha = .85;
		ctx.lineWidth = 1.25;
		const px = this.probeX * w;
		const py = this.probeY * h;
		ctx.beginPath();
		ctx.arc(px, py, 16 + Math.sin(this.time * 2) * 1.5, this.time * .8, this.time * .8 + 4.2);
		ctx.stroke();
		ctx.restore();
	}
	considerMark(idx, score) {
		if (score < 2) return;
		let slot = 0;
		for (let i = 1; i < 8; i++) if (this.markScore[i] < this.markScore[slot]) slot = i;
		if (score > this.markScore[slot]) {
			this.markScore[slot] = score;
			this.marks[slot] = idx;
		}
	}
};
var MODULE_COLOR = {
	laminar_vortex: PALETTE.flow,
	rhizoma: PALETTE.mediate,
	tensegrity_knot: PALETTE.tension
};
/** O terceiro não simula os circuitos. Lê o que eles já disseram. */
function drawObserver(ctx, w, h, profile, time) {
	ctx.fillStyle = PALETTE.ink;
	ctx.fillRect(0, 0, w, h);
	const cx = w * .5;
	const cy = h * .52;
	const radius = Math.min(w, h) * .3;
	ctx.save();
	ctx.strokeStyle = PALETTE.line;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.ellipse(cx, cy, radius, radius * .86, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(cx, cy, radius * .62, radius * .53, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
	const history = profile.phase_alignment_history;
	if (history.length > 1) {
		ctx.beginPath();
		for (let i = 0; i < history.length; i++) {
			const sample = history[i];
			const ang = i / history.length * Math.PI * 2 - Math.PI / 2 + time * .05;
			const rad = radius * (.42 + sample.resonance * .5);
			const x = cx + Math.cos(ang) * rad;
			const y = cy + Math.sin(ang) * rad * .86;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.strokeStyle = PALETTE.bone;
		ctx.globalAlpha = .75;
		ctx.lineWidth = 1.25;
		ctx.stroke();
		ctx.globalAlpha = 1;
		const last = history[history.length - 1];
		const ang = Math.PI * 2 - Math.PI / 2 + time * .05;
		const rad = radius * (.42 + last.resonance * .5);
		ctx.fillStyle = MODULE_COLOR[last.module] ?? PALETTE.bone;
		ctx.beginPath();
		ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * .86, 4, 0, Math.PI * 2);
		ctx.fill();
	}
	const lex = profile.lexicon_progress;
	const marks = [
		[
			cx,
			cy - radius * .15,
			lex.flow,
			"flow"
		],
		[
			cx - radius * .22,
			cy + radius * .16,
			lex.tension,
			"tension"
		],
		[
			cx + radius * .22,
			cy + radius * .16,
			lex.mediation,
			"mediation"
		]
	];
	for (const [x, y, clarity, id] of marks) {
		const size = 8 + clarity * 16;
		const alpha = .25 + clarity * .75;
		if (id === "flow") drawFlowMark(ctx, x, y, size, alpha);
		else if (id === "tension") drawTensionMark(ctx, x, y, size, alpha);
		else drawMediationMark(ctx, x, y, size, alpha);
	}
	const events = profile.resonance_events.slice(-16);
	if (events.length) {
		ctx.save();
		const y = h - 28;
		const gap = Math.min(28, (w - 48) / events.length);
		events.forEach((event, i) => {
			const x = 24 + i * gap;
			ctx.fillStyle = event.homeodynamic ? PALETTE.flow : PALETTE.mute;
			ctx.globalAlpha = .85;
			ctx.fillRect(x, y - Math.min(18, event.duration * 4), 3, Math.min(18, 4 + event.duration * 4));
		});
		ctx.restore();
	}
}
var AGENTS = 64;
var BRANCHES = 380;
var FW = 36;
var FH = 20;
var FN = 720;
/**
* Rizoma. Quatro espécies negociam localmente.
* O gesto não planta: o FieldNegotiator aceita só uma porosidade do nutriente sugerido.
* DialogicMemory de sessões anteriores continua atraindo ou repelindo.
*/
var RhizomaCircuit = class {
	id = "rhizoma";
	lens = "flow";
	x = new Float32Array(AGENTS);
	y = new Float32Array(AGENTS);
	vx = new Float32Array(AGENTS);
	vy = new Float32Array(AGENTS);
	kind = new Uint8Array(AGENTS);
	energy = new Float32Array(AGENTS);
	phase = new Float32Array(AGENTS);
	rate = new Float32Array(AGENTS);
	cool = new Float32Array(AGENTS);
	bx0 = new Float32Array(BRANCHES);
	by0 = new Float32Array(BRANCHES);
	bx1 = new Float32Array(BRANCHES);
	by1 = new Float32Array(BRANCHES);
	blife = new Float32Array(BRANCHES);
	bcount = 0;
	field = new Float32Array(FN);
	field0 = new Float32Array(FN);
	occupy = new Float32Array(FN);
	memories = [];
	linkA = /* @__PURE__ */ new Int16Array(24);
	linkB = /* @__PURE__ */ new Int16Array(24);
	links = 0;
	memoryCool = 0;
	input = null;
	time = 0;
	emitAcc = 0;
	homeoHold = 0;
	homeoArmed = false;
	reading = "O enxame já negocia. Sua mão, se vier, será só uma pergunta.";
	readingHold = 0;
	pending = this.reading;
	sessionIndex = 1;
	out = {
		module: "rhizoma",
		resonance: .2,
		phaseOffset: .2,
		tension: .3,
		harmony: .4,
		complexity: .35,
		homeodynamic: false,
		reading: this.reading,
		porosity: .7
	};
	bus;
	constructor(bus) {
		this.bus = bus;
		this.seedField();
		this.seedAgents();
		bus.onFiltered(() => {
			this.input = bus.lastInput;
		});
	}
	seedMemory(nodes, sessionIndex) {
		this.sessionIndex = sessionIndex + 1;
		this.memories = nodes.slice(-32).map((node) => ({
			x: node.x,
			y: node.y,
			polarity: node.polarity,
			strength: node.strength,
			prior: true
		}));
	}
	seedField() {
		const blobs = [
			[
				.28,
				.36,
				.7
			],
			[
				.7,
				.32,
				.55
			],
			[
				.55,
				.68,
				.8
			],
			[
				.22,
				.72,
				.4
			]
		];
		for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
			const nx = i / 35;
			const ny = j / 19;
			let v = 0;
			for (const [bx, by, amp] of blobs) {
				const dx = nx - bx;
				const dy = ny - by;
				v += amp * Math.exp(-(dx * dx + dy * dy) * 18);
			}
			this.field[i + j * FW] = v;
		}
	}
	seedAgents() {
		for (let i = 0; i < AGENTS; i++) {
			this.kind[i] = i % 4;
			const ang = i * 2.399;
			const rad = .08 + i % 9 * .035;
			this.x[i] = clamp(.5 + Math.cos(ang) * rad, .06, .94);
			this.y[i] = clamp(.5 + Math.sin(ang) * rad * .85, .06, .94);
			this.energy[i] = .45 + i % 5 * .08;
			this.phase[i] = i * .37 % (Math.PI * 2);
			this.rate[i] = .6 + i % 4 * .35;
			this.cool[i] = i % 7 * .05;
		}
	}
	step(dt) {
		this.time += dt;
		this.memoryCool = Math.max(0, this.memoryCool - dt);
		this.links = 0;
		this.diffuse(dt);
		this.rebuildOccupy();
		this.deposit();
		this.negotiate(dt);
		this.integrate(dt);
		this.ageBranches(dt);
		this.analyze(dt);
		this.emitAcc += dt;
		if (this.emitAcc >= .1) {
			this.emitAcc = 0;
			this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
			this.bus.emitReport(this.out);
		}
	}
	diffuse(dt) {
		for (const [i, j] of [
			[10, 7],
			[24, 6],
			[20, 14],
			[8, 15]
		]) this.field[i + j * FW] += dt * .08;
		for (let j = 1; j < 19; j++) for (let i = 1; i < 35; i++) {
			const idx = i + j * FW;
			const avg = this.field[idx - 1] + this.field[idx + 1] + this.field[idx - FW] + this.field[idx + FW];
			this.field0[idx] = (this.field[idx] * .62 + avg * .095) * (1 - dt * .12);
		}
		const swap = this.field;
		this.field = this.field0;
		this.field0 = swap;
		for (let i = 0; i < FN; i++) {
			if (this.field[i] < 0) this.field[i] = 0;
			if (this.field[i] > 1.6) this.field[i] = 1.6;
		}
	}
	rebuildOccupy() {
		this.occupy.fill(0);
		for (let a = 0; a < AGENTS; a++) {
			const i = clamp(Math.floor(this.x[a] * 35), 0, 35);
			const j = clamp(Math.floor(this.y[a] * 19), 0, 19);
			this.occupy[i + j * FW] += this.kind[a] === 1 ? .22 : .12;
		}
	}
	deposit() {
		const input = this.input;
		if (!input?.hasPointer) return;
		const speed = Math.hypot(input.velocity.x, input.velocity.y);
		if (speed < .04) return;
		const idx = clamp(Math.floor(input.position.x * 35), 1, 34) + clamp(Math.floor(input.position.y * 19), 1, 18) * FW;
		const porosity = clamp(1 - this.occupy[idx] * 1.35, .06, 1);
		const amount = Math.min(.22, speed * .05) * porosity;
		this.field[idx] += amount;
		this.out.porosity = porosity;
	}
	cell(nx, ny) {
		return clamp(Math.floor(nx * 35), 0, 35) + clamp(Math.floor(ny * 19), 0, 19) * FW;
	}
	gradient(nx, ny) {
		const idx = clamp(Math.floor(nx * 35), 1, 34) + clamp(Math.floor(ny * 19), 1, 18) * FW;
		return {
			x: (this.field[idx + 1] - this.field[idx - 1]) * .5,
			y: (this.field[idx + FW] - this.field[idx - FW]) * .5
		};
	}
	negotiate(dt) {
		for (let a = 0; a < AGENTS; a++) {
			this.phase[a] = (this.phase[a] + this.rate[a] * dt) % (Math.PI * 2);
			this.cool[a] = Math.max(0, this.cool[a] - dt);
			const g = this.gradient(this.x[a], this.y[a]);
			for (const mem of this.memories) {
				const dx = mem.x - this.x[a];
				const dy = mem.y - this.y[a];
				const fall = Math.exp(-(dx * dx + dy * dy) * 10) * mem.strength;
				const sign = this.kind[a] === 3 ? -1 : 1;
				this.vx[a] += dx * fall * mem.polarity * sign * .35;
				this.vy[a] += dy * fall * mem.polarity * sign * .35;
			}
			const k = this.kind[a];
			if (k === 0) {
				this.vx[a] += g.x * 1.4;
				this.vy[a] += g.y * 1.4;
				const idx = this.cell(this.x[a], this.y[a]);
				const bite = Math.min(this.field[idx], .25);
				this.field[idx] -= bite;
				this.energy[a] = clamp(this.energy[a] + bite * .5, 0, 1.4);
			} else if (k === 1) {
				this.vx[a] += g.x * .25;
				this.vy[a] += -g.y * .05;
				if (this.cool[a] <= 0 && this.energy[a] > .35 && this.bcount < BRANCHES) {
					const idx = this.cell(this.x[a], this.y[a]);
					if (this.occupy[idx] > .85) this.cool[a] = .45;
					else {
						const toward = Math.atan2(g.y, g.x);
						const wander = Math.sin(this.phase[a]) * .9;
						const ang = Math.abs(g.x) + Math.abs(g.y) > .02 ? toward * .65 + wander : wander + this.phase[a];
						const len = .028 + this.energy[a] * .018;
						const nx = clamp(this.x[a] + Math.cos(ang) * len, .04, .96);
						const ny = clamp(this.y[a] + Math.sin(ang) * len, .04, .96);
						const b = this.bcount++;
						this.bx0[b] = this.x[a];
						this.by0[b] = this.y[a];
						this.bx1[b] = nx;
						this.by1[b] = ny;
						this.blife[b] = 9;
						this.x[a] = nx;
						this.y[a] = ny;
						this.energy[a] *= .78;
						this.cool[a] = .28;
					}
				}
			} else if (k === 2) {
				let best = -1;
				let bestD = .09;
				for (let o = 0; o < AGENTS; o++) {
					if (o === a || this.kind[o] === 2) continue;
					const dx = this.x[o] - this.x[a];
					const dy = this.y[o] - this.y[a];
					const d2 = dx * dx + dy * dy;
					if (d2 < bestD) {
						bestD = d2;
						best = o;
					}
				}
				if (best >= 0) {
					const dx = this.x[best] - this.x[a];
					const dy = this.y[best] - this.y[a];
					this.vx[a] += dx * 1.6;
					this.vy[a] += dy * 1.6;
					if (this.links < 24) {
						this.linkA[this.links] = a;
						this.linkB[this.links] = best;
						this.links++;
					}
					const diff = Math.atan2(Math.sin(this.phase[best] - this.phase[a]), Math.cos(this.phase[best] - this.phase[a]));
					this.phase[a] = (this.phase[a] + diff * .15) % (Math.PI * 2);
					this.energy[a] = clamp(this.energy[a] + dt * .15, 0, 1.4);
					this.energy[best] = clamp(this.energy[best] + dt * .08, 0, 1.4);
					if (this.memoryCool <= 0 && Math.abs(diff) < .45 && this.memories.length < 40) this.sproutMemory(a, best);
				} else {
					this.vx[a] += g.x * .4;
					this.vy[a] += g.y * .4;
				}
			} else {
				let hot = this.cell(this.x[a], this.y[a]);
				let bestOcc = this.occupy[hot];
				const i0 = hot % FW;
				const j0 = hot / FW | 0;
				for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
					const i = clamp(i0 + di, 0, 35);
					const j = clamp(j0 + dj, 0, 19);
					const occ = this.occupy[i + j * FW];
					if (occ > bestOcc) {
						bestOcc = occ;
						hot = i + j * FW;
					}
				}
				const tx = hot % FW / 35;
				const ty = (hot / FW | 0) / 19;
				this.vx[a] += (tx - this.x[a]) * .8;
				this.vy[a] += (ty - this.y[a]) * .8;
				const here = this.cell(this.x[a], this.y[a]);
				this.field[here] *= 1 - dt * .8;
				this.energy[a] = clamp(this.energy[a] + dt * .05, 0, 1.2);
			}
		}
		for (let a = 0; a < AGENTS; a++) for (let o = a + 1; o < AGENTS; o++) {
			const dx = this.x[o] - this.x[a];
			const dy = this.y[o] - this.y[a];
			const d2 = dx * dx + dy * dy;
			if (d2 < 9e-4 && d2 > 1e-6) {
				const inv = .012 / d2;
				this.vx[a] -= dx * inv;
				this.vy[a] -= dy * inv;
				this.vx[o] += dx * inv;
				this.vy[o] += dy * inv;
			}
		}
	}
	sproutMemory(a, b) {
		const node = {
			x: (this.x[a] + this.x[b]) * .5,
			y: (this.y[a] + this.y[b]) * .5,
			polarity: this.kind[b] === 3 ? -.6 : .85,
			strength: .55,
			session: this.sessionIndex
		};
		this.memories.push({
			...node,
			prior: false
		});
		this.bus.emitMemory(node);
		this.memoryCool = 1.6;
	}
	integrate(dt) {
		const damp = Math.exp(-dt * 1.7);
		for (let a = 0; a < AGENTS; a++) {
			this.vx[a] *= damp;
			this.vy[a] *= damp;
			const sp = Math.hypot(this.vx[a], this.vy[a]);
			if (sp > .45) {
				this.vx[a] *= .45 / sp;
				this.vy[a] *= .45 / sp;
			}
			this.x[a] = clamp(this.x[a] + this.vx[a] * dt, .03, .97);
			this.y[a] = clamp(this.y[a] + this.vy[a] * dt, .03, .97);
		}
	}
	ageBranches(dt) {
		for (let i = 0; i < this.bcount; i++) {
			this.blife[i] -= dt;
			if (this.blife[i] <= 0) {
				const last = this.bcount - 1;
				this.bx0[i] = this.bx0[last];
				this.by0[i] = this.by0[last];
				this.bx1[i] = this.bx1[last];
				this.by1[i] = this.by1[last];
				this.blife[i] = this.blife[last];
				this.bcount--;
				i--;
			}
		}
	}
	analyze(dt) {
		let mx = 0;
		let my = 0;
		let sin = 0;
		let cos = 0;
		let sym = 0;
		let kinds = 0;
		const seen = [
			0,
			0,
			0,
			0
		];
		for (let a = 0; a < AGENTS; a++) {
			if (this.kind[a] !== 3) {
				mx += this.vx[a];
				my += this.vy[a];
			}
			if (this.kind[a] === 2) {
				sin += Math.sin(this.phase[a]);
				cos += Math.cos(this.phase[a]);
				sym++;
			}
			seen[this.kind[a]]++;
		}
		for (const n of seen) if (n > 0) kinds++;
		const coherence = sym > 0 ? Math.hypot(sin, cos) / sym : 0;
		const input = this.input;
		const ivx = input?.velocity.x ?? 0;
		const ivy = input?.velocity.y ?? 0;
		const ispeed = Math.hypot(ivx, ivy);
		const mspeed = Math.hypot(mx, my);
		const align = ispeed > .05 && mspeed > 1e-4 ? clamp((ivx * mx + ivy * my) / (ispeed * mspeed) * .5 + .5) : coherence;
		this.out.resonance = lerp(this.out.resonance, clamp(align * .55 + coherence * .45), .08);
		const meanPhase = Math.atan2(sin, cos);
		this.out.phaseOffset = lerp(this.out.phaseOffset, (meanPhase + Math.PI) / (Math.PI * 2), .1);
		this.out.tension = lerp(this.out.tension, clamp(this.links / 10), .1);
		this.out.complexity = lerp(this.out.complexity, clamp(kinds / 4 * (.35 + this.links / 12)), .08);
		this.out.harmony = lerp(this.out.harmony, clamp(coherence * (.5 + this.out.porosity * .5)), .08);
		const nuanced = this.out.porosity > .22 && this.out.porosity < .88;
		this.out.homeodynamic = coherence > .72 && sym >= 4 && nuanced && this.links >= 2;
		if (this.out.homeodynamic) this.homeoHold += dt;
		else {
			if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
			this.homeoHold = 0;
			this.homeoArmed = false;
		}
		if (this.homeoHold > 1.2) this.homeoArmed = true;
		let next = "Crescimento é negociação. A estrutura só avança onde a ocupação deixa porosidade.";
		if (this.memories.some((m) => m.prior)) next = "A sessão anterior ainda puxa o enxame. Memória aqui é um campo, não um fantasma.";
		if ((input?.mirrorLag ?? 0) > .2) next = "O nutriente cai no lugar atrasado. Os agentes respondem ao espelho.";
		else if (this.out.porosity < .35 && input?.hasPointer) next = "Porosidade baixa. O campo recusou parte da pergunta — e isso também é relação.";
		else if (this.out.homeodynamic) next = "Fases da simbiose encostaram. Não é uma colheita: é um acordo temporário.";
		if (next !== this.pending) {
			this.pending = next;
			this.readingHold = 0;
		} else this.readingHold += dt;
		if (this.readingHold > .45) this.reading = next;
		this.out.reading = this.reading;
	}
	flushEpisode() {
		if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
		this.homeoHold = 0;
		this.homeoArmed = false;
	}
	report() {
		return this.out;
	}
	draw(ctx, w, h) {
		ctx.fillStyle = PALETTE.ink;
		ctx.fillRect(0, 0, w, h);
		if (this.lens === "tension") this.drawSdf(ctx, w, h);
		else if (this.lens === "flow") this.drawNutrient(ctx, w, h);
		ctx.save();
		ctx.lineWidth = 1;
		for (const mem of this.memories) {
			ctx.strokeStyle = mem.prior ? PALETTE.mediate : PALETTE.flow;
			ctx.globalAlpha = mem.prior ? .45 : .3;
			ctx.setLineDash(mem.prior ? [3, 4] : []);
			ctx.beginPath();
			ctx.arc(mem.x * w, mem.y * h, 14 + mem.strength * 18, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.setLineDash([]);
		ctx.restore();
		ctx.save();
		ctx.strokeStyle = PALETTE.bone;
		ctx.lineWidth = 1;
		for (let i = 0; i < this.bcount; i++) {
			ctx.globalAlpha = clamp(this.blife[i] / 9, .15, .85);
			ctx.beginPath();
			ctx.moveTo(this.bx0[i] * w, this.by0[i] * h);
			ctx.lineTo(this.bx1[i] * w, this.by1[i] * h);
			ctx.stroke();
		}
		ctx.restore();
		if (this.lens === "sync") {
			ctx.save();
			ctx.strokeStyle = PALETTE.mediate;
			for (let i = 0; i < this.links; i++) {
				const a = this.linkA[i];
				const b = this.linkB[i];
				ctx.globalAlpha = .55;
				ctx.beginPath();
				ctx.moveTo(this.x[a] * w, this.y[a] * h);
				ctx.lineTo(this.x[b] * w, this.y[b] * h);
				ctx.stroke();
			}
			ctx.restore();
		} else if (this.links) {
			ctx.save();
			ctx.strokeStyle = PALETTE.mediate;
			ctx.globalAlpha = .35;
			for (let i = 0; i < this.links; i++) {
				const a = this.linkA[i];
				const b = this.linkB[i];
				ctx.beginPath();
				ctx.moveTo(this.x[a] * w, this.y[a] * h);
				ctx.lineTo(this.x[b] * w, this.y[b] * h);
				ctx.stroke();
			}
			ctx.restore();
		}
		for (let a = 0; a < AGENTS; a++) {
			const px = this.x[a] * w;
			const py = this.y[a] * h;
			const k = this.kind[a];
			ctx.save();
			if (this.lens === "sync") ctx.globalAlpha = .35 + (this.phase[a] / (Math.PI * 2) * .5 + .5) * .65;
			if (k === 0) {
				ctx.fillStyle = PALETTE.flow;
				ctx.beginPath();
				ctx.arc(px, py, 3.2, 0, Math.PI * 2);
				ctx.fill();
				ctx.strokeStyle = PALETTE.flow;
				ctx.globalAlpha = .8;
				ctx.beginPath();
				ctx.moveTo(px, py);
				ctx.lineTo(px + Math.cos(this.phase[a]) * 8, py + Math.sin(this.phase[a]) * 8);
				ctx.stroke();
			} else if (k === 1) {
				ctx.strokeStyle = PALETTE.bone;
				ctx.strokeRect(px - 3, py - 3, 6, 6);
			} else if (k === 2) {
				ctx.strokeStyle = PALETTE.mediate;
				ctx.beginPath();
				ctx.arc(px - 2, py, 3, 0, Math.PI * 2);
				ctx.arc(px + 2, py, 3, 0, Math.PI * 2);
				ctx.stroke();
			} else {
				ctx.strokeStyle = PALETTE.tension;
				ctx.beginPath();
				ctx.arc(px, py, 4.5, .4, 5.6);
				ctx.stroke();
			}
			ctx.restore();
		}
		drawSecondOrder(ctx, this.input, w, h);
	}
	drawNutrient(ctx, w, h) {
		ctx.save();
		ctx.fillStyle = PALETTE.flow;
		for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
			const v = this.field[i + j * FW];
			if (v < .12) continue;
			ctx.globalAlpha = Math.min(.35, v * .22);
			ctx.beginPath();
			ctx.arc(i / 35 * w, j / 19 * h, 10 + v * 16, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
	drawSdf(ctx, w, h) {
		const cols = 28;
		const rows = 16;
		ctx.save();
		ctx.fillStyle = PALETTE.tension;
		const cap = Math.min(this.bcount, 80);
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
			const nx = (i + .5) / cols;
			const ny = (j + .5) / rows;
			let d = .2;
			for (let b = 0; b < cap; b++) d = Math.min(d, distToSeg(nx, ny, this.bx0[b], this.by0[b], this.bx1[b], this.by1[b]));
			if (d > .075) continue;
			ctx.globalAlpha = (1 - d / .075) * .45;
			ctx.fillRect(nx * w - 1, ny * h - 1, 2, 2);
		}
		ctx.restore();
	}
};
function distToSeg(px, py, x0, y0, x1, y1) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const l2 = dx * dx + dy * dy || 1e-6;
	let t = ((px - x0) * dx + (py - y0) * dy) / l2;
	if (t < 0) t = 0;
	else if (t > 1) t = 1;
	const qx = x0 + t * dx;
	const qy = y0 + t * dy;
	return Math.hypot(px - qx, py - qy);
}
var NODES = 6;
var MEMBERS = 12;
var HIST = 120;
/**
* Nó de tensegrity. O gesto é vento sobre um mediador, não uma mão que arrasta nós.
* TensionAgent cede localmente e restaura o pré-esforço.
* HarmonicTopology lê coerência de frequência — homeodinâmica, não "nó desatado".
*/
var TensegrityCircuit = class {
	id = "tensegrity_knot";
	x = new Float32Array(NODES);
	y = new Float32Array(NODES);
	z = new Float32Array(NODES);
	vx = new Float32Array(NODES);
	vy = new Float32Array(NODES);
	vz = new Float32Array(NODES);
	fx = new Float32Array(NODES);
	fy = new Float32Array(NODES);
	fz = new Float32Array(NODES);
	a = new Uint8Array(MEMBERS);
	b = new Uint8Array(MEMBERS);
	rest = new Float32Array(MEMBERS);
	rest0 = new Float32Array(MEMBERS);
	stiff = new Float32Array(MEMBERS);
	cable = new Uint8Array(MEMBERS);
	stress = new Float32Array(MEMBERS);
	energyHist = new Float32Array(HIST);
	histN = 0;
	histW = 0;
	anchorX = .5;
	anchorY = .5;
	anchorZ = 0;
	input = null;
	time = 0;
	emitAcc = 0;
	homeoHold = 0;
	homeoArmed = false;
	analyzeTick = 0;
	reading = "O nó já nasce tensionado. Perturbe pouco e escute o modo que resta.";
	readingHold = 0;
	pending = this.reading;
	out = {
		module: "tensegrity_knot",
		resonance: .25,
		phaseOffset: .3,
		tension: .35,
		harmony: .4,
		complexity: .4,
		homeodynamic: false,
		reading: this.reading,
		porosity: .5
	};
	bus;
	constructor(bus) {
		this.bus = bus;
		this.build();
		bus.onFiltered(() => {
			this.input = bus.lastInput;
		});
	}
	build() {
		for (let i = 0; i < 3; i++) {
			const ang = i / 3 * Math.PI * 2;
			this.x[i] = .5 + Math.cos(ang) * .2;
			this.y[i] = .56 + Math.sin(ang) * .17;
			this.z[i] = -.22;
			const top = i + 3;
			const twist = ang + .85;
			this.x[top] = .5 + Math.cos(twist) * .15;
			this.y[top] = .42 + Math.sin(twist) * .13;
			this.z[top] = .26;
		}
		this.vx[1] = .22;
		this.vy[4] = -.12;
		const cables = [
			[0, 1],
			[1, 2],
			[2, 0],
			[3, 4],
			[4, 5],
			[5, 3],
			[0, 3],
			[1, 4],
			[2, 5]
		];
		const struts = [
			[0, 4],
			[1, 5],
			[2, 3]
		];
		let m = 0;
		for (const [i, j] of cables) this.addMember(m++, i, j, true);
		for (const [i, j] of struts) this.addMember(m++, i, j, false);
		this.anchorX = this.mean(this.x);
		this.anchorY = this.mean(this.y);
		this.anchorZ = this.mean(this.z);
	}
	addMember(index, i, j, isCable) {
		this.a[index] = i;
		this.b[index] = j;
		this.cable[index] = isCable ? 1 : 0;
		const rest = this.length(i, j) * (isCable ? .9 : 1.1);
		this.rest[index] = rest;
		this.rest0[index] = rest;
		this.stiff[index] = isCable ? 11 : 8;
	}
	length(i, j) {
		return Math.hypot(this.x[j] - this.x[i], this.y[j] - this.y[i], this.z[j] - this.z[i]);
	}
	mean(arr) {
		let s = 0;
		for (let i = 0; i < NODES; i++) s += arr[i];
		return s / NODES;
	}
	step(dt) {
		this.time += dt;
		this.fx.fill(0);
		this.fy.fill(0);
		this.fz.fill(0);
		let strainSum = 0;
		let pe = 0;
		for (let m = 0; m < MEMBERS; m++) {
			const i = this.a[m];
			const j = this.b[m];
			const dx = this.x[j] - this.x[i];
			const dy = this.y[j] - this.y[i];
			const dz = this.z[j] - this.z[i];
			const len = Math.hypot(dx, dy, dz) || 1e-5;
			const rest = this.rest[m];
			const delta = len - rest;
			const strain = delta / rest;
			this.stress[m] = strain;
			strainSum += Math.abs(strain);
			const isCable = this.cable[m] === 1;
			let force = 0;
			if (!isCable || delta > 0) force = this.stiff[m] * delta;
			pe += .5 * this.stiff[m] * delta * delta;
			const nx = dx / len;
			const ny = dy / len;
			const nz = dz / len;
			this.fx[i] += nx * force;
			this.fy[i] += ny * force;
			this.fz[i] += nz * force;
			this.fx[j] -= nx * force;
			this.fy[j] -= ny * force;
			this.fz[j] -= nz * force;
			let nextRest = rest + strain * .35 * dt * rest;
			nextRest = lerp(nextRest, this.rest0[m], 1 - Math.exp(-dt * .35));
			const lo = this.rest0[m] * (isCable ? .78 : .9);
			const hi = this.rest0[m] * (isCable ? 1.12 : 1.22);
			this.rest[m] = clamp(nextRest, lo, hi);
		}
		const input = this.input;
		if (input?.hasPointer) {
			const wx = input.velocity.x * 2.4;
			const wy = input.velocity.y * 2.4;
			for (let i = 0; i < NODES; i++) {
				const dx = this.x[i] - input.position.x;
				const dy = this.y[i] - input.position.y;
				const infl = Math.exp(-(dx * dx + dy * dy) * 5.5);
				this.fx[i] += wx * infl * 3.2;
				this.fy[i] += wy * infl * 3.2;
			}
		}
		const damp = Math.exp(-dt * 1.35);
		for (let i = 0; i < NODES; i++) {
			this.vx[i] = (this.vx[i] + this.fx[i] * dt) * damp;
			this.vy[i] = (this.vy[i] + this.fy[i] * dt) * damp;
			this.vz[i] = (this.vz[i] + this.fz[i] * dt) * damp;
			const sp = Math.hypot(this.vx[i], this.vy[i], this.vz[i]);
			if (sp > .85) {
				const s = .85 / sp;
				this.vx[i] *= s;
				this.vy[i] *= s;
				this.vz[i] *= s;
			}
			this.x[i] += this.vx[i] * dt;
			this.y[i] += this.vy[i] * dt;
			this.z[i] += this.vz[i] * dt;
		}
		const cx = this.mean(this.x);
		const cy = this.mean(this.y);
		const cz = this.mean(this.z);
		const pull = 1 - Math.exp(-dt * 1.4);
		for (let i = 0; i < NODES; i++) {
			this.x[i] += (this.anchorX - cx) * pull;
			this.y[i] += (this.anchorY - cy) * pull;
			this.z[i] += (this.anchorZ - cz) * pull;
		}
		this.energyHist[this.histW] = pe;
		this.histW = (this.histW + 1) % HIST;
		this.histN = Math.min(HIST, this.histN + 1);
		const tension = strainSum / MEMBERS;
		this.out.tension = lerp(this.out.tension, clamp(tension / .45), .12);
		this.out.porosity = lerp(this.out.porosity, clamp(1 - this.out.tension), .08);
		this.analyzeTick++;
		if (this.analyzeTick % 4 === 0) this.analyze(dt * 4, pe);
		else this.house(dt);
		this.emitAcc += dt;
		if (this.emitAcc >= .1) {
			this.emitAcc = 0;
			this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
			this.bus.emitReport(this.out);
		}
	}
	house(dt) {
		if (this.out.homeodynamic) this.homeoHold += dt;
		else if (this.homeoArmed) {
			if (this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
			this.homeoHold = 0;
			this.homeoArmed = false;
		}
		if (this.homeoHold > 1.2) this.homeoArmed = true;
	}
	analyze(dt, pe) {
		let coherence = 0;
		let bestLag = 8;
		const n = this.histN;
		if (n > 40) {
			const start = (this.histW - n + HIST) % HIST;
			let mean = 0;
			for (let i = 0; i < n; i++) mean += this.energyHist[(start + i) % HIST];
			mean /= n;
			let var0 = 0;
			for (let i = 0; i < n; i++) {
				const d = this.energyHist[(start + i) % HIST] - mean;
				var0 += d * d;
			}
			const maxLag = Math.min(60, n - 8);
			for (let lag = 8; lag < maxLag; lag++) {
				let s = 0;
				let count = 0;
				for (let i = 0; i < n - lag; i++) {
					const a = this.energyHist[(start + i) % HIST] - mean;
					const b = this.energyHist[(start + i + lag) % HIST] - mean;
					s += a * b;
					count++;
				}
				const c = s / (var0 + 1e-8);
				if (c > coherence) {
					coherence = c;
					bestLag = lag;
				}
			}
			coherence = clamp(coherence);
			this.out.phaseOffset = lerp(this.out.phaseOffset, bestLag / HIST, .2);
			const variance = var0 / n;
			const alive = variance > 1e-6 && variance < .08;
			this.out.homeodynamic = coherence > .55 && alive && this.out.tension > .06 && this.out.tension < .55;
		}
		this.out.resonance = lerp(this.out.resonance, clamp(coherence * .75 + (this.out.homeodynamic ? .25 : 0)), .3);
		const mid = 1 - Math.min(1, Math.abs(this.out.tension - .22) / .22);
		this.out.complexity = lerp(this.out.complexity, clamp(mid * (.35 + coherence)), .3);
		this.out.harmony = lerp(this.out.harmony, this.out.homeodynamic ? .86 : clamp(.28 + coherence * .35), .3);
		this.house(dt);
		let next = "Cada segmento cede um pouco e o pré-esforço puxa de volta. Isso é a negociação.";
		if ((this.input?.mirrorLag ?? 0) > .2) next = "O vento chega atrasado. O nó responde a um gesto que a mão já deixou.";
		else if (this.out.homeodynamic) next = "A energia encontrou um período. Homeodinâmica: o nó continua tenso e coerente.";
		else if (this.out.tension > .5) next = "Esforço alto demais para um modo estável. Afrouxe o vento e deixe os agentes cederem.";
		else if (pe < .002) next = "Quase sem energia potencial. Um toque leve reacende o modo — sem desatar.";
		if (next !== this.pending) {
			this.pending = next;
			this.readingHold = 0;
		} else this.readingHold += dt;
		if (this.readingHold > .45) this.reading = next;
		this.out.reading = this.reading;
	}
	flushEpisode() {
		if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
		this.homeoHold = 0;
		this.homeoArmed = false;
	}
	report() {
		return this.out;
	}
	project(i, w, h) {
		const persp = 1 + this.z[i] * .7;
		return {
			x: w * (.5 + (this.x[i] - .5) * persp),
			y: h * (.5 + (this.y[i] - .5) * persp) - this.z[i] * h * .06
		};
	}
	draw(ctx, w, h) {
		ctx.fillStyle = PALETTE.ink;
		ctx.fillRect(0, 0, w, h);
		const pts = [];
		for (let i = 0; i < NODES; i++) pts.push(this.project(i, w, h));
		for (let pass = 0; pass < 2; pass++) for (let m = 0; m < MEMBERS; m++) {
			const isCable = this.cable[m] === 1;
			if (pass === 0 && isCable || pass === 1 && !isCable) continue;
			const i = this.a[m];
			const j = this.b[m];
			ctx.save();
			ctx.lineWidth = isCable ? 1.15 : 3.2;
			ctx.lineCap = "round";
			if (!isCable) ctx.strokeStyle = PALETTE.tension;
			else ctx.strokeStyle = this.out.homeodynamic ? PALETTE.flow : PALETTE.bone;
			ctx.globalAlpha = isCable ? .45 + Math.min(.5, Math.abs(this.stress[m]) * 2) : .9;
			ctx.beginPath();
			ctx.moveTo(pts[i].x, pts[i].y);
			ctx.lineTo(pts[j].x, pts[j].y);
			ctx.stroke();
			ctx.restore();
		}
		for (let i = 0; i < NODES; i++) {
			const p = pts[i];
			ctx.fillStyle = i < 3 ? PALETTE.bone : PALETTE.mediate;
			ctx.beginPath();
			ctx.arc(p.x, p.y, i < 3 ? 4 : 3.4, 0, Math.PI * 2);
			ctx.fill();
			if (this.out.resonance > .32) this.junction(ctx, i, p.x, p.y);
		}
		drawSecondOrder(ctx, this.input, w, h);
	}
	junction(ctx, index, x, y) {
		const alpha = clamp((this.out.resonance - .28) / .6);
		const kind = index % 3;
		if (kind === 0) {
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = PALETTE.bone;
			ctx.lineWidth = 1;
			for (let m = 0; m < MEMBERS; m++) {
				if (this.a[m] !== index && this.b[m] !== index) continue;
				const other = this.a[m] === index ? this.b[m] : this.a[m];
				const ang = Math.atan2(this.y[other] - this.y[index], this.x[other] - this.x[index]);
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11);
				ctx.stroke();
			}
			ctx.restore();
		} else if (kind === 1) {
			let best = -1;
			let bestStress = -1;
			for (let m = 0; m < MEMBERS; m++) {
				if (this.a[m] !== index && this.b[m] !== index) continue;
				const s = Math.abs(this.stress[m]);
				if (s > bestStress) {
					bestStress = s;
					best = m;
				}
			}
			if (best >= 0) {
				const other = this.a[best] === index ? this.b[best] : this.a[best];
				const ang = Math.atan2(this.y[other] - this.y[index], this.x[other] - this.x[index]);
				ctx.save();
				ctx.globalAlpha = alpha;
				ctx.strokeStyle = PALETTE.tension;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16);
				ctx.stroke();
				ctx.restore();
			}
		} else if (index % 2 === 0) drawFlowMark(ctx, x, y, 9, alpha);
		else if (this.out.tension > .3) drawTensionMark(ctx, x, y, 9, alpha);
		else drawMediationMark(ctx, x, y, 8, alpha);
	}
};
var PROFILE_KEY = "cybersimpatia.profile.v2";
function emptyLexicon() {
	return {
		flow: 0,
		tension: 0,
		mediation: 0
	};
}
function freshProfile() {
	return {
		profile_version: "2.0",
		sessions: [],
		resonance_depth: 0,
		phase_alignment_history: [],
		lexicon_progress: emptyLexicon(),
		mirror_usage_ratio: 0,
		dialogic_memory: [],
		resonance_events: [],
		last_module: null,
		session_count: 0
	};
}
/**
* Profundidade não-linear. A média é atenuada quando um eixo dispara sozinho,
* então "otimizar" um número não aprofunda o circuito.
*/
function resonanceDepth(phaseVariance, homeoRatio, complexity) {
	const a = clamp(phaseVariance / .08);
	const b = clamp(homeoRatio);
	const c = clamp(complexity);
	const mean = (a + b + c) / 3;
	const variance = ((a - mean) ** 2 + (b - mean) ** 2 + (c - mean) ** 2) / 3;
	return mean * (.45 + .55 * (1 - Math.min(1, Math.sqrt(variance) * 2.2)));
}
function num(value, fallback = 0) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function lexicon(value) {
	const src = value && typeof value === "object" ? value : {};
	return {
		flow: clamp(num(src.flow)),
		tension: clamp(num(src.tension)),
		mediation: clamp(num(src.mediation))
	};
}
/** Migra perfis antigos (incl. `avg_sympathy`) para o schema 2.0. */
function migrateProfile(raw) {
	const base = freshProfile();
	if (!raw || typeof raw !== "object") return base;
	const data = raw;
	if (data.profile_version !== "2.0") {
		base.resonance_depth = clamp(num(data.avg_sympathy ?? data.resonance_depth));
		base.lexicon_progress = lexicon(data.lexicon_progress);
		return base;
	}
	base.resonance_depth = clamp(num(data.resonance_depth));
	base.lexicon_progress = lexicon(data.lexicon_progress);
	base.mirror_usage_ratio = clamp(num(data.mirror_usage_ratio));
	base.session_count = Math.max(0, Math.floor(num(data.session_count)));
	if (data.last_module === "laminar_vortex" || data.last_module === "rhizoma" || data.last_module === "tensegrity_knot" || data.last_module === "observer") base.last_module = data.last_module;
	if (Array.isArray(data.sessions)) base.sessions = data.sessions.slice(-24).filter((item) => item && typeof item === "object");
	if (Array.isArray(data.phase_alignment_history)) base.phase_alignment_history = data.phase_alignment_history.slice(-180);
	if (Array.isArray(data.resonance_events)) base.resonance_events = data.resonance_events.slice(-40);
	if (Array.isArray(data.dialogic_memory)) base.dialogic_memory = data.dialogic_memory.slice(-48).filter((item) => item && typeof item === "object").map((item) => {
		const node = item;
		return {
			x: clamp(num(node.x, .5)),
			y: clamp(num(node.y, .5)),
			polarity: clamp(num(node.polarity), -1, 1),
			strength: clamp(num(node.strength)),
			session: Math.max(0, Math.floor(num(node.session)))
		};
	});
	return base;
}
var WINDOW_MS = 1e4;
var LEVELS = [
	.25,
	.5,
	.75,
	1
];
/**
* Persistência do perfil. O flush vai para o localStorage fora do quadro
* de simulação (timer), nunca no meio do passo.
*/
var StateManager = class {
	profile;
	window = [];
	mirrorOn = false;
	mirrorTime = 0;
	openTime = 0;
	sessionStart = 0;
	sessionModule = null;
	sessionMirror = 0;
	sessionOpen = 0;
	dirty = false;
	flushTimer = null;
	lexiconMarks = {
		flow: 0,
		tension: 0,
		mediation: 0
	};
	lastUnlock = null;
	bus;
	constructor(bus) {
		this.bus = bus;
		this.profile = this.load();
		this.lexiconMarks = { ...this.profile.lexicon_progress };
		bus.onSympathy((module, resonance, phaseOffset) => {
			this.notePhase(module, phaseOffset, resonance);
		});
		bus.onReport((report) => this.absorbReport(report));
		bus.onResonance((module, duration, homeodynamic) => {
			const event = {
				module,
				duration,
				homeodynamic,
				at: Date.now()
			};
			this.profile.resonance_events.push(event);
			if (this.profile.resonance_events.length > 40) this.profile.resonance_events.shift();
			this.touch();
		});
		bus.onMirror((enabled) => {
			this.mirrorOn = enabled;
		});
		bus.onMemory((node) => this.remember(node));
		bus.onLexicon((symbolId, clarity) => {
			this.lastUnlock = {
				id: symbolId,
				clarity
			};
		});
	}
	load() {
		try {
			if (typeof localStorage === "undefined") return freshProfile();
			const raw = localStorage.getItem(PROFILE_KEY);
			if (!raw) return freshProfile();
			return migrateProfile(JSON.parse(raw));
		} catch {
			return freshProfile();
		}
	}
	beginSession(module) {
		this.endSession();
		this.sessionModule = module;
		this.sessionStart = Date.now();
		this.sessionMirror = 0;
		this.sessionOpen = 0;
		this.profile.last_module = module;
		this.touch();
	}
	endSession() {
		if (!this.sessionModule || this.sessionModule === "observer") {
			this.sessionModule = null;
			return;
		}
		const open = this.sessionOpen || .001;
		this.profile.sessions.push({
			module: this.sessionModule,
			startedAt: this.sessionStart,
			endedAt: Date.now(),
			mirrorRatio: clamp(this.sessionMirror / open)
		});
		if (this.profile.sessions.length > 24) this.profile.sessions.shift();
		this.profile.session_count += 1;
		this.sessionModule = null;
		this.touch();
	}
	/** Chamado pelo orquestrador uma vez por quadro. Não escreve disco aqui. */
	tick(dt) {
		this.openTime += dt;
		if (this.mirrorOn) this.mirrorTime += dt;
		if (this.sessionModule && this.sessionModule !== "observer") {
			this.sessionOpen += dt;
			if (this.mirrorOn) this.sessionMirror += dt;
		}
		this.profile.mirror_usage_ratio = this.openTime > 0 ? clamp(this.mirrorTime / this.openTime) : this.profile.mirror_usage_ratio;
	}
	notePhase(module, phase, resonance) {
		this.profile.phase_alignment_history.push({
			at: Date.now(),
			module,
			phase,
			resonance,
			homeodynamic: false,
			complexity: 0
		});
		if (this.profile.phase_alignment_history.length > 180) this.profile.phase_alignment_history.splice(0, this.profile.phase_alignment_history.length - 180);
	}
	absorbReport(report) {
		const now = Date.now();
		this.window.push({
			at: now,
			phase: report.phaseOffset,
			homeo: report.homeodynamic ? 1 : 0,
			complexity: report.complexity
		});
		const cutoff = now - WINDOW_MS;
		while (this.window.length && this.window[0].at < cutoff) this.window.shift();
		const history = this.profile.phase_alignment_history;
		const last = history[history.length - 1];
		if (last && last.module === report.module) {
			last.homeodynamic = report.homeodynamic;
			last.complexity = report.complexity;
			last.resonance = report.resonance;
			last.phase = report.phaseOffset;
		}
		this.profile.resonance_depth = this.computeDepth();
		this.growLexicon(report, .1);
		this.touch();
	}
	computeDepth() {
		const samples = this.window;
		if (samples.length < 4) return this.profile.resonance_depth;
		let mean = 0;
		let homeo = 0;
		let complexity = 0;
		for (const sample of samples) {
			mean += sample.phase;
			homeo += sample.homeo;
			complexity += sample.complexity;
		}
		mean /= samples.length;
		homeo /= samples.length;
		complexity /= samples.length;
		let variance = 0;
		for (const sample of samples) {
			const d = sample.phase - mean;
			variance += d * d;
		}
		variance /= samples.length;
		const next = resonanceDepth(variance, homeo, complexity);
		return this.profile.resonance_depth + (next - this.profile.resonance_depth) * .35;
	}
	growLexicon(report, dt) {
		const lex = this.profile.lexicon_progress;
		if (report.module === "laminar_vortex") lex.flow = clamp(lex.flow + report.resonance * dt * .016);
		if (report.module === "tensegrity_knot") lex.tension = clamp(lex.tension + (report.homeodynamic ? .022 : report.resonance * .004) * dt);
		if (report.module === "rhizoma") lex.mediation = clamp(lex.mediation + (.006 + report.porosity * .012) * dt * (.4 + report.resonance));
		if (this.mirrorOn && report.resonance > .22 && report.resonance < .9) lex.mediation = clamp(lex.mediation + dt * .018);
		this.cross("flow", lex.flow);
		this.cross("tension", lex.tension);
		this.cross("mediation", lex.mediation);
	}
	cross(id, clarity) {
		const prev = this.lexiconMarks[id] ?? 0;
		for (const level of LEVELS) if (prev < level && clarity >= level) this.bus.emitLexicon(id, clarity);
		this.lexiconMarks[id] = clarity;
	}
	remember(node) {
		this.profile.dialogic_memory.push(node);
		if (this.profile.dialogic_memory.length > 48) this.profile.dialogic_memory.shift();
		this.touch();
	}
	touch() {
		this.dirty = true;
		if (this.flushTimer !== null) return;
		this.flushTimer = setTimeout(() => this.flush(), 800);
	}
	flush() {
		if (this.flushTimer !== null) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		if (!this.dirty) return;
		this.dirty = false;
		try {
			if (typeof localStorage === "undefined") return;
			localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
		} catch {}
	}
	exportJson() {
		return JSON.stringify(this.profile, null, 2);
	}
};
/**
* Hub. Os circuitos não se enxergam: só o barramento.
* Este orquestrador escolhe quem passo, desenha e sustenta o áudio.
*/
var Runtime = class {
	bus = new EventBus();
	state;
	input;
	audio;
	laminar;
	rhizoma;
	tensegrity;
	module = null;
	canvas = null;
	ctx = null;
	cssW = 0;
	cssH = 0;
	raf = 0;
	running = false;
	last = 0;
	acc = 0;
	settleAcc = 0;
	frameEma = 16;
	observerTime = 0;
	onVis = null;
	unlock = null;
	constructor() {
		this.state = new StateManager(this.bus);
		this.input = new InputFilter(this.bus);
		this.audio = new AudioEngine(this.bus);
		this.laminar = new LaminarCircuit(this.bus);
		this.rhizoma = new RhizomaCircuit(this.bus);
		this.tensegrity = new TensegrityCircuit(this.bus);
		this.bus.onLexicon((id, clarity) => {
			this.unlock = {
				id,
				clarity
			};
		});
		this.rhizoma.seedMemory(this.state.profile.dialogic_memory, this.state.profile.session_count);
	}
	unlockAudio() {
		this.audio.unlock();
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.last = performance.now();
		this.onVis = () => {
			if (document.visibilityState === "visible") this.audio.resume();
		};
		document.addEventListener("visibilitychange", this.onVis);
		this.raf = requestAnimationFrame(this.frame);
		const probe = window;
		probe.__cyber = { snapshot: () => this.snapshot() };
	}
	stop() {
		this.running = false;
		if (this.raf) cancelAnimationFrame(this.raf);
		if (this.onVis) document.removeEventListener("visibilitychange", this.onVis);
		this.active()?.flushEpisode();
		this.state.endSession();
		this.state.flush();
	}
	attach(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.resize();
	}
	resize() {
		const canvas = this.canvas;
		const parent = canvas?.parentElement;
		if (!canvas || !parent || !this.ctx) return;
		const rect = parent.getBoundingClientRect();
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = Math.max(1, rect.width);
		const h = Math.max(1, rect.height);
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.cssW = w;
		this.cssH = h;
	}
	point(x, y) {
		this.input.setPointer(x, y);
	}
	setModule(id) {
		if (this.module === id) return;
		this.active()?.flushEpisode();
		this.state.endSession();
		this.module = id;
		if (id === "rhizoma") this.rhizoma.seedMemory(this.state.profile.dialogic_memory, this.state.profile.session_count);
		if (id !== "observer") this.state.beginSession(id);
		else this.state.profile.last_module = "observer";
		const circuit = this.active();
		if (circuit) this.bus.emitReport(circuit.report());
	}
	setLens(lens) {
		this.rhizoma.lens = lens;
	}
	lens() {
		return this.rhizoma.lens;
	}
	toggleMirror() {
		this.input.setMirror(!this.input.mirror);
	}
	setDelay(seconds) {
		this.input.setDelay(seconds);
	}
	toggleMute() {
		this.audio.setMuted(!this.audio.muted);
	}
	exportJson() {
		this.state.flush();
		download("cybersimpatia-perfil.json", new Blob([this.state.exportJson()], { type: "application/json" }));
	}
	exportPng() {
		const source = this.canvas;
		if (!source || this.cssW < 2) return;
		const footer = 112;
		const plate = document.createElement("canvas");
		plate.width = Math.floor(this.cssW);
		plate.height = Math.floor(this.cssH + footer);
		const ctx = plate.getContext("2d");
		if (!ctx) return;
		const snap = this.snapshot();
		ctx.fillStyle = "#07090c";
		ctx.fillRect(0, 0, plate.width, plate.height);
		ctx.drawImage(source, 0, 0, plate.width, this.cssH);
		ctx.fillStyle = "#e7e2d4";
		ctx.font = "500 28px Fraunces, Palatino, serif";
		ctx.fillText("CyberSimpatia", 28, this.cssH + 42);
		ctx.font = "13px 'IBM Plex Mono', ui-monospace, monospace";
		ctx.fillStyle = "#8d968c";
		const line = `${label(snap.module)}  ·  profundidade ${snap.depth.toFixed(2)}  ·  ressonância ${snap.resonance.toFixed(2)}  ·  fase ${snap.phaseOffset.toFixed(2)}`;
		ctx.fillText(line, 28, this.cssH + 72);
		ctx.fillText(snap.homeodynamic ? "homeodinâmica" : "deriva", 28, this.cssH + 94);
		plate.toBlob((blob) => {
			if (blob) download(`cybersimpatia-${Date.now()}.png`, blob);
		});
	}
	snapshot() {
		const report = this.bus.lastReport;
		const active = this.module === "observer" || this.module === null ? null : report?.module === this.module ? report : this.active()?.report();
		return {
			module: this.module,
			resonance: active?.resonance ?? 0,
			phaseOffset: active?.phaseOffset ?? 0,
			tension: active?.tension ?? 0,
			harmony: active?.harmony ?? 0,
			homeodynamic: active?.homeodynamic ?? false,
			depth: this.state.profile.resonance_depth,
			lexicon: { ...this.state.profile.lexicon_progress },
			mirror: this.input.mirror,
			mirrorDelay: this.input.delay,
			mirrorRatio: this.state.profile.mirror_usage_ratio,
			muted: this.audio.muted,
			reading: this.module === "observer" ? observerReading(this.state.profile.resonance_depth, this.state.profile.mirror_usage_ratio) : active?.reading ?? "Escolha um circuito. O observador espera.",
			porosity: active?.porosity ?? 0,
			quality: this.frameEma > 30 ? "contido" : "pleno",
			sessions: this.state.profile.session_count,
			events: this.state.profile.resonance_events.slice(-5).map((event) => ({
				module: event.module,
				duration: event.duration,
				homeodynamic: event.homeodynamic
			})),
			unlock: this.unlock,
			trace: this.input.copyTraces(),
			audioReady: this.audio.ready
		};
	}
	active() {
		if (this.module === "laminar_vortex") return this.laminar;
		if (this.module === "rhizoma") return this.rhizoma;
		if (this.module === "tensegrity_knot") return this.tensegrity;
		return null;
	}
	frame = (now) => {
		if (!this.running) return;
		const dt = Math.min(.05, (now - this.last) / 1e3 || .016);
		this.last = now;
		this.frameEma = this.frameEma * .92 + dt * 1e3 * .08;
		this.laminar.setQuality(this.frameEma < 30);
		this.input.step(dt);
		this.state.tick(dt);
		const circuit = this.active();
		if (circuit) {
			this.acc += dt;
			let steps = 0;
			while (this.acc >= 1 / 60 && steps < 3) {
				circuit.step(1 / 60);
				this.acc -= 1 / 60;
				steps++;
			}
		} else {
			this.acc = 0;
			this.settleAcc += dt;
			if (this.settleAcc >= .1) {
				this.audio.settle();
				this.settleAcc = 0;
			}
			this.observerTime += dt;
		}
		if (this.ctx && this.cssW > 1 && this.cssH > 1 && this.module) {
			if (this.module === "observer") drawObserver(this.ctx, this.cssW, this.cssH, this.state.profile, this.observerTime);
			else circuit?.draw(this.ctx, this.cssW, this.cssH);
		}
		this.raf = requestAnimationFrame(this.frame);
	};
};
function label(module) {
	if (module === "laminar_vortex") return "vórtice laminar";
	if (module === "rhizoma") return "rizoma";
	if (module === "tensegrity_knot") return "nó tensegrity";
	if (module === "observer") return "observador";
	return "atlas";
}
function observerReading(depth, mirror) {
	if (depth < .08) return "Ainda não há profundidade. Ela pede fase que caminha, tempo em homeodinâmica e complexidade no meio — não um eixo no máximo.";
	if (mirror > .35) return "O espelho ocupou boa parte da escuta. O atraso está virando hábito de leitura, não castigo.";
	return "O observador não corrige os circuitos. Mostra como eles andaram se medindo.";
}
function download(filename, blob) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
function moduleLabel(module) {
	return label(module);
}
var LEXICON = earthscore_lexicon_default.symbols;
var CIRCUITS = [
	{
		id: "laminar_vortex",
		index: "01",
		title: "Vórtice laminar",
		line: "O fluido só escuta o mediador.",
		icon: Waves
	},
	{
		id: "rhizoma",
		index: "02",
		title: "Rizoma",
		line: "Quatro agentes negociam o crescimento.",
		icon: GitBranch
	},
	{
		id: "tensegrity_knot",
		index: "03",
		title: "Nó tensegrity",
		line: "Homeodinâmica, não desenlace.",
		icon: Hexagon
	}
];
var LENSES = [
	{
		id: "flow",
		label: "Fluxo nutricional"
	},
	{
		id: "tension",
		label: "Tensão SDF"
	},
	{
		id: "sync",
		label: "Sincronia temporal"
	}
];
function CyberSimpatia() {
	const runtimeRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const [view, setView] = (0, import_react.useState)("gate");
	const [module, setModule] = (0, import_react.useState)("laminar_vortex");
	const [hud, setHud] = (0, import_react.useState)(null);
	const [lens, setLens] = (0, import_react.useState)("flow");
	(0, import_react.useEffect)(() => {
		const rt = new Runtime();
		runtimeRef.current = rt;
		setHud(rt.snapshot());
		const timer = window.setInterval(() => setHud(rt.snapshot()), 120);
		return () => {
			window.clearInterval(timer);
			rt.stop();
			runtimeRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
			const rt = runtimeRef.current;
			if (!rt || view === "gate") return;
			if (event.key === "1") open("laminar_vortex");
			else if (event.key === "2") open("rhizoma");
			else if (event.key === "3") open("tensegrity_knot");
			else if (event.key === "4") open("observer");
			else if (event.key === "m" || event.key === "M") rt.toggleMirror();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [view]);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const rt = runtimeRef.current;
		if (!canvas || !rt || view !== "circuit") return;
		rt.attach(canvas);
		const parent = canvas.parentElement;
		const observer = new ResizeObserver(() => rt.resize());
		if (parent) observer.observe(parent);
		const onPointer = (event) => {
			const rect = canvas.getBoundingClientRect();
			if (rect.width < 1 || rect.height < 1) return;
			rt.point((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
		};
		canvas.addEventListener("pointerdown", onPointer, { passive: true });
		canvas.addEventListener("pointermove", onPointer, { passive: true });
		return () => {
			observer.disconnect();
			canvas.removeEventListener("pointerdown", onPointer);
			canvas.removeEventListener("pointermove", onPointer);
		};
	}, [view, module]);
	function open(id) {
		runtimeRef.current?.setModule(id);
		setModule(id);
		setView("circuit");
		const snap = runtimeRef.current?.snapshot();
		if (snap) setHud(snap);
	}
	function sintonizar() {
		const rt = runtimeRef.current;
		rt?.unlockAudio();
		rt?.start();
		setView("hub");
	}
	if (view === "gate") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gate, { onEnter: sintonizar });
	if (view === "hub") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hub, {
		hud,
		onOpen: open
	});
	const circuit = CIRCUITS.find((item) => item.id === module);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col overflow-hidden bg-ink text-bone",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-3 border-b border-line px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setView("hub"),
						className: "min-h-11 shrink-0 font-serif text-lg",
						children: "CyberSimpatia"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden min-w-0 flex-1 truncate text-sm text-mute sm:block",
						children: hud?.reading
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-pressed": hud?.mirror ?? false,
							onClick: () => runtimeRef.current?.toggleMirror(),
							className: `inline-flex min-h-11 items-center gap-2 border px-3 text-sm ${hud?.mirror ? "border-mediate text-mediate" : "border-line text-mute"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlipHorizontal2, {
								className: "size-4",
								"aria-hidden": "true"
							}), "Espelho"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => runtimeRef.current?.toggleMute(),
							className: "inline-flex size-11 items-center justify-center border border-line text-mute",
							"aria-label": hud?.muted ? "Ligar áudio" : "Silenciar",
							children: hud?.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" })
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate border-b border-line px-4 py-2 text-sm text-mute sm:hidden",
				children: hud?.reading
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "hidden w-16 flex-col border-r border-line md:flex",
						"aria-label": "Circuitos",
						children: [CIRCUITS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RailButton, {
							active: module === item.id,
							label: item.title,
							onClick: () => open(item.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-5" })
						}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RailButton, {
							active: module === "observer",
							label: "Observador",
							onClick: () => open("observer"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-5" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative min-w-0 flex-1 bg-ink",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: canvasRef,
								className: "h-full w-full touch-none"
							}),
							module === "rhizoma" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute top-3 left-3 flex flex-wrap gap-2",
								children: LENSES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setLens(item.id);
										runtimeRef.current?.setLens(item.id);
									},
									className: `min-h-11 border px-3 text-xs tracking-wide ${lens === item.id ? "border-mediate bg-panel text-mediate" : "border-line bg-panel text-mute"}`,
									children: item.label
								}, item.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "pointer-events-none absolute bottom-3 left-3 text-xs tracking-widest text-mute uppercase",
								children: [
									circuit?.title ?? "Observador",
									" · ritmo ",
									hud?.quality ?? "pleno"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
						className: "hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4 md:flex",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
							hud,
							onDelay: (value) => runtimeRef.current?.setDelay(value),
							onPng: () => runtimeRef.current?.exportPng(),
							onJson: () => runtimeRef.current?.exportJson()
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-line bg-panel md:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
					className: "min-h-11 cursor-pointer px-4 py-3 text-sm",
					children: "Leitura"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex max-h-64 flex-col gap-4 overflow-y-auto px-4 pb-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
						hud,
						onDelay: (value) => runtimeRef.current?.setDelay(value),
						onPng: () => runtimeRef.current?.exportPng(),
						onJson: () => runtimeRef.current?.exportJson()
					})
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-4 gap-2 px-3 py-3",
					children: [CIRCUITS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => open(item.id),
						className: `flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${module === item.id ? "text-bone" : "text-mute"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }), item.index]
					}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => open("observer"),
						className: `flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${module === "observer" ? "text-bone" : "text-mute"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" }), "ler"]
					})]
				})]
			})
		]
	});
}
function Gate({ onEnter }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col bg-ink text-bone",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between px-5 py-4 text-xs tracking-widest text-mute uppercase",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Lógica triádica" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "escuta 2.0" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-5 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-flow uppercase",
							children: "Ação · mediação · ressonância"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-serif text-5xl leading-none font-medium tracking-tight sm:text-6xl",
							children: "CyberSimpatia"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "max-w-xl text-base leading-relaxed text-mute",
							children: "Você não vence um circuito. Sintoniza com ele. O gesto entra filtrado, um mediador traduz, o campo responde — e o instrumento mostra como está lendo você."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Principle, {
							index: "01",
							title: "Ação",
							text: "O ponteiro não toca o campo. Passa por um filtro de Kalman."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Principle, {
							index: "02",
							title: "Mediação",
							text: "O terceiro atrasa, gira ou recusa. Sem ele não há relação."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Principle, {
							index: "03",
							title: "Ressonância",
							text: "Alinhamento de fase. Não existe acerto, placar ou desenlace."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onEnter,
						className: "min-h-11 bg-bone px-6 text-sm text-ink hover:bg-mediate",
						children: "Sintonizar"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-mute",
						children: "O som abre com o gesto. Sem vitória, sem falha — profundidade, fase, homeodinâmica."
					})]
				})
			]
		})]
	});
}
function Hub({ hud, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col bg-ink text-bone",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-baseline justify-between gap-4 px-5 py-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-serif text-2xl",
				children: "CyberSimpatia"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: hud && hud.sessions > 0 ? `profundidade ${hud.depth.toFixed(2)} · ${hud.sessions} sessões neste aparelho` : "nenhuma sessão gravada ainda"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-2 px-5 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pb-4 text-xs tracking-widest text-mute uppercase",
					children: "Atlas dos circuitos"
				}),
				CIRCUITS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onOpen(item.id),
					className: "flex min-h-11 items-baseline gap-4 border-t border-line py-4 text-left hover:bg-panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-10 font-serif text-xl text-mute",
						children: item.index
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex min-w-0 flex-col gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-serif text-2xl",
							children: item.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-mute",
							children: item.line
						})]
					})]
				}, item.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onOpen("observer"),
					className: "flex min-h-11 items-baseline gap-4 border-t border-b border-line py-4 text-left hover:bg-panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-10 font-serif text-xl text-mediate",
						children: "—"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex min-w-0 flex-col gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-serif text-2xl",
							children: "Observador"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-mute",
							children: "O terceiro. Não joga: lê como os circuitos se mediram."
						})]
					})]
				})
			]
		})]
	});
}
function Panel({ hud, onDelay, onPng, onJson }) {
	const flow = hud?.lexicon.flow ?? 0;
	const tension = hud?.lexicon.tension ?? 0;
	const mediation = hud?.lexicon.mediation ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriadicMeter, {
			flow,
			tension,
			mediation,
			depth: hud?.depth ?? 0
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Ressonância",
				value: (hud?.resonance ?? 0).toFixed(2)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Fase",
				value: (hud?.phaseOffset ?? 0).toFixed(2)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Tensão",
				value: (hud?.tension ?? 0).toFixed(2)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Harmonia",
				value: (hud?.harmony ?? 0).toFixed(2)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
				label: "Porosidade",
				value: (hud?.porosity ?? 0).toFixed(2)
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: `text-sm ${hud?.homeodynamic ? "text-flow" : "text-mute"}`,
			children: [hud?.homeodynamic ? "homeodinâmica" : "deriva", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-mute",
				children: [" · espelho ", (hud?.mirrorRatio ?? 0).toFixed(2)]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-xs tracking-widest text-mute uppercase",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Atraso triádico" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [(hud?.mirrorDelay ?? 1.1).toFixed(2), "s"] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "range",
				min: .5,
				max: 2,
				step: .05,
				value: hud?.mirrorDelay ?? 1.1,
				"aria-label": "Atraso do espelho",
				onChange: (event) => onDelay(Number(event.target.value)),
				className: "h-11 w-full accent-flow"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pb-2 text-xs tracking-widest text-mute uppercase",
				children: "Segunda ordem"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TracePlot, { trace: hud?.trace }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "flex justify-between pt-1 text-xs text-mute",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "gesto" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-bone",
						children: "filtro"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-mediate",
						children: "espelho"
					})
				]
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-widest text-mute uppercase",
					children: "Léxico"
				}),
				LEXICON.map((symbol) => {
					const clarity = symbol.id === "flow" ? flow : symbol.id === "tension" ? tension : mediation;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm",
									children: symbol.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-mute",
									children: clarity.toFixed(2)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-px bg-line",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `h-px ${symbol.id === "tension" ? "bg-tension" : symbol.id === "mediation" ? "bg-mediate" : "bg-flow"}`,
									style: { width: `${Math.round(clarity * 100)}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs leading-relaxed text-mute",
								children: symbol.reads
							})
						]
					}, symbol.id);
				}),
				hud?.unlock && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-mediate",
					children: [
						"sinal · ",
						lexiconName(hud.unlock.id),
						" · clareza ",
						hud.unlock.clarity.toFixed(2)
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "pb-2 text-xs tracking-widest text-mute uppercase",
			children: "Episódios"
		}), hud && hud.events.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex flex-col gap-1 text-sm",
			children: hud.events.map((event, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex justify-between gap-3 text-mute",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: moduleLabel(event.module) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [event.duration.toFixed(1), "s"] })]
			}, `${event.module}-${index}`))
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-mute",
			children: "Nenhum episódio de homeodinâmica ainda."
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm leading-relaxed text-mute",
			children: hud?.reading
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onPng,
				className: "inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-line text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "PNG"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: onJson,
				className: "inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-line text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Braces, { className: "size-4" }), "JSON"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-mute",
			children: "Teclas 1 2 3 4 · M espelho"
		})
	] });
}
function RailButton({ active, label, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		"aria-label": label,
		"aria-pressed": active,
		className: `flex h-16 items-center justify-center border-b border-line ${active ? "text-bone" : "text-mute hover:text-bone"}`,
		children
	});
}
function Principle({ index, title, text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex flex-col gap-2 border border-line p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-mute",
				children: index
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-serif text-xl",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm leading-relaxed text-mute",
				children: text
			})
		]
	});
}
function Metric({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-baseline justify-between gap-3 border-b border-line py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs tracking-widest text-mute uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "font-serif text-xl",
			children: value
		})]
	});
}
function TriadicMeter({ flow, tension, mediation, depth }) {
	const arcs = [
		{
			value: flow,
			color: "var(--color-flow)",
			r: 68
		},
		{
			value: tension,
			color: "var(--color-tension)",
			r: 54
		},
		{
			value: mediation,
			color: "var(--color-mediate)",
			r: 40
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 180 180",
		className: "mx-auto w-44",
		role: "img",
		"aria-label": `Profundidade ${depth.toFixed(2)}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "90",
				cy: "90",
				r: "76",
				fill: "none",
				stroke: "var(--color-line)",
				strokeWidth: "1"
			}),
			arcs.map((arc) => {
				const circ = 2 * Math.PI * arc.r;
				const dash = Math.max(1, circ * (.06 + arc.value * .88));
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "90",
					cy: "90",
					r: arc.r,
					fill: "none",
					stroke: arc.color,
					strokeWidth: "3",
					strokeDasharray: `${dash} ${circ}`,
					transform: "rotate(-90 90 90)"
				}, arc.r);
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: "90",
				y: "84",
				textAnchor: "middle",
				fill: "var(--color-mute)",
				fontSize: "8",
				fontFamily: "IBM Plex Mono, monospace",
				children: "PROFUNDIDADE"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: "90",
				y: "108",
				textAnchor: "middle",
				fill: "var(--color-bone)",
				fontSize: "22",
				fontFamily: "Fraunces, Palatino, serif",
				children: depth.toFixed(2)
			})
		]
	});
}
function TracePlot({ trace }) {
	if (!trace || trace.raw.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16 border border-line" });
	const w = 280;
	const h = 64;
	const line = (series) => series.map((value, index) => {
		const x = index / (series.length - 1) * w;
		const y = (1 - value) * 56 + 4;
		return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: `0 0 ${w} ${h}`,
		className: "h-16 w-full border border-line",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: line(trace.raw),
				stroke: "var(--color-mute)",
				fill: "none",
				strokeWidth: "1"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: line(trace.filtered),
				stroke: "var(--color-bone)",
				fill: "none",
				strokeWidth: "1.4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: line(trace.mirror),
				stroke: "var(--color-mediate)",
				fill: "none",
				strokeWidth: "1.4"
			})
		]
	});
}
function lexiconName(id) {
	return LEXICON.find((symbol) => symbol.id === id)?.name ?? id;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CyberSimpatia, {});
}
//#endregion
export { Home as component };
