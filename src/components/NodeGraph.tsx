import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "reactflow";
import "reactflow/dist/style.css";
import { NodeCard } from "./nodes/NodeCard";
import { Button } from "@/components/ui/button";
import { Plus, Play, Square, X } from "lucide-react";
import { useJointStore, type JointParameter, type TransitionOptions } from "@/store/useJointStore";
import { toast } from "sonner";

const nodeTypes = {
  customNode: (props: any) => <NodeCard {...props} id={props.id} />,
};

// Custom edge component with delete button
const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="group"
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full bg-red-500/20 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              data?.onDelete?.(id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

interface NodeData {
  type: "joint" | "transition";
  joints?: JointParameter[];
  transition?: TransitionOptions;
  onJointChange?: (jointName: string, value: number) => void;
  jointValues?: Record<string, number>;
  selectedJoint?: string | null;
  isFocused?: boolean;
  onDelete?: () => void;
}

interface NodeGraphProps {
  selectedJoint?: string | null;
  onJointChange?: (jointName: string, value: number) => void;
  jointValues?: Record<string, number>;
  onSelectJoint?: (jointName: string | null) => void;
  availableJoints?: string[];
}

const initialNodes: Node<NodeData>[] = [];

const initialEdges: Edge[] = [];

export const NodeGraph = ({ selectedJoint, onJointChange, jointValues, onSelectJoint, availableJoints }: NodeGraphProps = {}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  // Subscribe to store for live joint values
  const storeJointValues = useJointStore((s) => s.jointValues);
  const availableJointsStore = useJointStore((s) => s.availableJoints);
  const setStoreJointValues = useJointStore((s) => s.setJointValues);
  const getNodeState = useJointStore((s) => s.getNodeState);
  const setNodeState = useJointStore((s) => s.setNodeState);
  const isAnimating = useJointStore((s) => s.isAnimating);
  const setIsAnimating = useJointStore((s) => s.setIsAnimating);
  const setActiveNodeId = useJointStore((s) => s.setActiveNodeId);
  const [animationAbortController, setAnimationAbortController] = useState<AbortController | null>(null);

  // Delete node callback
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (focusedNodeId === nodeId) {
      setFocusedNodeId(null);
    }
  }, [setNodes, setEdges, focusedNodeId]);

  // Update all nodes with callbacks
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onJointChange,
          onDelete: () => handleDeleteNode(node.id),
        },
      }))
    );
  }, [onJointChange, handleDeleteNode, setNodes]);

  // Only sync store values to focused node (for live feedback from 3D dragging)
  // Do NOT sync during animation
  useEffect(() => {
    if (!focusedNodeId || isAnimating) return;
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          jointValues: node.id === focusedNodeId ? storeJointValues : node.data.jointValues,
        },
      }))
    );
  }, [storeJointValues, focusedNodeId, setNodes, isAnimating]);

  // Sync selected joint into nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selectedJoint,
          isFocused: node.id === focusedNodeId,
        },
      }))
    );
  }, [selectedJoint, focusedNodeId, setNodes]);

  // Initialize node states in store and seed empty joint nodes
  useEffect(() => {
    if (!availableJointsStore || availableJointsStore.length === 0) return;

    nodes.forEach((node) => {
      const existingState = getNodeState(node.id);
      if (!existingState && (node.data as any)?.type === 'joint') {
        const joints = availableJointsStore.map((name) => ({
          name,
          value: typeof storeJointValues[name] === 'number' ? storeJointValues[name] : 0,
        }));
        setNodeState(node.id, {
          id: node.id,
          type: 'joint',
          joints,
        });
      } else if (!existingState && (node.data as any)?.type === 'transition') {
        setNodeState(node.id, {
          id: node.id,
          type: 'transition',
          transition: (node.data as any).transition,
        });
      }
    });
  }, [availableJointsStore, storeJointValues, nodes, getNodeState, setNodeState]);

  // Sync node data from store
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const nodeState = getNodeState(node.id);
        if (nodeState) {
          return {
            ...node,
            data: {
              ...node.data,
              joints: nodeState.joints,
              transition: nodeState.transition,
            },
          };
        }
        return node;
      })
    );
  }, [getNodeState, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'custom' }, eds)),
    [setEdges]
  );

  const onDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
      toast.success("Connection removed");
    },
    [setEdges]
  );

  // Add onDelete prop to all edges
  const edgesWithDelete = edges.map(edge => ({
    ...edge,
    data: { ...edge.data, onDelete: onDeleteEdge }
  }));

  const handleNodeChange = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
              onJointChange, // Pass the callback down to NodeCard
            },
          };
        }
        return node;
      })
    );
  }, [setNodes, onJointChange]);

  const addNode = useCallback((type: "joint" | "transition", position?: { x: number; y: number }) => {
    // Check if URDF is loaded by checking if there are available joints
    if (!availableJointsStore || availableJointsStore.length === 0) {
      toast.error("Please upload a URDF file first");
      return;
    }

    const timestamp = Date.now();
    const seededJoints: JointParameter[] = (availableJointsStore || []).map((name) => ({
      name,
      value: typeof storeJointValues[name] === 'number' ? (storeJointValues as any)[name] : 0,
    }));

    // Use provided position or fallback to mouse position or default
    const nodePosition = position || mousePosition || { x: 300, y: 200 };

    const newNode: Node<NodeData> = {
      id: `node-${timestamp}`,
      type: "customNode",
      position: nodePosition,
      data:
        type === "joint"
          ? {
            type: "joint",
            joints: seededJoints,
            onJointChange,
          }
          : {
            type: "transition",
            transition: {
              smooth: true,
              smoothness: 50,
            },
          },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, onJointChange, availableJointsStore, storeJointValues, mousePosition]);

  const runAnimation = useCallback(async () => {
    if (isAnimating) return;

    // Find starting node (no incoming edges)
    const startNodes = nodes.filter(
      (node) => !edges.some((edge) => edge.target === node.id)
    );

    if (startNodes.length === 0) {
      toast.error("No starting node found. Add a node without incoming connections.");
      return;
    }

    const abortController = new AbortController();
    setAnimationAbortController(abortController);
    setIsAnimating(true);

    try {
      let currentNodeId = startNodes[0].id;
      let previousJointPose: Record<string, number> | null = null;
      let skipNextJointApplication = false;

      while (currentNodeId && !abortController.signal.aborted) {
        setActiveNodeId(currentNodeId);
        const currentNode = nodes.find((n) => n.id === currentNodeId);
        const nodeState = getNodeState(currentNodeId);

        if (!currentNode || !nodeState) break;

        if (nodeState.type === "joint" && nodeState.joints) {
          // Build current joint pose
          const pose = Object.fromEntries(
            nodeState.joints.map((j) => [j.name, j.value])
          );

          // Only apply if we didn't just complete a smooth transition to this pose
          if (!skipNextJointApplication) {
            setStoreJointValues(pose);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            // Reset the flag
            skipNextJointApplication = false;
            // Still show this node briefly
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          previousJointPose = pose;
        } else if (nodeState.type === "transition" && nodeState.transition) {
          const trans = nodeState.transition;

          // Find the next joint node to transition TO
          const nextEdge = edges.find((edge) => edge.source === currentNodeId);
          let nextJointPose: Record<string, number> | null = null;

          if (nextEdge) {
            const nextNodeState = getNodeState(nextEdge.target);
            if (nextNodeState?.type === "joint" && nextNodeState.joints) {
              nextJointPose = Object.fromEntries(
                nextNodeState.joints.map((j) => [j.name, j.value])
              );
            }
          }

          if (trans.smooth && previousJointPose && nextJointPose) {
            // Smooth interpolation from previous joint to next joint
            // smoothness controls speed: 0 = slowest (5s), 100 = fastest (0.5s)
            const minDuration = 500; // 0.5 seconds
            const maxDuration = 5000; // 5 seconds
            const durationMs = maxDuration - (trans.smoothness / 100) * (maxDuration - minDuration);

            const frameRate = 60; // 60 fps
            const frameTime = 1000 / frameRate;
            const totalFrames = Math.floor(durationMs / frameTime);

            // Get all joint names
            const allJointNames = new Set([
              ...Object.keys(previousJointPose),
              ...Object.keys(nextJointPose)
            ]);

            // Interpolate frame by frame
            for (let frame = 0; frame <= totalFrames && !abortController.signal.aborted; frame++) {
              const t = frame / totalFrames;

              // Apply easing for smoother motion
              const easedT = t < 0.5
                ? 2 * t * t
                : 1 - Math.pow(-2 * t + 2, 2) / 2;

              const interpolatedPose: Record<string, number> = {};
              allJointNames.forEach((jointName) => {
                const startValue = previousJointPose![jointName] ?? 0;
                const endValue = nextJointPose![jointName] ?? 0;
                interpolatedPose[jointName] = startValue + (endValue - startValue) * easedT;
              });

              setStoreJointValues(interpolatedPose);
              await new Promise((resolve) => setTimeout(resolve, frameTime));
            }

            // Since we just smoothly transitioned to the next joint pose,
            // skip applying it again when we process the next joint node
            skipNextJointApplication = true;
          } else {
            // No smooth transition, just a brief pause
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        // Find next node in the sequence
        const nextEdge = edges.find((edge) => edge.source === currentNodeId);
        currentNodeId = nextEdge ? nextEdge.target : "";
      }
    } catch (error) {
      console.error("Animation error:", error);
      toast.error("Animation encountered an error");
    } finally {
      setIsAnimating(false);
      setActiveNodeId(null);
      setAnimationAbortController(null);
    }
  }, [nodes, edges, isAnimating, getNodeState, setStoreJointValues, setIsAnimating, setActiveNodeId]);

  const stopAnimation = useCallback(() => {
    if (animationAbortController) {
      animationAbortController.abort();
    }
  }, [animationAbortController]);

  return (
    <div className="flex-1 bg-background relative w-full h-full overflow-hidden">
      {/* Add Node Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs bg-card shadow-md"
          onClick={() => addNode("joint", mousePosition || undefined)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Joint
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs bg-card shadow-md"
          onClick={() => addNode("transition", mousePosition || undefined)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Transition
        </Button>
      </div>

      {/* Animation Controls */}
      <div className="absolute top-4 right-4 z-10">
        {!isAnimating ? (
          <Button
            size="sm"
            className="text-xs shadow-md"
            onClick={runAnimation}
          >
            <Play className="w-3 h-3 mr-1" />
            Run Animation
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            className="text-xs shadow-md"
            onClick={stopAnimation}
          >
            <Square className="w-3 h-3 mr-1" />
            Stop
          </Button>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edgesWithDelete}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMouseMove={(event) => {
          // Track mouse position for node placement
          const rect = event.currentTarget.getBoundingClientRect();
          setMousePosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
        }}
        onNodeClick={(_, node) => {
          const prevFocused = focusedNodeId;
          setFocusedNodeId(node.id);
          if ((node.data as any)?.type === 'joint') {
            // Get the latest joints from store
            const nodeState = getNodeState(node.id);
            const joints = nodeState?.joints || (node.data as any)?.joints as JointParameter[] | undefined;
            if (joints && joints.length > 0) {
              // Only apply pose if switching from a different node
              if (prevFocused !== node.id) {
                const pose = Object.fromEntries(joints.map((j) => [j.name, j.value])) as Record<string, number>;
                setStoreJointValues(pose);
              }
              onSelectJoint?.(joints[0].name);
            }
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-background w-full h-full"
        style={{ width: "100%", height: "100%" }}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
          style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 }
        }}
      >
        <Background color="hsl(var(--border))" gap={16} size={0.5} />
        <Controls className="!bg-card !border-border !shadow-sm" />
        <MiniMap
          className="!bg-card !border-border !shadow-sm"
          nodeColor="hsl(var(--foreground))"
          maskColor="rgba(0, 0, 0, 0.05)"
        />
      </ReactFlow>
    </div>
  );
};
