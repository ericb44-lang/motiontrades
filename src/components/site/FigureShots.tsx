// Eric's own figure photography (Mass Motion). Files live in public/brand/shots.
export interface Shot {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const SHOTS = {
  railing: {
    src: "/brand/shots/railing.jpg",
    alt: "Spider-Man figure standing on a rusty railing with the Wasatch mountains behind",
    width: 720,
    height: 1209,
  },
  ocean: {
    src: "/brand/shots/ocean.jpg",
    alt: "Silver Surfer figure sitting on his board over the open ocean",
    width: 720,
    height: 1019,
  },
  lightning: {
    src: "/brand/shots/lightning.jpg",
    alt: "Speedster figure posed mid-run with red lightning effects and smoke",
    width: 720,
    height: 1293,
  },
  crouch: {
    src: "/brand/shots/crouch.jpg",
    alt: "Spider-Man figure crouched on a ledge under blue shelf lights",
    width: 338,
    height: 600,
  },
  swing: {
    src: "/brand/shots/swing.jpg",
    alt: "Spider-Man figure swinging from a wire web against a blue sky",
    width: 340,
    height: 600,
  },
  kick: {
    src: "/brand/shots/kick.jpg",
    alt: "White-haired martial artist figure held mid-kick over a wood deck",
    width: 347,
    height: 600,
  },
} satisfies Record<string, Shot>;

export const GALLERY: Shot[] = [
  SHOTS.railing,
  SHOTS.crouch,
  SHOTS.ocean,
  SHOTS.swing,
  SHOTS.lightning,
  SHOTS.kick,
];

export function ShotImage({
  shot,
  className = "",
  eager = false,
}: {
  shot: Shot;
  className?: string;
  /** Above-the-fold photos load right away. */
  eager?: boolean;
}) {
  return (
    <img
      src={shot.src}
      alt={shot.alt}
      width={shot.width}
      height={shot.height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
