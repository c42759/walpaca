import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { AppShell } from "../components/layout/AppShell";

const poppins = localFont({
    src: [
        { path: "../public/fonts/poppins/poppins-300.woff2", weight: "300", style: "normal" },
        { path: "../public/fonts/poppins/poppins-400.woff2", weight: "400", style: "normal" },
        { path: "../public/fonts/poppins/poppins-500.woff2", weight: "500", style: "normal" },
        { path: "../public/fonts/poppins/poppins-600.woff2", weight: "600", style: "normal" },
        { path: "../public/fonts/poppins/poppins-700.woff2", weight: "700", style: "normal" },
        { path: "../public/fonts/poppins/poppins-800.woff2", weight: "800", style: "normal" },
        { path: "../public/fonts/poppins/poppins-900.woff2", weight: "900", style: "normal" },
    ],
    variable: "--font-poppins",
    display: "swap",
});

const robotoMono = localFont({
    src: [
        { path: "../public/fonts/roboto-mono/roboto-mono-400.woff2", weight: "400", style: "normal" },
        { path: "../public/fonts/roboto-mono/roboto-mono-500.woff2", weight: "500", style: "normal" },
        { path: "../public/fonts/roboto-mono/roboto-mono-600.woff2", weight: "600", style: "normal" },
        { path: "../public/fonts/roboto-mono/roboto-mono-700.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-roboto-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Walpaca",
    description: "Walpaca Client & AI Workspace",
    manifest: "/manifest.json",
    icons: {
        icon: [{ url: "/icon-app.svg", type: "image/svg+xml" }],
        apple: [{ url: "/icon-app.svg", type: "image/svg+xml" }],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Walpaca",
    },
};

export const viewport: Viewport = {
    themeColor: "#7678ed",
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${robotoMono.variable} font-sans h-full`}>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              (function() {
                try {
                  var mode = localStorage.getItem('walpaca_theme_mode') || 'system';
                  var isDark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
                    }}
                />
            </head>
            <body className="h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] w-full flex flex-col antialiased overflow-hidden">
                <AppShell>{children}</AppShell>
                <PWAInstallPrompt />
            </body>
        </html>
    );
}
