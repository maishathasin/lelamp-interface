import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer3D } from "@/components/Viewer3D";
import { ModeTabs } from "@/components/ModeTabs";
import { NodeGraph } from "@/components/NodeGraph";
import type { Node, Edge } from "reactflow";

interface MeshFiles {
  [key: string]: Blob;
}

const Index = () => {
  const [urdfFile, setUrdfFile] = useState<File | null>(null);
  const [meshFiles, setMeshFiles] = useState<MeshFiles>({});
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [availableJoints, setAvailableJoints] = useState<string[]>([]);
  const [csvNodes, setCsvNodes] = useState<Node[]>([]);
  const [csvEdges, setCsvEdges] = useState<Edge[]>([]);

  const handleFileUpload = (file: File) => {
    setUrdfFile(file);
  };

  const handleSimulationUpload = (urdf: File, meshes: MeshFiles) => {
    setUrdfFile(urdf);
    setMeshFiles(meshes);
  };

  const handleJointChange = (jointName: string, value: number) => {
    setJointValues(prev => ({
      ...prev,
      [jointName]: value
    }));
  };

  const handleCsvNodesGenerated = (nodes: Node[], edges: Edge[]) => {
    setCsvNodes(nodes);
    setCsvEdges(edges);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onFileUpload={handleFileUpload} onSimulationUpload={handleSimulationUpload} />

      <main className="flex-1 flex flex-col p-6 overflow-hidden gap-3">
        {/* 3D Viewer - Equal height */}
        <div className="flex-1 min-h-0">
          <Viewer3D
            urdfFile={urdfFile}
            initialMeshFiles={meshFiles}
            selectedJoint={selectedJoint}
            jointValues={jointValues}
            onJointSelect={setSelectedJoint}
            onJointChange={handleJointChange}
            onRobotJointsLoaded={(joints, angles) => {
              setAvailableJoints(joints);
              setJointValues(angles);
              if (!selectedJoint && joints.length > 0) setSelectedJoint(joints[0]);
            }}
            onCsvNodesGenerated={handleCsvNodesGenerated}
          />
        </div>

        {/* Mode Tabs */}
        <div className="flex-shrink-0">
          <ModeTabs />
        </div>

        {/* Node Graph - Equal height */}
        <div className="flex-1 min-h-0 panel overflow-hidden">
          <NodeGraph
            selectedJoint={selectedJoint}
            onJointChange={handleJointChange}
            jointValues={jointValues}
            onSelectJoint={setSelectedJoint}
            availableJoints={availableJoints}
            initialCsvNodes={csvNodes}
            initialCsvEdges={csvEdges}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
