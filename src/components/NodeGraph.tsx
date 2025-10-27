import { useCallback, useEffect, useState, useRef } from "react";
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
import { Plus, Play, Square, X, Download, Sparkles } from "lucide-react";
import { useJointStore, type JointParameter, type TransitionOptions } from "@/store/useJointStore";
import { toast } from "sonner";
import { neocortexAPI } from "@/lib/neocortex";
import { AIChatDialog } from "./AIChatDialog";

interface RecordedFrame {
  timestamp: number;
  jointPositions: Record<string, number>;
}

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
  initialCsvNodes?: Node[];
  initialCsvEdges?: Edge[];
}

const initialNodes: Node<NodeData>[] = [];

const initialEdges: Edge[] = [];

export const NodeGraph = ({ selectedJoint, onJointChange, jointValues, onSelectJoint, availableJoints, initialCsvNodes = [], initialCsvEdges = [] }: NodeGraphProps = {}) => {
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

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<RecordedFrame[]>([]);
  const recordingStartTime = useRef<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);

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

  // Load CSV nodes when they're provided
  useEffect(() => {
    if (initialCsvNodes.length > 0) {
      setNodes(initialCsvNodes);
      setEdges(initialCsvEdges);
    }
  }, [initialCsvNodes, initialCsvEdges, setNodes, setEdges]);

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
        // Use existing joints from node data if available, otherwise seed from store
        const existingJoints = (node.data as any)?.joints;
        const joints = existingJoints && existingJoints.length > 0
          ? existingJoints
          : availableJointsStore.map((name) => ({
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

  // Recording functions
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedFrames([]);
    recordingStartTime.current = Date.now();

    // Record at 50Hz (every 20ms)
    recordingIntervalRef.current = window.setInterval(() => {
      const timestamp = Date.now() - recordingStartTime.current;
      // Get fresh joint values from store each time (not from closure)
      const currentJointValues = useJointStore.getState().jointValues;
      setRecordedFrames(prev => [...prev, {
        timestamp,
        jointPositions: { ...currentJointValues }
      }]);
    }, 20);

    toast.success('Started recording animation');
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    toast.success(`Stopped recording. Captured ${recordedFrames.length} frames`);
  }, [recordedFrames.length]);

  const exportToCSV = useCallback(() => {
    if (recordedFrames.length === 0) {
      toast.error('No recorded data to export');
      return;
    }

    // For 5 DOF lamp, we expect joints: 1, 2, 3, 4, 5
    const lampJoints = ['1', '2', '3', '4', '5'];

    // Build CSV header: timestamp, joint1, joint2, joint3, joint4, joint5
    const headers = ['timestamp', ...lampJoints.map(j => `joint${j}`)];
    const csvRows = [headers.join(',')];

    // Add data rows
    for (const frame of recordedFrames) {
      const row = [
        frame.timestamp,
        ...lampJoints.map(j => frame.jointPositions[j] ?? 0)
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lamp_animation_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported CSV with ${recordedFrames.length} frames`);
  }, [recordedFrames]);

  // Cleanup recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Neocortex AI Integration
  const [isLoadingNeocortex, setIsLoadingNeocortex] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  const fetchNeocortexAgents = useCallback(async () => {
    setIsLoadingNeocortex(true);
    try {
      const agents = await neocortexAPI.getAgents();
      console.log('Neocortex agents received:', agents);

      if (agents.length === 0) {
        toast.info('No agents found. Creating demo AI workflow...');

        // Create multiple demo nodes with transitions (simulate 3 agents)
        const demoAgentCount = 3;
        const newNodes: Node<NodeData>[] = [];
        const newEdges: Edge[] = [];
        const baseTimestamp = Date.now();

        for (let index = 0; index < demoAgentCount; index++) {
          const timestamp = baseTimestamp + index * 2;
          const seededJoints: JointParameter[] = (availableJointsStore || []).map((name) => ({
            name,
            value: (Math.random() - 0.5) * Math.PI + (index * 0.4), // Varied random poses
          }));

          // Create joint node
          const jointNodeId = `ai-demo-${timestamp}`;
          const jointNode: Node<NodeData> = {
            id: jointNodeId,
            type: "customNode",
            position: {
              x: (mousePosition?.x || 300) + (index * 400),
              y: (mousePosition?.y || 300)
            },
            data: {
              type: "joint",
              joints: seededJoints,
              onJointChange,
            },
          };
          newNodes.push(jointNode);

          // Create transition node between poses (except for last)
          if (index < demoAgentCount - 1) {
            const transitionNodeId = `ai-demo-transition-${timestamp}`;
            const transitionNode: Node<NodeData> = {
              id: transitionNodeId,
              type: "customNode",
              position: {
                x: (mousePosition?.x || 300) + (index * 400) + 200,
                y: (mousePosition?.y || 300)
              },
              data: {
                type: "transition",
                transition: {
                  smooth: true,
                  smoothness: 50,
                },
              },
            };
            newNodes.push(transitionNode);

            // Connect joint -> transition
            newEdges.push({
              id: `edge-${jointNodeId}-to-${transitionNodeId}`,
              source: jointNodeId,
              target: transitionNodeId,
              type: 'custom',
            });

            // Connect transition -> next joint
            const nextJointNodeId = `ai-demo-${baseTimestamp + (index + 1) * 2}`;
            newEdges.push({
              id: `edge-${transitionNodeId}-to-${nextJointNodeId}`,
              source: transitionNodeId,
              target: nextJointNodeId,
              type: 'custom',
            });
          }
        }

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        toast.success('Created AI-powered demo workflow with 3 poses!');
      } else {
        // Create nodes from agents with transitions and connections
        console.log('Creating nodes for', agents.length, 'agents');
        const newNodes: Node<NodeData>[] = [];
        const newEdges: Edge[] = [];
        const nodeIds: string[] = [];
        const baseTimestamp = Date.now();

        // First pass: Create all nodes and store their IDs
        agents.forEach((agent, index) => {
          console.log('Processing agent', index, ':', agent);
          const timestamp = baseTimestamp + index * 2;
          const seededJoints: JointParameter[] = (availableJointsStore || []).map((name) => ({
            name,
            value: index * 0.3, // Vary poses slightly
          }));

          // Create joint node
          const jointNodeId = `neo-agent-${agent.id}-${timestamp}`;
          const jointNode: Node<NodeData> = {
            id: jointNodeId,
            type: "customNode",
            position: {
              x: (mousePosition?.x || 300) + (index * 400),
              y: (mousePosition?.y || 300)
            },
            data: {
              type: "joint",
              joints: seededJoints,
              onJointChange,
            },
          };
          newNodes.push(jointNode);
          nodeIds.push(jointNodeId);

          // Create transition node between this and next agent (except for last)
          if (index < agents.length - 1) {
            const transitionNodeId = `neo-transition-${timestamp}`;
            const transitionNode: Node<NodeData> = {
              id: transitionNodeId,
              type: "customNode",
              position: {
                x: (mousePosition?.x || 300) + (index * 400) + 200,
                y: (mousePosition?.y || 300)
              },
              data: {
                type: "transition",
                transition: {
                  smooth: true,
                  smoothness: 50,
                },
              },
            };
            newNodes.push(transitionNode);

            // Connect joint -> transition
            newEdges.push({
              id: `edge-${jointNodeId}-to-${transitionNodeId}`,
              source: jointNodeId,
              target: transitionNodeId,
              type: 'custom',
            });

            // Connect transition -> next joint
            const nextJointNodeId = `neo-agent-${agents[index + 1].id}-${baseTimestamp + (index + 1) * 2}`;
            newEdges.push({
              id: `edge-${transitionNodeId}-to-${nextJointNodeId}`,
              source: transitionNodeId,
              target: nextJointNodeId,
              type: 'custom',
            });
          }
        });

        console.log('Created', newNodes.length, 'nodes and', newEdges.length, 'edges');
        console.log('New nodes:', newNodes);
        console.log('New edges:', newEdges);

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);

        toast.success(`Added ${agents.length} Neocortex agent(s) with transitions!`);
      }
    } catch (error) {
      console.error('Neocortex error:', error);
      toast.error('Failed to connect to Neocortex. Check console for details.');
    } finally {
      setIsLoadingNeocortex(false);
    }
  }, [availableJointsStore, mousePosition, onJointChange, setNodes, setEdges]);

  // Generate nodes from AI chat command
  const generateNodesFromChat = useCallback((prompt: string, response: { nodeCount?: number; motionType?: string }) => {
    if (!availableJointsStore || availableJointsStore.length === 0) {
      toast.error("Please upload a URDF file first");
      return;
    }

    const nodeCount = response.nodeCount || 3;
    const motionType = response.motionType || "smooth";
    const newNodes: Node<NodeData>[] = [];
    const newEdges: Edge[] = [];
    const baseTimestamp = Date.now();

    // Generate joint values based on motion type
    const generateJointValues = (index: number, total: number): JointParameter[] => {
      const t = index / (total - 1 || 1); // Normalized position 0 to 1

      return (availableJointsStore || []).map((name, jointIndex) => {
        let value = 0;

        switch (motionType) {
          case "waving":
            // Sinusoidal wave motion
            value = Math.sin(t * Math.PI * 2) * (Math.PI / 3) + (jointIndex === 4 ? Math.PI / 4 : 0);
            break;
          case "nodding":
            // Up and down motion (primarily joint 2)
            value = jointIndex === 1
              ? Math.sin(t * Math.PI * 2) * (Math.PI / 4)
              : (Math.random() - 0.5) * 0.2;
            break;
          case "pointing":
            // Extend and point
            value = jointIndex <= 2
              ? t * (Math.PI / 3)
              : (Math.random() - 0.5) * 0.3;
            break;
          case "exploring":
          case "random":
            // Random exploration
            value = (Math.random() - 0.5) * Math.PI * 0.8;
            break;
          case "dramatic":
            // Large, dramatic movements
            value = Math.sin(t * Math.PI + jointIndex) * (Math.PI / 2);
            break;
          default:
            // Smooth interpolation
            value = (Math.sin(t * Math.PI - Math.PI / 2) + 1) * 0.5 * (Math.PI / 4) + (jointIndex * 0.1);
        }

        return { name, value };
      });
    };

    // Create nodes
    for (let index = 0; index < nodeCount; index++) {
      const timestamp = baseTimestamp + index * 2;
      const seededJoints = generateJointValues(index, nodeCount);

      // Create joint node
      const jointNodeId = `ai-chat-${timestamp}`;
      const jointNode: Node<NodeData> = {
        id: jointNodeId,
        type: "customNode",
        position: {
          x: (mousePosition?.x || 300) + (index * 400),
          y: (mousePosition?.y || 300)
        },
        data: {
          type: "joint",
          joints: seededJoints,
          onJointChange,
        },
      };
      newNodes.push(jointNode);

      // Create transition node between poses (except for last)
      if (index < nodeCount - 1) {
        const transitionNodeId = `ai-chat-transition-${timestamp}`;

        // Vary smoothness based on motion type
        let smoothness = 50;
        if (motionType === "dramatic") smoothness = 30;
        if (motionType === "smooth") smoothness = 70;

        const transitionNode: Node<NodeData> = {
          id: transitionNodeId,
          type: "customNode",
          position: {
            x: (mousePosition?.x || 300) + (index * 400) + 200,
            y: (mousePosition?.y || 300)
          },
          data: {
            type: "transition",
            transition: {
              smooth: true,
              smoothness,
            },
          },
        };
        newNodes.push(transitionNode);

        // Connect joint -> transition
        newEdges.push({
          id: `edge-${jointNodeId}-to-${transitionNodeId}`,
          source: jointNodeId,
          target: transitionNodeId,
          type: 'custom',
        });

        // Connect transition -> next joint
        const nextJointNodeId = `ai-chat-${baseTimestamp + (index + 1) * 2}`;
        newEdges.push({
          id: `edge-${transitionNodeId}-to-${nextJointNodeId}`,
          source: transitionNodeId,
          target: nextJointNodeId,
          type: 'custom',
        });
      }
    }

    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    toast.success(`Created ${nodeCount} nodes with ${motionType} motion!`);
    setShowAIChat(false);
  }, [availableJointsStore, mousePosition, onJointChange, setNodes, setEdges]);

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

    // Auto-start recording when animation starts
    if (isRecording) {
      // Reset recording
      setRecordedFrames([]);
      recordingStartTime.current = Date.now();
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
  }, [nodes, edges, isAnimating, isRecording, getNodeState, setStoreJointValues, setIsAnimating, setActiveNodeId]);

  const stopAnimation = useCallback(() => {
    if (animationAbortController) {
      animationAbortController.abort();
    }
    // Stop recording when animation stops
    if (isRecording) {
      stopRecording();
    }
  }, [animationAbortController, isRecording, stopRecording]);

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
        <Button
          size="sm"
          variant="outline"
          className="text-xs bg-card shadow-md border-purple-500/50 hover:bg-purple-500/10"
          onClick={() => setShowAIChat(true)}
          disabled={!availableJointsStore || availableJointsStore.length === 0}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          AI Agent
        </Button>
      </div>

      {/* Animation & Recording Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
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

        <div className="flex gap-2 border-l pl-2 ml-1">
          <Button
            size="sm"
            variant={isRecording ? "destructive" : "outline"}
            className="text-xs shadow-md"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isAnimating}
          >
            {isRecording ? (
              <>
                <Square className="w-3 h-3 mr-1 fill-current" />
                Stop Rec
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5" />
                Record
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shadow-md"
            onClick={exportToCSV}
            disabled={recordedFrames.length === 0}
          >
            <Download className="w-3 h-3 mr-1" />
            Export ({recordedFrames.length})
          </Button>
        </div>
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

      {/* AI Chat Dialog */}
      <AIChatDialog
        open={showAIChat}
        onOpenChange={setShowAIChat}
        onGenerateNodes={generateNodesFromChat}
      />
    </div>
  );
};
