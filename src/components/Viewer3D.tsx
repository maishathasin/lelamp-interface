import { useEffect, useRef, useState } from "react";
import { MessageSquare, Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three-stdlib";
import URDFLoader from "urdf-loader";
import { toast } from "sonner";
import JSZip from "jszip";
import { MeshUploadZone } from "./MeshUploadZone";
import { useJointStore } from "@/store/useJointStore";
import type { Node, Edge } from "reactflow";

interface Viewer3DProps {
  urdfFile: File | null;
  initialMeshFiles?: MeshFiles;
  selectedJoint?: string | null;
  jointValues?: Record<string, number>;
  onJointSelect?: (jointName: string | null) => void;
  onJointChange?: (jointName: string, value: number) => void;
  onRobotJointsLoaded?: (joints: string[], angles: Record<string, number>) => void;
  onCsvNodesGenerated?: (nodes: Node[], edges: Edge[]) => void;
}

interface MeshFiles {
  [key: string]: Blob;
}

interface AnimationFrame {
  timestamp: number;
  joints: Record<string, number>;
}

interface URDFRobot {
  joints: Record<string, any>;
  setJointValue: (jointName: string, value: number) => void;
  setJointValues: (values: Record<string, number>) => void;
  position: THREE.Vector3;
  scale: THREE.Vector3;
}

const URDFModel = ({
  file,
  meshFiles,
  animationFrames,
  isPlaying,
  onRobotLoaded,
  selectedJoint,
  onSelectPart,
  onJointChange,
  onDragActiveChange,
}: {
  file: File;
  meshFiles: MeshFiles;
  animationFrames: AnimationFrame[] | null;
  isPlaying: boolean;
  onRobotLoaded: (robot: any) => void;
  selectedJoint?: string | null;
  onSelectPart?: (payload: { linkName?: string; jointName?: string | null }) => void;
  onJointChange?: (jointName: string, value: number) => void;
  onDragActiveChange?: (active: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const robotRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const animationStartTime = useRef<number>(0);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!file) return;

    const loader = new URDFLoader();

    // Custom mesh loader that uses the uploaded files
    loader.loadMeshCb = (path: string, manager: THREE.LoadingManager, onComplete: (mesh: THREE.Object3D | null, err?: Error) => void) => {
      console.log('Looking for mesh:', path);

      // Try multiple path variations
      const filename = path.split('/').pop() || path;
      const pathVariations = [
        path,                                          // Full path as-is
        filename,                                      // Just filename
        path.replace(/^.*?\//, ''),                   // Remove first folder
        path.replace(/^package:\/\/[^/]+\//, ''),     // Remove ROS package prefix
        decodeURIComponent(path),                     // URL decoded
        decodeURIComponent(filename)                  // URL decoded filename
      ];

      let meshBlob: Blob | null = null;
      for (const variant of pathVariations) {
        if (meshFiles[variant]) {
          meshBlob = meshFiles[variant];
          console.log(`Found mesh with variant: ${variant}`);
          break;
        }
      }

      if (!meshBlob) {
        console.warn(`Mesh file not found. Tried:`, pathVariations);
        console.warn('Available meshes:', Object.keys(meshFiles));
        // Don't fail - just skip this mesh
        onComplete(null);
        return;
      }

      const blobUrl = URL.createObjectURL(meshBlob);
      blobUrlsRef.current.push(blobUrl);

      const stlLoader = new STLLoader(manager);
      stlLoader.load(
        blobUrl,
        (geometry) => {
          console.log(`Successfully loaded geometry for ${filename}:`, {
            vertices: geometry.attributes.position.count,
            hasNormals: !!geometry.attributes.normal
          });

          // Ensure geometry has normals
          if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
          }

          // Create mesh with a visible material
          const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.3,
            roughness: 0.7,
            side: THREE.DoubleSide // Render both sides
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          console.log(`Created mesh for ${filename}`, mesh);
          onComplete(mesh);
        },
        (progress) => {
          console.log(`Loading ${filename}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (err) => {
          console.error(`Error loading mesh ${filename}:`, err);
          onComplete(null, err instanceof Error ? err : new Error(String(err)));
        }
      );
    };

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const robot = loader.parse(content) as any;
        if (groupRef.current && robot) {
          // Clear previous model
          while (groupRef.current.children.length > 0) {
            groupRef.current.remove(groupRef.current.children[0]);
          }
          groupRef.current.add(robot);

          console.log('Robot added to scene, children count:', robot.children.length);
          console.log('Robot structure:', robot);

          // Keep URDF Z-up to match CSV axes; no rotation

          // Scale to fit within a 2-unit cube (optional) but KEEP anchor at origin
          const box = new THREE.Box3().setFromObject(robot);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          console.log('Robot bounding box (pre-scale):', { size, maxDim, min: box.min, max: box.max });

          if (maxDim > 0 && isFinite(maxDim)) {
            const scale = 2 / maxDim;
            robot.scale.setScalar(scale);
          } else {
            console.warn('Invalid bounding box, default scale=1');
            robot.scale.setScalar(1);
          }

          // Choose an anchor to place at world origin: prefer joint_2, then base_link/base, else robot root
          const rAny: any = robot as any;
          const preferredAnchorNames = ['joint_2', 'joint2', 'base_link', 'base', 'world', 'root'];
          let anchor: THREE.Object3D | null = null;
          for (const name of preferredAnchorNames) {
            anchor = (rAny.joints?.[name] as THREE.Object3D) || robot.getObjectByName?.(name) || null;
            if (anchor) { console.log('Anchor selected:', name); break; }
          }
          if (!anchor) {
            // Try first child that looks like a link, fallback to robot itself
            const linkNames = Object.keys(rAny.links || {});
            anchor = linkNames.length ? (robot.getObjectByName(linkNames[0]) as THREE.Object3D) : robot;
            console.log('Anchor fallback used:', (anchor as any)?.name || 'robot');
          }

          // After scaling, offset the whole robot so the anchor sits at exactly [0,0,0]
          anchor.updateWorldMatrix(true, true);
          const anchorWorld = new THREE.Vector3();
          anchor.getWorldPosition(anchorWorld);
          robot.position.addScaledVector(anchorWorld, -1);
          console.log('Applied origin alignment to anchor at 0,0,0:', { anchor: (anchor as any).name, anchorWorld: anchorWorld.toArray(), robotPos: robot.position.toArray(), scale: robot.scale.x });

          robotRef.current = robot;
          onRobotLoaded(robot);

          const jointNames = Object.keys(robot.joints || {});
          console.log('Available joints:', jointNames);

          toast.success(`Robot loaded with ${jointNames.length} joints`);
        }
      } catch (err) {
        console.error("Error loading URDF:", err);
        setError("Failed to load URDF file");
        toast.error("Failed to load URDF file");
      }
    };

    reader.readAsText(file);

    // Cleanup blob URLs on unmount
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [file, meshFiles, onRobotLoaded]);

  // Animation loop
  useFrame(() => {
    if (!isPlaying || !animationFrames || !robotRef.current || animationFrames.length === 0) {
      return;
    }

    if (animationStartTime.current === 0) {
      animationStartTime.current = Date.now();
    }

    const elapsed = Date.now() - animationStartTime.current;
    const firstTimestamp = animationFrames[0].timestamp;
    const currentTime = firstTimestamp + elapsed;

    // Find the appropriate frame or interpolate
    let frameIndex = 0;
    for (let i = 0; i < animationFrames.length - 1; i++) {
      if (currentTime >= animationFrames[i].timestamp && currentTime < animationFrames[i + 1].timestamp) {
        frameIndex = i;
        break;
      }
    }

    if (frameIndex >= animationFrames.length - 1) {
      // Loop animation
      animationStartTime.current = Date.now();
      frameIndex = 0;
    }

    const currentFrame = animationFrames[frameIndex];
    const nextFrame = animationFrames[Math.min(frameIndex + 1, animationFrames.length - 1)];

    // Interpolate between frames
    const t = nextFrame.timestamp !== currentFrame.timestamp
      ? (currentTime - currentFrame.timestamp) / (nextFrame.timestamp - currentFrame.timestamp)
      : 0;

    const interpolatedJoints: Record<string, number> = {};
    for (const jointName in currentFrame.joints) {
      const current = currentFrame.joints[jointName];
      const next = nextFrame.joints[jointName] ?? current;
      interpolatedJoints[jointName] = THREE.MathUtils.lerp(current, next, t);
    }

    // Apply joint values
    if (robotRef.current && robotRef.current.setJointValues) {
      robotRef.current.setJointValues(interpolatedJoints);
    } else if (robotRef.current && robotRef.current.setJointValue) {
      // Fallback to individual joint setting
      for (const jointName in interpolatedJoints) {
        robotRef.current.setJointValue(jointName, interpolatedJoints[jointName]);
      }
    }
  });

  useEffect(() => {
    if (!isPlaying) {
      animationStartTime.current = 0;
    }
  }, [isPlaying]);

  // ===== Selection & Highlight Helpers =====
  const highlightedMeshesRef = useRef<THREE.Mesh[]>([]);

  const clearHighlights = () => {
    highlightedMeshesRef.current.forEach((mesh) => {
      const mat = (mesh.material as any);
      if (mat && mat.emissive) mat.emissive.setHex(0x000000);
    });
    highlightedMeshesRef.current = [];
  };

  const highlightLink = (linkName: string) => {
    clearHighlights();
    const robot: any = robotRef.current;
    if (!robot) return;
    const link = robot.links?.[linkName] ?? robot.getObjectByName?.(linkName);
    if (!link) return;
    link.traverse((obj: any) => {
      if (obj.isMesh) {
        const mat = obj.material;
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x1e90ff);
          highlightedMeshesRef.current.push(obj);
        }
      }
    });
  };

  const getLinkNameForJoint = (jointName: string): string | null => {
    const robot: any = robotRef.current;
    if (!robot) return null;
    const joint: any = robot.joints?.[jointName];
    if (!joint) return null;
    const linkNames = new Set(Object.keys(robot.links || {}));
    for (const child of joint.children || []) {
      if (linkNames.has((child as any).name)) return (child as any).name;
    }
    return null;
  };

  // Drag state
  const draggingJointRef = useRef<string | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Highlight when external selection changes
  useEffect(() => {
    const robot: any = robotRef.current;
    if (!robot) return;
    if (selectedJoint) {
      const ln = getLinkNameForJoint(selectedJoint);
      if (ln) highlightLink(ln);
    } else {
      clearHighlights();
    }
  }, [selectedJoint]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const robot: any = robotRef.current;
    if (!robot) return;
    let obj: THREE.Object3D | null = e.object as THREE.Object3D;
    const linkNames = new Set(Object.keys(robot.links || {}));
    let linkName: string | undefined;
    while (obj) {
      if (linkNames.has(obj.name)) { linkName = obj.name; break; }
      obj = obj.parent;
    }
    let jointName: string | null = null;
    if (linkName) {
      for (const [jName, jObj] of Object.entries<any>(robot.joints || {})) {
        if ((jObj.children || []).some((c: any) => c.name === linkName)) { jointName = jName; break; }
      }
      highlightLink(linkName);
    }
    onSelectPart?.({ linkName, jointName });

    // Start joint drag if joint found
    if (jointName) {
      draggingJointRef.current = jointName;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      onDragActiveChange?.(true);
    }
  };

  const handlePointerMove = (e: any) => {
    const jointName = draggingJointRef.current;
    if (!jointName || !robotRef.current) return;
    const last = lastPointerRef.current;
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const joint: any = robotRef.current.joints?.[jointName];
    if (!joint) return;
    const delta = (dx - dy) * 0.01; // radians per pixel
    const next = (joint.angle ?? 0) + delta;
    joint.setJointValue(next);
    onJointChange?.(jointName, next);
  };

  const handlePointerUp = () => {
    if (draggingJointRef.current) {
      draggingJointRef.current = null;
      onDragActiveChange?.(false);
    }
  };

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
};

const PlaceholderLamp = () => {
  return (
    <group>
      {/* Base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 32]} />
        <meshStandardMaterial color="#666666" />
      </mesh>

      {/* Stand */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 16]} />
        <meshStandardMaterial color="#888888" />
      </mesh>

      {/* Lampshade */}
      <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.25, 0.3, 32]} />
        <meshStandardMaterial color="#aaaaaa" />
      </mesh>
    </group>
  );
};

export const Viewer3D = ({
  urdfFile,
  initialMeshFiles = {},
  selectedJoint = null,
  jointValues = {},
  onJointSelect,
  onJointChange,
  onRobotJointsLoaded,
  onCsvNodesGenerated
}: Viewer3DProps) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [animationFrames, setAnimationFrames] = useState<AnimationFrame[] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [meshFiles, setMeshFiles] = useState<MeshFiles>(initialMeshFiles);
  const [isDraggingJoint, setIsDraggingJoint] = useState(false);

  // Global joint store
  const storeJointValues = useJointStore((s) => s.jointValues);
  const setStoreJointValues = useJointStore((s) => s.setJointValues);
  const setAvailableJointsStore = useJointStore((s) => s.setAvailableJoints);
  const setStoreJointValue = useJointStore((s) => s.setJointValue);

  // Update mesh files when initialMeshFiles changes
  useEffect(() => {
    if (Object.keys(initialMeshFiles).length > 0) {
      setMeshFiles(initialMeshFiles);
    }
  }, [initialMeshFiles]);

  // Notify host about available joints and their current angles when robot is ready
  useEffect(() => {
    if (!robot) return;
    const joints = Object.keys((robot as any).joints || {});
    const angles: Record<string, number> = {};
    joints.forEach((j) => {
      const jointObj: any = (robot as any).joints?.[j];
      angles[j] = typeof jointObj?.angle === 'number' ? jointObj.angle : 0;
    });
    // Update external callback
    onRobotJointsLoaded?.(joints, angles);
    // Update global store
    setAvailableJointsStore(joints);
    setStoreJointValues(angles);
  }, [robot, onRobotJointsLoaded, setAvailableJointsStore, setStoreJointValues]);

  // Apply joint values from props
  useEffect(() => {
    if (!robot) return;
    const r: any = robot as any;
    if (typeof r.setJointValue !== 'function') return;
    for (const [jointName, value] of Object.entries(jointValues)) {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        r.setJointValue(jointName, value);
      }
    }
  }, [robot, jointValues]);

  // Apply joint values from global store (authoritative for live slider moves)
  useEffect(() => {
    if (!robot) return;
    const r: any = robot as any;
    if (typeof r.setJointValue !== 'function') return;
    for (const [jointName, value] of Object.entries(storeJointValues)) {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        r.setJointValue(jointName, value);
      }
    }
  }, [robot, storeJointValues]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      parseCsv(file);
      toast.success(`CSV file uploaded: ${file.name}`);
    }
  };

  const parseCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("Invalid CSV/POS format");
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim());
      const timestampIndex = headers.findIndex((h) => h.toLowerCase() === 'timestamp');
      if (timestampIndex === -1) {
        toast.error("File must have a 'timestamp' column");
        return;
      }

      // Column names (excluding timestamp)
      const columnNames = headers
        .map((h) => h.trim())
        .filter((_, i) => i !== timestampIndex)
        .map((h) => h.replace('.pos', '').trim());

      // Peek at robot joints for mapping
      const robotAny: any = robot as any;
      const robotJointKeys: string[] = robotAny ? Object.keys(robotAny.joints || {}) : [];
      const actuatedJoints: string[] = robotJointKeys.filter((k) => {
        const j = robotAny?.joints?.[k];
        return j && typeof j.angle === 'number';
      });

      // Build mapping from CSV column name -> robot joint name
      const mapping = new Map<string, string>();
      columnNames.forEach((name) => {
        if (actuatedJoints.includes(name)) mapping.set(name, name);
      });
      if (mapping.size !== columnNames.length && actuatedJoints.length) {
        // If robot joints are numeric like ['1','2',...] and counts match, map by order
        const numericJoints = actuatedJoints.filter((n) => /^\d+$/.test(n)).sort((a, b) => Number(a) - Number(b));
        const candidate = numericJoints.length >= columnNames.length ? numericJoints : actuatedJoints;
        if (candidate.length >= columnNames.length && mapping.size === 0) {
          columnNames.forEach((name, i) => mapping.set(name, candidate[i]));
        }
      }

      // Parse data rows collecting raw values
      const rawFrames: { timestamp: number; joints: Record<string, number> }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        if (values.length !== headers.length) continue;
        const ts = parseFloat(values[timestampIndex]);
        const joints: Record<string, number> = {};
        for (let j = 0; j < headers.length; j++) {
          if (j === timestampIndex) continue;
          const colName = headers[j].replace('.pos', '').trim();
          const num = parseFloat(values[j]);
          joints[colName] = num;
        }
        rawFrames.push({ timestamp: ts, joints });
      }

      if (rawFrames.length === 0) {
        toast.error('No data rows found');
        return;
      }

      // Detect time units: seconds vs milliseconds
      const maxTs = Math.max(...rawFrames.map((f) => f.timestamp));
      const timeFactor = maxTs < 1e6 ? 1000 : 1; // if small, assume seconds -> convert to ms

      // Detect angle units: degrees vs radians (if any absolute value > 2π assume degrees)
      let assumeDegrees = false;
      outer: for (const f of rawFrames) {
        for (const v of Object.values(f.joints)) {
          if (Math.abs(v) > Math.PI * 2) { assumeDegrees = true; break outer; }
        }
      }

      // Build final frames mapped to robot joint names and normalized units
      const frames: AnimationFrame[] = rawFrames.map((f) => {
        const mapped: Record<string, number> = {};
        for (const [colName, value] of Object.entries(f.joints)) {
          const targetJoint = mapping.get(colName) ?? colName; // fallback to original
          const val = assumeDegrees ? (value * Math.PI) / 180 : value;
          mapped[targetJoint] = val;
        }
        return { timestamp: f.timestamp * timeFactor, joints: mapped };
      });

      setAnimationFrames(frames);

      // Convert frames to nodes and pass to parent
      const { nodes, edges } = convertCsvFramesToNodes(frames);
      onCsvNodesGenerated?.(nodes, edges);

      // Apply first frame immediately to set robot to starting pose
      if (robot && frames.length > 0) {
        const firstFrame = frames[0].joints;
        const robotAny = robot as any;
        if (robotAny.setJointValues) {
          robotAny.setJointValues(firstFrame);
        } else if (robotAny.setJointValue) {
          for (const [jointName, value] of Object.entries(firstFrame)) {
            robotAny.setJointValue(jointName, value);
          }
        }
        // Also update the store so sliders reflect the starting pose
        setStoreJointValues(firstFrame);
      }

      const jointNames = Object.keys(frames[0]?.joints || {});
      console.log('Loaded animation joint names (mapped):', jointNames);
      console.log('Available robot joints:', robot ? Object.keys((robot as any).joints || {}) : 'No robot loaded');
      console.log('First frame (radians, ms):', frames[0]);
      console.log('Last frame (radians, ms):', frames[frames.length - 1]);

      toast.success(`Loaded ${frames.length} frames with ${jointNames.length} joints`);
    };

    reader.readAsText(file);
  };

  // Convert CSV animation frames to nodes
  const convertCsvFramesToNodes = (frames: AnimationFrame[]) => {
    if (!frames || frames.length === 0) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create nodes for each keyframe
    frames.forEach((frame, index) => {
      const timestamp = frame.timestamp;
      const joints = Object.entries(frame.joints).map(([name, value]) => ({
        name,
        value
      }));

      const node = {
        id: `csv-keyframe-${index}`,
        type: "customNode",
        position: {
          x: 100 + (index * 200), // Spread nodes horizontally
          y: 100 + (index % 3) * 150 // Create rows of 3
        },
        data: {
          type: "joint",
          joints,
          onJointChange,
          onDelete: () => {
            // Handle node deletion if needed
          },
          isCsvNode: true,
          timestamp: timestamp,
          frameIndex: index
        }
      };

      nodes.push(node);

      // Create edges between consecutive frames
      if (index > 0) {
        const edge = {
          id: `csv-edge-${index - 1}-${index}`,
          source: `csv-keyframe-${index - 1}`,
          target: `csv-keyframe-${index}`,
          type: "custom",
          data: {
            onDelete: () => {
              // Handle edge deletion if needed
            }
          }
        };
        edges.push(edge);
      }
    });

    return { nodes, edges };
  };

  const handleRun = () => {
    if (!animationFrames || animationFrames.length === 0) {
      toast.error("Please upload a CSV file first");
      return;
    }
    if (!robot) {
      toast.error("Please upload a URDF file first");
      return;
    }
    setIsPlaying(!isPlaying);
    toast.success(isPlaying ? "Animation paused" : "Animation playing");
  };

  return (
    <div className="panel p-6 h-full flex flex-col">
      {/* Top Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-xs text-muted-foreground">
            {robot ? `${Object.keys(robot.joints || {}).length} joints` : "No robot"}
            {selectedJoint && ` • Selected: ${selectedJoint}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="csv-upload"
            accept=".csv,.pos"
            onChange={handleCsvUpload}
            className="hidden"
          />
          <label htmlFor="csv-upload">
            <Button variant="ghost" size="sm" className="text-xs cursor-pointer" asChild>
              <span>
                <Upload className="w-3 h-3 mr-1.5" />
                {csvFile ? csvFile.name.substring(0, 12) + '...' : 'Upload CSV/POS'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* 3D Viewer Area */}
      <div className="flex-1 bg-muted rounded-lg overflow-hidden relative">
        <Canvas
          camera={{ position: [2, 2, 4], fov: 50 }}
          style={{ background: "hsl(var(--muted))" }}
          onCreated={({ scene, camera }) => {
            // Use Z-up like Plotly/URDF
            scene.up.set(0, 0, 1);
            camera.up.set(0, 0, 1);
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <directionalLight position={[-5, 3, -5]} intensity={0.4} />
          <pointLight position={[0, 5, 0]} intensity={0.5} />

          {urdfFile ? (
            <URDFModel
              file={urdfFile}
              meshFiles={meshFiles}
              animationFrames={animationFrames}
              isPlaying={isPlaying}
              onRobotLoaded={setRobot}
              selectedJoint={selectedJoint}
              onSelectPart={({ jointName }) => onJointSelect?.(jointName ?? null)}
              onJointChange={(j, v) => { onJointChange?.(j, v); setStoreJointValue(j, v); }}
              onDragActiveChange={setIsDraggingJoint}
            />
          ) : (
            <PlaceholderLamp />
          )}

          {/* Axes helper (X=red, Y=green, Z=blue) */}
          <axesHelper args={[2]} />
          <OrbitControls makeDefault enabled={!isDraggingJoint} target={[0, 0, 0]} />
        </Canvas>

        {!urdfFile && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-muted-foreground/60">Upload URDF to view model</span>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-6"
          onClick={() => {
            setIsPlaying(false);
            setAnimationFrames(null);
            setCsvFile(null);
          }}
          disabled={!csvFile}
        >
          Reset
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground text-xs px-6"
          onClick={handleRun}
          disabled={!urdfFile || !animationFrames}
        >
          <span className="mr-1.5">{isPlaying ? "⏸" : "▶"}</span>
          {isPlaying ? "Pause" : "Run"}
        </Button>
      </div>
    </div>
  );
};
