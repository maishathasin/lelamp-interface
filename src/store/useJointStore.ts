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

export interface NodeState {
  id: string;
  type: "joint" | "transition";
  joints?: JointParameter[];
  transition?: TransitionOptions;
}

interface JointStore {
  jointValues: JointValues;
  availableJoints: string[];
  nodeStates: Record<string, NodeState>;
  isAnimating: boolean;
  activeNodeId: string | null;
  setJointValue: (name: string, value: number) => void;
  setJointValues: (values: JointValues) => void;
  setAvailableJoints: (joints: string[]) => void;
  setNodeState: (nodeId: string, state: NodeState) => void;
  getNodeState: (nodeId: string) => NodeState | undefined;
  updateNodeJoints: (nodeId: string, joints: JointParameter[]) => void;
  updateNodeTransition: (nodeId: string, transition: TransitionOptions) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setActiveNodeId: (nodeId: string | null) => void;
}

export const useJointStore = create<JointStore>((set, get) => ({
  jointValues: {},
  availableJoints: [],
  nodeStates: {},
  isAnimating: false,
  activeNodeId: null,
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
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setActiveNodeId: (nodeId) => set({ activeNodeId: nodeId }),
}));