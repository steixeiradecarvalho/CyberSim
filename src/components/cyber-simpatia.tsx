import { useEffect, useRef, useState, type ReactNode } from "react";
import { Braces, Download, Eye, FlipHorizontal2, GitBranch, Hexagon, Volume2, VolumeX, Waves } from "lucide-react";
import lexiconFile from "@/lib/cybersimpatia/data/earthscore_lexicon.json";
import { Runtime, moduleLabel, type HudModel } from "@/lib/cybersimpatia/runtime";
import type { LensId, ModuleId } from "@/lib/cybersimpatia/types";

type LexiconFile = { symbols: { id: string; name: string; reads: string }[] };
const LEXICON = (lexiconFile as LexiconFile).symbols;

const CIRCUITS: { id: ModuleId; index: string; title: string; line: string; icon: typeof Waves }[] = [
  { id: "laminar_vortex", index: "01", title: "Vórtice laminar", line: "O fluido só escuta o mediador.", icon: Waves },
  { id: "rhizoma", index: "02", title: "Rizoma", line: "Quatro agentes negociam o crescimento.", icon: GitBranch },
  { id: "tensegrity_knot", index: "03", title: "Nó tensegrity", line: "Homeodinâmica, não desenlace.", icon: Hexagon },
];

const LENSES: { id: LensId; label: string }[] = [
  { id: "flow", label: "Fluxo nutricional" },
  { id: "tension", label: "Tensão SDF" },
  { id: "sync", label: "Sincronia temporal" },
];

