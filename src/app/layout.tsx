import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { RegisterServiceWorker } from "@/components/shell/RegisterServiceWorker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dompet — Personal Finance Dashboard",
    template: "%s · Dompet",
  },
  description:
    "Dashboard keuangan pribadi mobile-first: catat transaksi harian, atur anggaran bulanan, dan kejar target tabungan. Data tersimpan di perangkatmu.",
  applicationName: "Dompet",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dompet",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom stays available — never trap users who need to magnify numbers.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1230" },
  ],
};

/**
 * Applies the saved theme before first paint so there's no flash of the wrong
 * palette. It mutates `data-theme` on <html>, which is why the element below
 * carries `suppressHydrationWarning`.
 */
const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem("dompet.state.v1");var t=s?JSON.parse(s).settings.theme:null;if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"midnight":"warm";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="warm";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-theme="warm"
      suppressHydrationWarning
      className={`${jakarta.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before first paint so a Midnight user never sees a cream flash.
            `suppressHydrationWarning`: React must not reconcile a script whose
            side effect (mutating data-theme) it did not perform itself. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full font-sans">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-on-brand"
        >
          Lompat ke konten
        </a>
        <AppShell>{children}</AppShell>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
