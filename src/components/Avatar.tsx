import { memberColor } from "@/lib/colors";

type Props = {
  id: string;
  name: string;
  url: string | null;
  size?: number;
  ring?: string;
  className?: string;
};

export function Avatar({ id, name, url, size = 28, ring, className = "" }: Props) {
  const style = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  };
  if (url) {
    // max-w-none: otherwise in a narrow container the image shrinks horizontally and the circle turns into an oval.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} title={name} style={style} className={`max-w-none shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      title={name}
      style={{ ...style, background: memberColor(id), fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 22,
  ring = "var(--color-ink)",
  max = 6,
}: {
  people: { id: string; name: string; avatar_url: string | null }[];
  size?: number;
  ring?: string;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id} id={p.id} name={p.name} url={p.avatar_url} size={size} ring={ring} className={`anim-pop ${i ? "-ml-1.5" : ""}`} />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}`, fontSize: size * 0.4 }}
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-[#2a2a30] text-dim"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
