/** Stroke icons from the UI design (24×24 grid). Brand marks are illustrative, not official logos. */
const PATHS = {
  bridge: "M4 15V7h7v5h9v5h-7v-5H4M7 4v3m10 10v3",
  grid: "M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3Zm11 0h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3Zm-11 11h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14Zm11 0h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z",
  bag: "M5 7h14l1 14H4L5 7ZM9 8V6a3 3 0 0 1 6 0v2",
  file: "M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6m-6 4h5",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 8 3 3 5-5",
  lock: "M7 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm1 0V7a4 4 0 0 1 8 0v3m-4 5v2",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4v5l3 2",
  info: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 8v6m0-10v.2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  external: "M14 3h7v7m0-7L11 13M10 5H4v15h15v-6",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM16 16l4 4",
  refresh: "M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3",
  wallet: "M20 8H5a2 2 0 0 1 0-4h13v4m2 0v12H5a2 2 0 0 1-2-2V6m17 6h-6v4h6",
  building: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 4h1m4 0h1M9 11h1m4 0h1m-5 10v-5h4v5",
  help: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1-1.5 3m0 3v.1",
  logout: "M10 4H4v16h6m4-12 4 4-4 4m-5-4h12",
  link: "m10 8 3-3a4 4 0 0 1 6 6l-3 3m-2 2-3 3a4 4 0 0 1-6-6l3-3m1 5 6-6",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20",
  box: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8m-9 5v10M7 5.8l9 5",
  cloud: "M7 18a5 5 0 1 1 .4-10 6 6 0 0 1 11.5 1A4.5 4.5 0 0 1 18 18H7Z",
  ali: "M4 6h16M12 3v7M6 10h12c-2 5-5 9-11 10-4 0-5-4-1-5 4-1 8 2 15 5",
} as const;

const WECHAT_GLYPH =
  "M10 3C5 3 1.5 6 1.5 9.8c0 2.2 1.2 4.1 3.3 5.4l-.7 2.5 2.9-1.4c.8.2 1.7.3 2.6.3-.2-.6-.3-1.2-.3-1.9 0-3.9 3.6-7 8-7 .3 0 .7 0 1 .1C17.6 5 14.2 3 10 3Zm-3 5.2a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM17.4 9c-3.7 0-6.6 2.4-6.6 5.5s2.9 5.5 6.6 5.5c.7 0 1.5-.1 2.1-.3l2.3 1.1-.5-2c1.7-1 2.7-2.5 2.7-4.3C24 11.4 21 9 17.4 9Zm-2.2 4.4a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z";

export type IconName = keyof typeof PATHS | "wx";

export function Icon({ name, small, className }: { name: IconName; small?: boolean; className?: string }) {
  const cls = ["icon", small && "small", className].filter(Boolean).join(" ");
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "wx" ? <path fill="currentColor" stroke="none" d={WECHAT_GLYPH} /> : <path d={PATHS[name]} strokeWidth={name === "ali" ? 2.1 : undefined} />}
    </svg>
  );
}
