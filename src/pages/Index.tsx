import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer3D } from "@/components/Viewer3D";
import { ModeTabs } from "@/components/ModeTabs";
import { NodeGraph } from "@/components/NodeGraph";

interface MeshFiles {
  [key: string]: Blob;
}

const Index = () => {
  const [urdfFile, setUrdfFile] = useState<File | null>(null);
  const [meshFiles, setMeshFiles] = useState<MeshFiles>({});
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [availableJoints, setAvailableJoints] = useState<string[]>([]);

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onFileUpload={handleFileUpload} onSimulationUpload={handleSimulationUpload} />
      
      <main className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* 3D Viewer */}
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
        />
        
        {/* Mode Tabs */}
        <div className="mt-6 mb-2">
          <ModeTabs />
        </div>
        
        {/* Node Graph */}
        <div className="flex-1 min-h-0 panel mt-4 overflow-hidden">
          <NodeGraph 
            selectedJoint={selectedJoint}
            onJointChange={handleJointChange}
            jointValues={jointValues}
            onSelectJoint={setSelectedJoint}
            availableJoints={availableJoints}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
