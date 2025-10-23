import { useState } from "react";

export const ModeTabs = () => {
  const [activeMode, setActiveMode] = useState<"nodes" | "keyframes">("nodes");

  return (
    <div className="flex items-center justify-center gap-0 p-0 bg-transparent rounded-lg w-fit mx-auto">
      <button
        onClick={() => setActiveMode("nodes")}
        className={`px-8 py-2 text-xs font-medium transition-all ${
          activeMode === "nodes"
            ? "bg-foreground text-background"
            : "bg-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        Nodes
      </button>
      <button
        onClick={() => setActiveMode("keyframes")}
        className={`px-8 py-2 text-xs font-medium transition-all ${
          activeMode === "keyframes"
            ? "bg-foreground text-background"
            : "bg-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        Keyframes
      </button>
    </div>
  );
};
