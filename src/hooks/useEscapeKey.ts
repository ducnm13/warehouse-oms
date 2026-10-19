import { useEffect } from "react";

export const useEscapeKey = (
  isOpen: boolean,
  onClose: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled || !isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, enabled]);
};

export const useMultiEscapeKey = (
  layers: Array<{ isOpen: boolean; onClose: () => void; priority?: number }>,
) => {
  useEffect(() => {
    const openLayers = layers.filter((l) => l.isOpen);
    if (openLayers.length === 0) return;

    openLayers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const topLayer = openLayers[0];

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        topLayer.onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [layers]);
};