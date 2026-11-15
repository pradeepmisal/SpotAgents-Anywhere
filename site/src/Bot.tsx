export type BotShape = "circle" | "hexagon" | "squircle" | "capsule" | "drop";
export type BotMood = "idle" | "awake" | "speaking" | "ended";

const clip: Partial<Record<BotShape, string>> = {
  hexagon: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
  drop: "polygon(50% 0, 100% 62%, 80% 100%, 20% 100%, 0 62%)",
};
const radius: Record<BotShape, string> = {
  circle: "50%",
  squircle: "32%",
  capsule: "50% / 40%",
  hexagon: "0",
  drop: "0",
};

/** A guide: the SpotAgents guide face, cut into one of the agent shapes. */
export function Bot({
  shape = "circle",
  mood = "idle",
  size = 44,
  look = 0,
}: {
  shape?: BotShape;
  mood?: BotMood;
  size?: number;
  /** -1…1: which way the guide looks. */
  look?: number;
}) {
  const awake = mood === "awake" || mood === "speaking";
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0"
      style={{ width: size, height: size * (shape === "capsule" ? 1.12 : 1) }}
    >
      <span
        className="absolute inset-0 overflow-hidden bg-[#2a2118]"
        style={{
          borderRadius: radius[shape],
          clipPath: clip[shape],
          boxShadow: awake ? "0 0 0 3px #1F8A4C" : undefined,
          filter: mood === "ended" ? "grayscale(1) opacity(.7)" : undefined,
        }}
      >
        <img
          src="/guide-face.jpg"
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={{ transform: `translateX(${look * 6}%) scale(1.08)`, transition: "transform 200ms ease-out" }}
        />
      </span>
      {mood === "speaking" && (
        <span className="absolute -bottom-1 -right-1 flex h-4 items-center gap-px rounded-full bg-accent px-1.5">
          {[0, 0.15, 0.3].map((d) => (
            <span key={d} className="loop-wave h-2.5 w-0.5 rounded-full bg-white" style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
      )}
    </span>
  );
}
