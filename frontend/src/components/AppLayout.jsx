import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

/**
 * AppLayout wraps every authenticated page with the Sidebar + Navbar shell.
 * It owns the mobile sidebar open/close state so Navbar's hamburger button
 * and Sidebar's overlay/link-click can both control it.
 */
export default function AppLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Navbar title={title} onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}