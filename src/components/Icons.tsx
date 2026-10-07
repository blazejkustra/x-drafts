// Small inline icon set (stroke icons, 20px grid)
type P = { size?: number }
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconSmile = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.6} /></svg>
)
export const IconCopy = ({ size }: P) => (
  <svg {...base(size)}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
)
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const IconX = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconUp = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
)
export const IconDown = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
)
export const IconSplit = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 6h16M4 12h10M4 18h7" /><path d="M17 15l3 3-3 3" /></svg>
)
export const IconSend = ({ size }: P) => (
  <svg {...base(size)}><path d="M7 17L17 7M8 7h9v9" /></svg>
)
export const IconTrash = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
)
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
)
export const IconBack = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IconSun = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IconMoon = ({ size }: P) => (
  <svg {...base(size)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
)
export const IconMonitor = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
)
export const IconDownload = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
)
export const IconUpload = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></svg>
)
export const IconCircleCheck = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 10" /></svg>
)
export const XLogo = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)
export const IconImage = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></svg>
)
