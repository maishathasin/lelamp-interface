import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer3D } from "@/components/Viewer3D";
import { ModeTabs } from "@/components/ModeTabs";
import { NodeGraph } from "@/components/NodeGraph";
import JSZip from "jszip";
import { toast } from "sonner";

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

  // Auto-load simulation.zip on mount
  useEffect(() => {
    const loadSimulation = async () => {
      try {
        const response = await fetch('/simulation.zip');
        const blob = await response.blob();
        
        const zip = new JSZip();
        const contents = await zip.loadAsync(blob);
        const meshFiles: MeshFiles = {};
        let urdfFile: File | null = null;
        let meshCount = 0;

        for (const [filename, zipEntry] of Object.entries(contents.files)) {
          if (zipEntry.dir) continue;

          const fileBlob = await zipEntry.async('blob');
          const name = filename.split('/').pop() || filename;

          if (filename.endsWith('.urdf')) {
            urdfFile = new File([fileBlob], name, { type: 'application/xml' });
          } else if (filename.endsWith('.stl') || filename.endsWith('.dae') || filename.endsWith('.obj')) {
            meshFiles[name] = fileBlob;
            meshFiles[filename] = fileBlob;
            meshFiles[filename.replace(/^[^/]*\//, '')] = fileBlob;
            meshCount++;
          }
        }

        if (urdfFile) {
          setUrdfFile(urdfFile);
          setMeshFiles(meshFiles);
          toast.success(`Auto-loaded simulation: ${meshCount} meshes`);
        }
      } catch (error) {
        console.error("Error auto-loading simulation:", error);
        toast.error("Failed to auto-load simulation");
      }
    };

    loadSimulation();
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* <Sidebar onFileUpload={handleFileUpload} onSimulationUpload={handleSimulationUpload} />*/}
      
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