export function CyberSimpatia() {
  const runtimeRef = useRef<Runtime | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<"gate" | "hub" | "circuit">("gate");
  const [module, setModule] = useState<ModuleId>("laminar_vortex");
  const [hud, setHud] = useState<HudModel | null>(null);
  const [lens, setLens] = useState<LensId>("flow");
  const [heard, setHeard] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const rt = runtimeRef.current;
    if (!canvas || !rt || view !== "circuit") return;
    rt.attach(canvas);
    const parent = canvas.parentElement;
    const observer = new ResizeObserver(() => rt.resize());
    if (parent) observer.observe(parent);
    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      if (event.type === "pointerdown") canvas.setPointerCapture(event.pointerId);
      rt.point((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      if (module !== "observer") setHeard(true);
    };
    canvas.addEventListener("pointerdown", onPointer, { passive: true });
    canvas.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onPointer);
    };
  }, [view, module]);

  function open(id: ModuleId) {
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

  if (view === "gate") return <Gate onEnter={sintonizar} />;
  if (view === "hub") return <Hub hud={hud} onOpen={open} />;

  const circuit = CIRCUITS.find((item) => item.id === module);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-bone">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={() => setView("hub")} className="min-h-11 shrink-0 font-serif text-lg">
          CyberSimpatia
        </button>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-mute sm:block">{hud?.reading}</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={hud?.mirror ?? false}
            onClick={() => runtimeRef.current?.toggleMirror()}
            className={`inline-flex min-h-11 items-center gap-2 border px-3 text-sm ${hud?.mirror ? "border-mediate text-mediate" : "border-line text-mute"}`}
          >
            <FlipHorizontal2 className="size-4" aria-hidden="true" />
            Espelho
          </button>
          <button
            type="button"
            onClick={() => runtimeRef.current?.toggleMute()}
            className="inline-flex size-11 items-center justify-center border border-line text-mute"
            aria-label={hud?.muted ? "Ligar áudio" : "Silenciar"}
          >
            {hud?.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      </header>
      <p className="truncate border-b border-line px-4 py-2 text-sm text-mute sm:hidden">{hud?.reading}</p>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-16 flex-col border-r border-line md:flex" aria-label="Circuitos">
          {CIRCUITS.map((item) => (
            <RailButton key={item.id} active={module === item.id} label={item.title} onClick={() => open(item.id)}>
              <item.icon className="size-5" />
            </RailButton>
          ))}
          <RailButton active={module === "observer"} label="Observador" onClick={() => open("observer")}>
            <Eye className="size-5" />
          </RailButton>
        </nav>

        <div className="relative min-w-0 flex-1 bg-ink">
          <canvas ref={canvasRef} className="h-full w-full touch-none" />
          {module === "rhizoma" && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              {LENSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLens(item.id);
                    runtimeRef.current?.setLens(item.id);
                  }}
                  className={`min-h-11 border px-3 text-xs tracking-wide ${lens === item.id ? "border-mediate bg-panel text-mediate" : "border-line bg-panel text-mute"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <p className="pointer-events-none absolute bottom-3 left-3 text-xs tracking-widest text-mute uppercase">
            {circuit?.title ?? "Observador"} · ritmo {hud?.quality ?? "pleno"}
          </p>
          {!heard && module !== "observer" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
              <div className="max-w-md border border-line bg-panel px-4 py-3">
                <p className="font-serif text-xl">Arraste sobre o campo</p>
                <p className="mt-1 text-sm leading-relaxed text-mute">
                  O quadrado é o seu gesto. O anel é o filtro. O mediador empurra o fluido depois — nunca na hora, nunca como cópia.
                </p>
              </div>
            </div>
          )}
          {module === "observer" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
              <div className="max-w-md border border-line bg-panel px-4 py-3">
                <p className="font-serif text-xl">Aqui não se arrasta</p>
                <p className="mt-1 text-sm leading-relaxed text-mute">
                  O observador só lê o que os três circuitos já mediram. Volte a 01, 02 ou 03 e arraste.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4 md:flex">
          <Panel
            hud={hud}
            onDelay={(value) => runtimeRef.current?.setDelay(value)}
            onPng={() => runtimeRef.current?.exportPng()}
            onJson={() => runtimeRef.current?.exportJson()}
          />
        </aside>
      </div>

      <div className="border-t border-line bg-panel md:hidden">
        <details>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm">Leitura</summary>
          <div className="flex max-h-64 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <Panel
              hud={hud}
              onDelay={(value) => runtimeRef.current?.setDelay(value)}
              onPng={() => runtimeRef.current?.exportPng()}
              onJson={() => runtimeRef.current?.exportJson()}
            />
          </div>
        </details>
        <div className="grid grid-cols-4 gap-2 px-3 py-3">
          {CIRCUITS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id)}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${module === item.id ? "text-bone" : "text-mute"}`}
            >
              <item.icon className="size-4" />
              {item.index}
            </button>
          ))}
          <button
            type="button"
            onClick={() => open("observer")}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${module === "observer" ? "text-bone" : "text-mute"}`}
          >
            <Eye className="size-4" />
            ler
          </button>
        </div>
      </div>
    </div>
  );
}

function Gate({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col bg-ink text-bone">
      <header className="flex items-center justify-between px-5 py-4 text-xs tracking-widest text-mute uppercase">
        <span>Lógica triádica</span>
        <span>escuta 2.0</span>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-5 pb-16">
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-widest text-flow uppercase">Ação · mediação · ressonância</p>
          <h1 className="font-serif text-5xl leading-none font-medium tracking-tight sm:text-6xl">CyberSimpatia</h1>
          <p className="max-w-xl text-base leading-relaxed text-bone">
            Um instrumento de escuta. Não um jogo. Três circuitos já se movem quando você chega — vórtice, rizoma, nó — e um
            observador que só lê.
          </p>
          <p className="max-w-xl text-base leading-relaxed text-mute">
            Você age. Um mediador filtra, atrasa, gira ou recusa. O campo responde em fase, nunca como cópia. Não há vitória: o
            uso é ver, separados, o gesto, o filtro e o terceiro. Os números descrevem essa relação. Não a julgam.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          <Principle index="01" title="Ação" text="O ponteiro não toca o campo. Passa por um filtro de Kalman." />
          <Principle index="02" title="Mediação" text="O terceiro atrasa, gira ou recusa. Sem ele não há relação." />
          <Principle index="03" title="Ressonância" text="Alinhamento de fase. Não existe acerto, placar ou desenlace." />
        </ol>
        <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
          <button type="button" onClick={onEnter} className="min-h-11 bg-bone px-6 text-sm text-ink hover:bg-mediate">
            Sintonizar
          </button>
          <p className="text-sm text-mute">Depois: escolha um circuito e arraste o dedo ou o ponteiro sobre o campo.</p>
        </div>
      </div>
    </main>
  );
}

function Hub({ hud, onOpen }: { hud: HudModel | null; onOpen: (id: ModuleId) => void }) {
  return (
    <main className="flex min-h-dvh flex-col bg-ink text-bone">
      <header className="flex items-baseline justify-between gap-4 px-5 py-4">
        <p className="font-serif text-2xl">CyberSimpatia</p>
        <p className="text-xs text-mute">
          {hud && hud.sessions > 0
            ? `profundidade ${hud.depth.toFixed(2)} · ${hud.sessions} sessões neste aparelho`
            : "nenhuma sessão gravada ainda"}
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-2 px-5 pb-16">
        <p className="pb-4 text-sm text-mute">Toque um circuito. Dentro dele, arraste. O campo escuta — não obedece.</p>
        {CIRCUITS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex min-h-11 items-baseline gap-4 border-t border-line py-4 text-left hover:bg-panel"
          >
            <span className="w-10 font-serif text-xl text-mute">{item.index}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-serif text-2xl">{item.title}</span>
              <span className="text-sm text-mute">{item.line}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpen("observer")}
          className="flex min-h-11 items-baseline gap-4 border-t border-b border-line py-4 text-left hover:bg-panel"
        >
          <span className="w-10 font-serif text-xl text-mediate">—</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-serif text-2xl">Observador</span>
            <span className="text-sm text-mute">O terceiro. Não joga: lê como os circuitos se mediram.</span>
          </span>
        </button>
      </div>
    </main>
  );
}

function Panel({
  hud,
  onDelay,
  onPng,
  onJson,
}: {
  hud: HudModel | null;
  onDelay: (value: number) => void;
  onPng: () => void;
  onJson: () => void;
}) {
  const flow = hud?.lexicon.flow ?? 0;
  const tension = hud?.lexicon.tension ?? 0;
  const mediation = hud?.lexicon.mediation ?? 0;
  return (
    <>
      <TriadicMeter flow={flow} tension={tension} mediation={mediation} depth={hud?.depth ?? 0} />
      <dl>
        <Metric label="Ressonância" value={(hud?.resonance ?? 0).toFixed(2)} />
        <Metric label="Fase" value={(hud?.phaseOffset ?? 0).toFixed(2)} />
        <Metric label="Tensão" value={(hud?.tension ?? 0).toFixed(2)} />
        <Metric label="Harmonia" value={(hud?.harmony ?? 0).toFixed(2)} />
        <Metric label="Porosidade" value={(hud?.porosity ?? 0).toFixed(2)} />
      </dl>
      <p className={`text-sm ${hud?.homeodynamic ? "text-flow" : "text-mute"}`}>
        {hud?.homeodynamic ? "homeodinâmica" : "deriva"}
        <span className="text-mute"> · espelho {(hud?.mirrorRatio ?? 0).toFixed(2)}</span>
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs tracking-widest text-mute uppercase">
          <span>Atraso triádico</span>
          <span>{(hud?.mirrorDelay ?? 1.1).toFixed(2)}s</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={hud?.mirrorDelay ?? 1.1}
          aria-label="Atraso do espelho"
          onChange={(event) => onDelay(Number(event.target.value))}
          className="h-11 w-full accent-flow"
        />
      </div>
      <div>
        <p className="pb-2 text-xs tracking-widest text-mute uppercase">Segunda ordem</p>
        <TracePlot trace={hud?.trace} />
        <p className="flex justify-between pt-1 text-xs text-mute">
          <span>gesto</span>
          <span className="text-bone">filtro</span>
          <span className="text-mediate">espelho</span>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-widest text-mute uppercase">Léxico</p>
        {LEXICON.map((symbol) => {
          const clarity = symbol.id === "flow" ? flow : symbol.id === "tension" ? tension : mediation;
          return (
            <div key={symbol.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{symbol.name}</span>
                <span className="text-xs text-mute">{clarity.toFixed(2)}</span>
              </div>
              <div className="h-px bg-line">
                <div
                  className={`h-px ${symbol.id === "tension" ? "bg-tension" : symbol.id === "mediation" ? "bg-mediate" : "bg-flow"}`}
                  style={{ width: `${Math.round(clarity * 100)}%` }}
                />
              </div>
              <p className="text-xs leading-relaxed text-mute">{symbol.reads}</p>
            </div>
          );
        })}
        {hud?.unlock && (
          <p className="text-xs text-mediate">
            sinal · {lexiconName(hud.unlock.id)} · clareza {hud.unlock.clarity.toFixed(2)}
          </p>
        )}
      </div>
      <div>
        <p className="pb-2 text-xs tracking-widest text-mute uppercase">Episódios</p>
        {hud && hud.events.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {hud.events.map((event, index) => (
              <li key={`${event.module}-${index}`} className="flex justify-between gap-3 text-mute">
                <span>{moduleLabel(event.module)}</span>
                <span>{event.duration.toFixed(1)}s</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Nenhum episódio de homeodinâmica ainda.</p>
        )}
      </div>
      <p className="text-sm leading-relaxed text-mute">{hud?.reading}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onPng} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-line text-sm">
          <Download className="size-4" />
          PNG
        </button>
        <button type="button" onClick={onJson} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-line text-sm">
          <Braces className="size-4" />
          JSON
        </button>
      </div>
      <p className="text-xs text-mute">Teclas 1 2 3 4 · M espelho</p>
    </>
  );
}

function RailButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-16 items-center justify-center border-b border-line ${active ? "text-bone" : "text-mute hover:text-bone"}`}
    >
      {children}
    </button>
  );
}

