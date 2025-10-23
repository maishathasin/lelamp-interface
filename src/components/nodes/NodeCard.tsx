import { Handle, Position } from "reactflow";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useJointStore, type JointParameter, type TransitionOptions } from "@/store/useJointStore";
import { X } from "lucide-react";

interface NodeCardProps {
  id: string;
  data: {
    type: "joint" | "transition";
    joints?: JointParameter[];
    transition?: TransitionOptions;
    onJointChange?: (jointName: string, value: number) => void;
    jointValues?: Record<string, number>;
    selectedJoint?: string | null;
    isFocused?: boolean;
    onDelete?: () => void;
  };
}

const WaveVisualization = ({ smoothness }: { smoothness: number }) => {
  const points = 50;
  const amplitude = 20 * (1 - smoothness / 100);
  const frequency = 3;
  
  const pathData = Array.from({ length: points }, (_, i) => {
    const x = (i / (points - 1)) * 100;
    const y = 50 + Math.sin((i / points) * Math.PI * 2 * frequency) * amplitude;
    return `${x},${y}`;
  }).join(" L ");

  return (
    <svg viewBox="0 0 100 100" className="w-full h-12 opacity-40">
      <polyline
        points={`0,50 L ${pathData}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-foreground"
      />
    </svg>
  );
};

export const NodeCard = ({ id, data }: NodeCardProps) => {
  const setJointValueStore = useJointStore((s) => s.setJointValue);
  const updateNodeJoints = useJointStore((s) => s.updateNodeJoints);
  const updateNodeTransition = useJointStore((s) => s.updateNodeTransition);
  const getNodeState = useJointStore((s) => s.getNodeState);
  const setNodeState = useJointStore((s) => s.setNodeState);
  const activeNodeId = useJointStore((s) => s.activeNodeId);
  const isAnimating = useJointStore((s) => s.isAnimating);
  const isActive = activeNodeId === id;

  // Initialize node state in store if not present
  useEffect(() => {
    const existingState = getNodeState(id);
    if (!existingState) {
      setNodeState(id, {
        id,
        type: data.type,
        joints: data.joints || [],
        transition: data.transition || {
          smooth: true,
          smoothness: 50,
        },
      });
    }
  }, [id, data.type, data.joints, data.transition, getNodeState, setNodeState]);

  // Get state from store
  const nodeState = getNodeState(id);
  const localJoints = nodeState?.joints || data.joints || [];
  const localTransition = nodeState?.transition || data.transition || {
    smooth: true,
    smoothness: 50,
  };

  // Sync external joint values into store (only when focused for live URDF updates)
  // Do NOT sync during animation to preserve node values
  useEffect(() => {
    if (!localJoints.length || !data.jointValues || !data.isFocused || isAnimating) return;
    
    const updatedJoints = localJoints.map((j) => ({
      ...j,
      value: data.jointValues?.[j.name] ?? j.value,
    }));
    
    updateNodeJoints(id, updatedJoints);
  }, [data.jointValues, data.isFocused, id, localJoints, updateNodeJoints, isAnimating]);

  if (data.type === "joint") {
    return (
      <div className={`node-card min-w-[280px] max-w-[320px] relative transition-all ${data.isFocused ? 'ring-2 ring-primary/50' : ''} ${isActive ? 'ring-4 ring-primary shadow-lg shadow-primary/50 scale-105' : ''}`}>
        <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-border" />
        
        {data.onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground z-10"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        
        <div className="mb-4">
          <div className="text-xs text-muted-foreground/60 mb-3 uppercase tracking-wider">
            {localJoints.length > 0 ? "Joints" : "Joint"}
          </div>
          
          <div className="space-y-3">
            {localJoints.map((joint, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">
                    {joint.name}
                  </label>
                  <span className="text-[10px] text-muted-foreground/60">
                    {joint.value.toFixed(2)} rad
                  </span>
                </div>
                <Slider
                  value={[joint.value]}
                  onValueChange={(value) => {
                    const newJoints = [...localJoints];
                    newJoints[idx].value = value[0];
                    updateNodeJoints(id, newJoints);
                    // Update global store so Viewer3D moves immediately
                    setJointValueStore(joint.name, value[0]);
                    // Notify parent (kept for compatibility)
                    if (data.onJointChange) {
                      data.onJointChange(joint.name, value[0]);
                    }
                  }}
                  min={-3.14}
                  max={3.14}
                  step={0.01}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] text-muted-foreground/60 hover:text-foreground h-auto py-1 px-2"
          onClick={() => {
            if (localJoints.length < 6) {
              const jointNames = [
                "joint_base_yaw",
                "joint_base_pitch", 
                "joint_elbow_pitch",
                "joint_wrist_pitch",
                "joint_wrist_roll",
                "joint_head_yaw"
              ];
              const newJoints = [...localJoints, { name: jointNames[localJoints.length] || `joint_${localJoints.length}`, value: 0 }];
              updateNodeJoints(id, newJoints);
            }
          }}
        >
          Add Parameter
        </Button>

        <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-border" />
      </div>
    );
  }

  // Transition node
  return (
    <div className={`node-card min-w-[280px] max-w-[320px] relative transition-all ${data.isFocused ? 'ring-2 ring-primary/50' : ''} ${isActive ? 'ring-4 ring-primary shadow-lg shadow-primary/50 scale-105' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-border" />
      
      {data.onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground z-10"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      
      <div className="mb-4">
        <div className="text-xs text-muted-foreground/60 mb-3 uppercase tracking-wider">
          Transition
        </div>
        
        <div className="space-y-3">
          {/* Smooth transition with speed control */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={localTransition.smooth}
                onCheckedChange={(checked) =>
                  updateNodeTransition(id, { ...localTransition, smooth: checked as boolean })
                }
                className="h-3.5 w-3.5"
              />
              <label className="text-xs text-foreground/90">Smooth Transition</label>
            </div>
            {localTransition.smooth && (
              <div className="pl-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground">Speed</label>
                  <span className="text-[10px] text-muted-foreground/60">
                    {localTransition.smoothness}%
                  </span>
                </div>
                <WaveVisualization smoothness={localTransition.smoothness} />
                <Slider
                  value={[localTransition.smoothness]}
                  onValueChange={(value) =>
                    updateNodeTransition(id, { ...localTransition, smoothness: value[0] })
                  }
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-[10px] text-muted-foreground/60 hover:text-foreground h-auto py-1 px-2"
      >
        Add Parameter
      </Button>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-border" />
    </div>
  );
};
