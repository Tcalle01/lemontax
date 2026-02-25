import { C } from "../theme";

export default function Icon({ name, color, size = 20, style: extra }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, color: color || C.green, verticalAlign: "middle", lineHeight: 1, ...extra }}
    >
      {name}
    </span>
  );
}
