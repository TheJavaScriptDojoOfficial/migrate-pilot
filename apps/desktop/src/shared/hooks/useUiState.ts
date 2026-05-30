import { create } from 'zustand';

/**
 * UI store - holds only transient UI concerns (panels open/closed,
 * preferred sidebar width, last-viewed step). Never holds domain data.
 */
interface UiStoreState {
  diffPanelOpen: boolean;
  logsPanelOpen: boolean;
  sidebarCollapsed: boolean;
}

interface UiStoreActions {
  setDiffPanelOpen: (value: boolean) => void;
  setLogsPanelOpen: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
}

export const useUiStore = create<UiStoreState & UiStoreActions>((set) => ({
  diffPanelOpen: false,
  logsPanelOpen: true,
  sidebarCollapsed: false,
  setDiffPanelOpen: (diffPanelOpen) => set({ diffPanelOpen }),
  setLogsPanelOpen: (logsPanelOpen) => set({ logsPanelOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
