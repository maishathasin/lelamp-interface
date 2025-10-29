import { create } from "zustand";

export type JointValues = Record<string, number>;

export interface JointParameter {
  name: string;
  value: number;
}

export interface TransitionOptions {
  smooth: boolean;
  smoothness: number; // Controls FPS and transition speed (0-100)
}

export interface LEDOptions {
  color: string; // Hex color code
  brightness: number; // 0-100
}

export interface NodeState {
  id: string;
  type: "joint" | "transition" | "led" | "parallel";
  joints?: JointParameter[];
  transition?: TransitionOptions;
  led?: LEDOptions;
}

interface JointStore {
  jointValues: JointValues;
  availableJoints: string[];
  nodeStates: Record<string, NodeState>;
  isAnimating: boolean;
  activeNodeIds: string[];
  currentLEDState: LEDOptions | null;
  setJointValue: (name: string, value: number) => void;
  setJointValues: (values: JointValues) => void;
  setAvailableJoints: (joints: string[]) => void;
  setNodeState: (nodeId: string, state: NodeState) => void;
  getNodeState: (nodeId: string) => NodeState | undefined;
  updateNodeJoints: (nodeId: string, joints: JointParameter[]) => void;
  updateNodeTransition: (nodeId: string, transition: TransitionOptions) => void;
  updateNodeLED: (nodeId: string, led: LEDOptions) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setActiveNodeIds: (nodeIds: string[]) => void;
  addActiveNodeId: (nodeId: string) => void;
  removeActiveNodeId: (nodeId: string) => void;
  clearActiveNodeIds: () => void;
  setCurrentLEDState: (led: LEDOptions | null) => void;
}

export const useJointStore = create<JointStore>((set, get) => ({
  jointValues: {},
  availableJoints: [],
  nodeStates: {},
  isAnimating: false,
  activeNodeIds: [],
  currentLEDState: null,
  setJointValue: (name, value) =>
    set((state) => ({
      jointValues: { ...state.jointValues, [name]: value },
    })),
  setJointValues: (values) => set({ jointValues: { ...values } }),
  setAvailableJoints: (joints) => set({ availableJoints: [...joints] }),
  setNodeState: (nodeId, state) =>
    set((s) => ({
      nodeStates: { ...s.nodeStates, [nodeId]: state },
    })),
  getNodeState: (nodeId) => get().nodeStates[nodeId],
  updateNodeJoints: (nodeId, joints) =>
    set((s) => {
      const existing = s.nodeStates[nodeId];
      if (!existing) return s;
      return {
        nodeStates: {
          ...s.nodeStates,
          [nodeId]: { ...existing, joints },
        },
      };
    }),
  updateNodeTransition: (nodeId, transition) =>
    set((s) => {
      const existing = s.nodeStates[nodeId];
      if (!existing) return s;
      return {
        nodeStates: {
          ...s.nodeStates,
          [nodeId]: { ...existing, transition },
        },
      };
    }),
  updateNodeLED: (nodeId, led) =>
    set((s) => {
      const existing = s.nodeStates[nodeId];
      if (!existing) return s;
      return {
        nodeStates: {
          ...s.nodeStates,
          [nodeId]: { ...existing, led },
        },
      };
    }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setActiveNodeIds: (nodeIds) => set({ activeNodeIds: nodeIds }),
  addActiveNodeId: (nodeId) => set((s) => ({ 
    activeNodeIds: s.activeNodeIds.includes(nodeId) ? s.activeNodeIds : [...s.activeNodeIds, nodeId] 
  })),
  removeActiveNodeId: (nodeId) => set((s) => ({ 
    activeNodeIds: s.activeNodeIds.filter(id => id !== nodeId) 
  })),
  clearActiveNodeIds: () => set({ activeNodeIds: [] }),
  setCurrentLEDState: (led) => set({ currentLEDState: led }),
}));