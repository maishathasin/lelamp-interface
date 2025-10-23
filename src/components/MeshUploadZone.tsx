import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import JSZip from "jszip";

interface MeshUploadZoneProps {
  onMeshFilesLoaded: (files: { [key: string]: Blob }) => void;
  onUrdfFileLoaded?: (file: File) => void;
}

export const MeshUploadZone = ({ onMeshFilesLoaded, onUrdfFileLoaded }: MeshUploadZoneProps) => {
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
      const meshFiles: { [key: string]: Blob } = {};
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
        // Handle mesh files
        else if (filename.endsWith('.stl') || filename.endsWith('.dae') || filename.endsWith('.obj')) {
          meshFiles[name] = blob;
          meshCount++;
        }
      }

      if (urdfFile && onUrdfFileLoaded) {
        onUrdfFileLoaded(urdfFile);
      }
      
      if (meshCount > 0) {
        onMeshFilesLoaded(meshFiles);
      }

      toast.success(`Loaded simulation: ${urdfFile ? '1 URDF' : ''} ${meshCount > 0 ? `+ ${meshCount} meshes` : ''}`);
    } catch (error) {
      console.error("Error loading simulation ZIP:", error);
      toast.error("Failed to load simulation ZIP file");
    }
  };
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Please upload a ZIP file containing mesh files");
      return;
    }

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const meshFiles: { [key: string]: Blob } = {};
      let count = 0;

      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && (filename.endsWith('.stl') || filename.endsWith('.dae') || filename.endsWith('.obj'))) {
          const blob = await zipEntry.async('blob');
          const name = filename.split('/').pop() || filename;
          meshFiles[name] = blob;
          count++;
        }
      }

      onMeshFilesLoaded(meshFiles);
      toast.success(`Loaded ${count} mesh files from ZIP`);
    } catch (error) {
      console.error("Error loading ZIP:", error);
      toast.error("Failed to load ZIP file");
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const meshFiles: { [key: string]: Blob } = {};
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.stl') || file.name.endsWith('.dae') || file.name.endsWith('.obj')) {
        meshFiles[file.name] = file;
        count++;
      }
    }

    onMeshFilesLoaded(meshFiles);
    toast.success(`Loaded ${count} mesh files`);
  };

  return (
    <>
      <input
        type="file"
        id="simulation-zip-upload"
        accept=".zip"
        onChange={handleSimulationZipUpload}
        className="hidden"
      />
      <input
        type="file"
        id="mesh-zip-upload"
        accept=".zip"
        onChange={handleZipUpload}
        className="hidden"
      />
      <input
        type="file"
        id="mesh-folder-upload"
        accept=".stl,.dae,.obj"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
      />
      {onUrdfFileLoaded && (
        <label htmlFor="simulation-zip-upload">
          <Button variant="ghost" size="sm" className="text-xs cursor-pointer" asChild>
            <span>
              <Upload className="w-3 h-3 mr-1.5" />
              Upload Simulation (ZIP)
            </span>
          </Button>
        </label>
      )}
      <label htmlFor="mesh-zip-upload">
        <Button variant="ghost" size="sm" className="text-xs cursor-pointer" asChild>
          <span>
            <Upload className="w-3 h-3 mr-1.5" />
            Upload Meshes (ZIP)
          </span>
        </Button>
      </label>
      <label htmlFor="mesh-folder-upload">
        <Button variant="ghost" size="sm" className="text-xs cursor-pointer" asChild>
          <span>
            <Upload className="w-3 h-3 mr-1.5" />
            Upload Meshes
          </span>
        </Button>
      </label>
    </>
  );
};
