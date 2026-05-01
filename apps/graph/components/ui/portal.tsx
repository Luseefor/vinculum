"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

export const Portal = ({ children, containerId = "portal-root" }: PortalProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (!document.getElementById(containerId)) {
      const portalRoot = document.createElement("div");
      portalRoot.id = containerId;
      document.body.appendChild(portalRoot);
    }
  }, [containerId]);

  if (!mounted) return null;

  const target = document.getElementById(containerId);
  return target ? createPortal(children, target) : null;
};
