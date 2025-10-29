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
} from "reactflow";
import "reactflow/dist/style.css";
import { NodeCard } from "./nodes/NodeCard";
import { Button } from "@/components/ui/button";
import { Plus, Play, Square, Save, Users } from "lucide-react";
import { useJointStore, type JointParameter, type TransitionOptions } from "@/store/useJointStore";
import { toast } from "sonner";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useTemplateManager } from "@/hooks/useTemplateManager";
import { useNavigate } from "react-router-dom";

const nodeTypes = {
  customNode: (props: any) => <NodeCard {...props} id={props.id} />,
};

interface NodeData {
  type: "joint" | "transition" | "led" | "parallel";
  joints?: JointParameter[];
  transition?: TransitionOptions;
  led?: { color: string; brightness: number };
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
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { saveTemplate } = useTemplateManager();
  // Subscribe to store for live joint values
  const storeJointValues = useJointStore((s) => s.jointValues);
  const availableJointsStore = useJointStore((s) => s.availableJoints);
  const setStoreJointValues = useJointStore((s) => s.setJointValues);
  const getNodeState = useJointStore((s) => s.getNodeState);
  const setNodeState = useJointStore((s) => s.setNodeState);
  const isAnimating = useJointStore((s) => s.isAnimating);
  const setIsAnimating = useJointStore((s) => s.setIsAnimating);
  const setActiveNodeIds = useJointStore((s) => s.setActiveNodeIds);
  const clearActiveNodeIds = useJointStore((s) => s.clearActiveNodeIds);
  const addActiveNodeId = useJointStore((s) => s.addActiveNodeId);
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
      } else if (!existingState && (node.data as any)?.type === 'led') {
        setNodeState(node.id, {
          id: node.id,
          type: 'led',
          led: (node.data as any).led || { color: "#ff0000", brightness: 100 },
        });
      } else if (!existingState && (node.data as any)?.type === 'transition') {
        setNodeState(node.id, {
          id: node.id,
          type: 'transition',
          transition: (node.data as any).transition,
        });
      } else if (!existingState && (node.data as any)?.type === 'parallel') {
        setNodeState(node.id, {
          id: node.id,
          type: 'parallel',
        });
      }
    });
  }, [availableJointsStore, storeJointValues, nodes, getNodeState, setNodeState]);

  // Load template from sessionStorage if available
  useEffect(() => {
    const loadTemplate = sessionStorage.getItem("loadTemplate");
    if (loadTemplate) {
      try {
        const template = JSON.parse(loadTemplate);
        setNodes(template.nodes);
        setEdges(template.edges);
        sessionStorage.removeItem("loadTemplate");
      } catch (error) {
        console.error("Failed to load template:", error);
      }
    }
  }, [setNodes, setEdges]);

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
              led: nodeState.led,
            },
          };
        }
        return node;
      })
    );
  }, [getNodeState, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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

  const addNode = useCallback((type: "joint" | "transition" | "led" | "parallel") => {
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
    const newNode: Node<NodeData> = {
      id: `node-${timestamp}`,
      type: "customNode",
      position: {
        x: 300 + Math.random() * 200,
        y: 200 + Math.random() * 150,
      },
      data:
        type === "joint"
          ? {
              type: "joint",
              joints: seededJoints,
              onJointChange,
            }
          : type === "led"
          ? {
              type: "led",
              led: {
                color: "#ff0000",
                brightness: 100,
              },
            }
          : type === "parallel"
          ? {
              type: "parallel",
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
  }, [setNodes, onJointChange, availableJointsStore, storeJointValues]);

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
    // Prevent focused node auto-sync from overwriting node poses during/after animation
    setFocusedNodeId(null);
    // Helper to execute a single node
    const executeNode = async (
      nodeId: string, 
      prevJointPose: Record<string, number> | null,
      prevLEDState: { color: string; brightness: number } | null,
      skipJointApplication: boolean
    ): Promise<{
      nextJointPose: Record<string, number> | null;
      nextLEDState: { color: string; brightness: number } | null;
      skipNext: boolean;
    }> => {
      addActiveNodeId(nodeId);
      const nodeState = getNodeState(nodeId);
      
      if (!nodeState) {
        return { nextJointPose: prevJointPose, nextLEDState: prevLEDState, skipNext: false };
      }
      
      if (nodeState.type === "joint" && nodeState.joints) {
        const pose = Object.fromEntries(
          nodeState.joints.map((j) => [j.name, j.value])
        );
        
        if (!skipJointApplication) {
          setStoreJointValues(pose);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        
        return { nextJointPose: pose, nextLEDState: prevLEDState, skipNext: false };
      } 
      
      if (nodeState.type === "led" && nodeState.led) {
        const hex = nodeState.led.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = nodeState.led.brightness / 100;
        
        const finalR = Math.round(r * brightness);
        const finalG = Math.round(g * brightness);
        const finalB = Math.round(b * brightness);
        
        console.log(`LED: RGB(${finalR}, ${finalG}, ${finalB}) at ${nodeState.led.brightness}% brightness`);
        
        // Apply LED state globally
        useJointStore.getState().setCurrentLEDState(nodeState.led);
        
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { nextJointPose: prevJointPose, nextLEDState: nodeState.led, skipNext: false };
      }
      
      if (nodeState.type === "transition" && nodeState.transition) {
        const trans = nodeState.transition;
        const nextEdge = edges.find((edge) => edge.source === nodeId);
        let nextJointPose: Record<string, number> | null = null;
        let nextLEDState: { color: string; brightness: number } | null = null;
        
        if (nextEdge) {
          const nextNodeState = getNodeState(nextEdge.target);
          if (nextNodeState?.type === "joint" && nextNodeState.joints) {
            nextJointPose = Object.fromEntries(
              nextNodeState.joints.map((j) => [j.name, j.value])
            );
          } else if (nextNodeState?.type === "led" && nextNodeState.led) {
            nextLEDState = nextNodeState.led;
          }
        }
        
        // Handle joint transition
        if (trans.smooth && prevJointPose && nextJointPose) {
          const minDuration = 500;
          const maxDuration = 5000;
          const durationMs = maxDuration - (trans.smoothness / 100) * (maxDuration - minDuration);
          
          const frameRate = 60;
          const frameTime = 1000 / frameRate;
          const totalFrames = Math.floor(durationMs / frameTime);
          
          const allJointNames = new Set([
            ...Object.keys(prevJointPose),
            ...Object.keys(nextJointPose)
          ]);
          
          for (let frame = 0; frame <= totalFrames && !abortController.signal.aborted; frame++) {
            const t = frame / totalFrames;
            const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            const interpolatedPose: Record<string, number> = {};
            allJointNames.forEach((jointName) => {
              const startValue = prevJointPose![jointName] ?? 0;
              const endValue = nextJointPose![jointName] ?? 0;
              interpolatedPose[jointName] = startValue + (endValue - startValue) * easedT;
            });
            
            setStoreJointValues(interpolatedPose);
            await new Promise((resolve) => setTimeout(resolve, frameTime));
          }
          
          return { nextJointPose: prevJointPose, nextLEDState: prevLEDState, skipNext: true };
        }
        
        // Handle LED transition
        if (trans.smooth && prevLEDState && nextLEDState) {
          const minDuration = 500;
          const maxDuration = 5000;
          const durationMs = maxDuration - (trans.smoothness / 100) * (maxDuration - minDuration);
          
          const frameRate = 60;
          const frameTime = 1000 / frameRate;
          const totalFrames = Math.floor(durationMs / frameTime);
          
          // Parse colors
          const parseColor = (hex: string) => {
            const clean = hex.replace('#', '');
            return {
              r: parseInt(clean.substring(0, 2), 16),
              g: parseInt(clean.substring(2, 4), 16),
              b: parseInt(clean.substring(4, 6), 16)
            };
          };
          
          const startColor = parseColor(prevLEDState.color);
          const endColor = parseColor(nextLEDState.color);
          
          for (let frame = 0; frame <= totalFrames && !abortController.signal.aborted; frame++) {
            const t = frame / totalFrames;
            const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            const r = Math.round(startColor.r + (endColor.r - startColor.r) * easedT);
            const g = Math.round(startColor.g + (endColor.g - startColor.g) * easedT);
            const b = Math.round(startColor.b + (endColor.b - startColor.b) * easedT);
            const brightness = prevLEDState.brightness + (nextLEDState.brightness - prevLEDState.brightness) * easedT;
            
            const finalR = Math.round(r * (brightness / 100));
            const finalG = Math.round(g * (brightness / 100));
            const finalB = Math.round(b * (brightness / 100));
            
            console.log(`LED Transition: RGB(${finalR}, ${finalG}, ${finalB})`);
            
            // Apply interpolated LED state
            const interpolatedHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            useJointStore.getState().setCurrentLEDState({ color: interpolatedHex, brightness });
            
            await new Promise((resolve) => setTimeout(resolve, frameTime));
          }
          
          return { nextJointPose: prevJointPose, nextLEDState: prevLEDState, skipNext: true };
        }
        
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { nextJointPose: prevJointPose, nextLEDState: prevLEDState, skipNext: false };
      }
      
      return { nextJointPose: prevJointPose, nextLEDState: prevLEDState, skipNext: false };
    };
    
    try {
      let currentNodeId = startNodes[0].id;
      let previousJointPose: Record<string, number> | null = null;
      let previousLEDState: { color: string; brightness: number } | null = null;
      let skipNextJointApplication = false;
      
      while (currentNodeId && !abortController.signal.aborted) {
        const currentNode = nodes.find((n) => n.id === currentNodeId);
        const nodeState = getNodeState(currentNodeId);
        
        if (!currentNode || !nodeState) break;
        
        // Handle parallel node
        if (nodeState.type === "parallel") {
          addActiveNodeId(currentNodeId);
          const parallelEdges = edges.filter((edge) => edge.source === currentNodeId);
          
          if (parallelEdges.length > 0) {
            // Collect all node IDs in all parallel branches to highlight them
            const allBranchNodeIds: string[] = [];
            
            // Validate parallel branches before execution
            let jointBranchCount = 0;
            let hasDirectTransitionNode = false;
            
            for (const edge of parallelEdges) {
              let branchNodeId = edge.target;
              let branchHasJoint = false;
              
              // Check if the DIRECT child is a transition node
              const directChildState = getNodeState(branchNodeId);
              if (directChildState?.type === "transition") {
                hasDirectTransitionNode = true;
              }
              
              while (branchNodeId) {
                allBranchNodeIds.push(branchNodeId);
                const branchNodeState = getNodeState(branchNodeId);
                
                if (branchNodeState?.type === "joint") {
                  branchHasJoint = true;
                }
                
                const nextEdge = edges.find((e) => e.source === branchNodeId);
                branchNodeId = nextEdge ? nextEdge.target : "";
              }
              
              if (branchHasJoint) {
                jointBranchCount++;
              }
            }
            
            // Validation rules
            if (hasDirectTransitionNode) {
              toast.error("Transition nodes cannot be directly connected to parallel branches");
              break;
            }
            
            if (jointBranchCount > 1) {
              toast.error("Only one parallel branch can contain joint nodes");
              break;
            }
            
            // Set all branch nodes as active for visual feedback
            setActiveNodeIds([currentNodeId, ...allBranchNodeIds]);
            
            // Execute all branches in parallel - joints apply immediately since only one branch can have them
            const branchPromises = parallelEdges.map(async (edge) => {
              let branchNodeId = edge.target;
              let branchJointPose = previousJointPose;
              let branchLEDState = previousLEDState;
              let branchSkip = false;
              
              while (branchNodeId && !abortController.signal.aborted) {
                // Don't skip joint application - validation ensures only one branch has joints
                const result = await executeNode(branchNodeId, branchJointPose, branchLEDState, false);
                branchJointPose = result.nextJointPose;
                branchLEDState = result.nextLEDState;
                branchSkip = result.skipNext;
                
                const nextEdge = edges.find((e) => e.source === branchNodeId);
                branchNodeId = nextEdge ? nextEdge.target : "";
              }
              
              return { jointPose: branchJointPose, ledState: branchLEDState };
            });
            
            const branchResults = await Promise.all(branchPromises);
            
            // Update previous states from results
            branchResults.forEach(result => {
              if (result.jointPose) {
                previousJointPose = result.jointPose;
              }
              if (result.ledState) {
                previousLEDState = result.ledState;
              }
            });
          }
          
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          // Find the next node after parallel execution (if any)
          // For simplicity, we don't continue after parallel - user should design graph accordingly
          break;
        } else {
          // Regular sequential execution
          const result = await executeNode(currentNodeId, previousJointPose, previousLEDState, skipNextJointApplication);
          previousJointPose = result.nextJointPose;
          previousLEDState = result.nextLEDState;
          skipNextJointApplication = result.skipNext;
          
          const nextEdge = edges.find((edge) => edge.source === currentNodeId);
          currentNodeId = nextEdge ? nextEdge.target : "";
        }
      }
    } catch (error) {
      console.error("Animation error:", error);
      toast.error("Animation encountered an error");
    } finally {
      setIsAnimating(false);
      clearActiveNodeIds();
      setFocusedNodeId(null);
      setAnimationAbortController(null);
      useJointStore.getState().setCurrentLEDState(null); // Clear LED state when animation ends
    }
  }, [nodes, edges, isAnimating, getNodeState, setStoreJointValues, setIsAnimating, setActiveNodeIds, addActiveNodeId, clearActiveNodeIds]);

  const stopAnimation = useCallback(() => {
    if (animationAbortController) {
      animationAbortController.abort();
    }
  }, [animationAbortController]);

  const handleSaveTemplate = (name: string, description: string, author: string, tags: string[]) => {
    if (nodes.length === 0) {
      toast.error("Add some nodes before saving a template");
      return;
    }
    saveTemplate(name, description, author, nodes, edges, tags);
  };

  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Toolbar */}
      <div className="bg-card border-b border-border p-3 flex flex-wrap gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground font-medium mr-2">Add Node:</span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => addNode("joint")}
          >
            <Plus className="w-3 h-3 mr-1" />
            Joint
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => addNode("transition")}
          >
            <Plus className="w-3 h-3 mr-1" />
            Transition
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => addNode("led")}
          >
            <Plus className="w-3 h-3 mr-1" />
            LED
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => addNode("parallel")}
          >
            <Plus className="w-3 h-3 mr-1" />
            Parallel
          </Button>
        </div>
        <div className="border-l border-border pl-2 ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="w-3 h-3 mr-1" />
            Save Template
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => navigate("/community")}
          >
            <Users className="w-3 h-3 mr-1" />
            Community
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative">
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
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          const prevFocused = focusedNodeId;
          setFocusedNodeId(node.id);
          setActiveNodeIds([node.id]);
          
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
          } else if ((node.data as any)?.type === 'led') {
            // Apply LED state when LED node is clicked
            const nodeState = getNodeState(node.id);
            const ledState = nodeState?.led || (node.data as any)?.led;
            if (ledState) {
              useJointStore.getState().setCurrentLEDState(ledState);
            }
          }
        }}
        onPaneClick={() => {
          setFocusedNodeId(null);
          clearActiveNodeIds();
          useJointStore.getState().setCurrentLEDState(null); // Clear LED when clicking pane
        }}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background w-full h-full"
        style={{ width: "100%", height: "100%" }}
        defaultEdgeOptions={{
          type: 'smoothstep',
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

      <SaveTemplateDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};
