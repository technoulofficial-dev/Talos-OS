"use client";

import { Cpu, Database, Zap } from "lucide-react";

export function StatusBar() {
  return (
    <footer className="border-t border-linear-border-subtle bg-linear-bg-elevated px-6 py-2 flex items-center justify-between font-mono text-xs">
      <div className="flex items-center gap-6 text-linear-text-tertiary">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3" />
          <span>CPU: 23%</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-3 h-3" />
          <span>MEM: 4.2GB / 16GB</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-linear-accent" />
          <span>TOKENS: 12,847 / 1,000,000</span>
        </div>
      </div>
      <div className="text-linear-text-disabled">
        PORT 8642
      </div>
    </footer>
  );
}