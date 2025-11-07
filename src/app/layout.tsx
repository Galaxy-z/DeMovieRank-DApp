import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "./components/NavBar";
import { ViewportHeightSetter } from "@/app/components/ViewportHeightSetter";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {/* 动态设置 --vh，解决移动端地址栏伸缩导致的 100vh 偏差 */}
          <ViewportHeightSetter />
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