function Principle({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <li className="flex flex-col gap-2 border border-line p-4">
      <span className="text-xs text-mute">{index}</span>
      <span className="font-serif text-xl">{title}</span>
      <span className="text-sm leading-relaxed text-mute">{text}</span>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
      <dt className="text-xs tracking-widest text-mute uppercase">{label}</dt>
      <dd className="font-serif text-xl">{value}</dd>
    </div>
  );
}

function TriadicMeter({ flow, tension, mediation, depth }: { flow: number; tension: number; mediation: number; depth: number }) {
  const arcs = [
    { value: flow, color: "var(--color-flow)", r: 68 },
    { value: tension, color: "var(--color-tension)", r: 54 },
    { value: mediation, color: "var(--color-mediate)", r: 40 },
  ];
  return (
    <svg viewBox="0 0 180 180" className="mx-auto w-44" role="img" aria-label={`Profundidade ${depth.toFixed(2)}`}>
      <circle cx="90" cy="90" r="76" fill="none" stroke="var(--color-line)" strokeWidth="1" />
      {arcs.map((arc) => {
        const circ = 2 * Math.PI * arc.r;
        const dash = Math.max(1, circ * (0.06 + arc.value * 0.88));
        return (
          <circle
            key={arc.r}
            cx="90"
            cy="90"
            r={arc.r}
            fill="none"
            stroke={arc.color}
            strokeWidth="3"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 90 90)"
          />
        );
      })}
      <text x="90" y="84" textAnchor="middle" fill="var(--color-mute)" fontSize="8" fontFamily="IBM Plex Mono, monospace">
        PROFUNDIDADE
      </text>
      <text x="90" y="108" textAnchor="middle" fill="var(--color-bone)" fontSize="22" fontFamily="Fraunces, Palatino, serif">
        {depth.toFixed(2)}
      </text>
    </svg>
  );
}

function TracePlot({ trace }: { trace: HudModel["trace"] | undefined }) {
  if (!trace || trace.raw.length < 2) {
    return <div className="h-16 border border-line" />;
  }
  const w = 280;
  const h = 64;
  const line = (series: number[]) =>
    series
      .map((value, index) => {
        const x = (index / (series.length - 1)) * w;
        const y = (1 - value) * (h - 8) + 4;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full border border-line" aria-hidden="true">
      <path d={line(trace.raw)} stroke="var(--color-mute)" fill="none" strokeWidth="1" />
      <path d={line(trace.filtered)} stroke="var(--color-bone)" fill="none" strokeWidth="1.4" />
      <path d={line(trace.mirror)} stroke="var(--color-mediate)" fill="none" strokeWidth="1.4" />
    </svg>
  );
}

function lexiconName(id: string): string {
  return LEXICON.find((symbol) => symbol.id === id)?.name ?? id;
}
