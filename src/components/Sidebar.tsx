import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import JSZip from "jszip";

interface MeshFiles {
  [key: string]: Blob;
}

interface SidebarProps {
  onFileUpload: (file: File) => void;
  onSimulationUpload: (urdf: File, meshes: MeshFiles) => void;
}

export const Sidebar = ({ onFileUpload, onSimulationUpload }: SidebarProps) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      toast.success(`URDF file uploaded: ${file.name}`);
    }
  };

  const handleSimulationZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Please upload a ZIP file");
      return;
    }

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const meshFiles: MeshFiles = {};
      let urdfFile: File | null = null;
      let meshCount = 0;

      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;

        const blob = await zipEntry.async('blob');
        const name = filename.split('/').pop() || filename;

        // Handle URDF files
        if (filename.endsWith('.urdf')) {
          urdfFile = new File([blob], name, { type: 'application/xml' });
        }
        // Handle mesh files - store with both full path and just filename
        else if (filename.endsWith('.stl') || filename.endsWith('.dae') || filename.endsWith('.obj')) {
          // Store with just filename
          meshFiles[name] = blob;
          // Also store with path variations for matching
          meshFiles[filename] = blob;
          meshFiles[filename.replace(/^[^/]*\//, '')] = blob; // Remove first folder
          meshCount++;
        }
      }

      console.log('Extracted mesh files:', Object.keys(meshFiles));

      if (urdfFile) {
        onSimulationUpload(urdfFile, meshFiles);
        toast.success(`Loaded simulation: ${urdfFile.name} + ${meshCount} meshes`);
      } else {
        toast.error("No URDF file found in ZIP");
      }
    } catch (error) {
      console.error("Error loading simulation ZIP:", error);
      toast.error("Failed to load simulation ZIP file");
    }
  };

  return (
    <div className="w-[250px] sidebar-panel flex flex-col p-6">
      <div className="flex flex-col items-start gap-6">


        {/* LeLamp Text */}
        <h1 className="text-sm tracking-wide text-muted-foreground">
          LeLamp Studio
        </h1>

        {/* Upload URDF */}
        <div className="mt-0 flex flex-col gap-3">
          <input
            type="file"
            id="simulation-zip-upload"
            accept=".zip"
            onChange={handleSimulationZipUpload}
            className="hidden"
          />
          <label htmlFor="simulation-zip-upload">
            <Button variant="default" size="sm" className="cursor-pointer w-full" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Upload Simulation
              </span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
};
