import type { Metadata, Viewport } from "next";
import { Poppins, Roboto_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { AppShell } from "../components/layout/AppShell";

const poppins = Poppins({
    variable: "--font-poppins",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800", "900"],
    display: "swap",
});

const robotoMono = Roboto_Mono({
    variable: "--font-roboto-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
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
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${poppins.variable} ${robotoMono.variable} font-sans h-full`}>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
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
            <body className="min-h-full flex flex-col antialiased">
                <AppShell>{children}</AppShell>
                <PWAInstallPrompt />
            </body>
        </html>
    );
}
