import { useState, useEffect } from "react";
import type { Node, Edge } from "reactflow";
import { toast } from "sonner";

export interface BehaviorTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  nodes: Node[];
  edges: Edge[];
  tags: string[];
}

const STORAGE_KEY = "robot-behavior-templates";

export const useTemplateManager = () => {
  const [templates, setTemplates] = useState<BehaviorTemplate[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTemplates(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    }
  };

  const saveTemplate = (
    name: string,
    description: string,
    author: string,
    nodes: Node[],
    edges: Edge[],
    tags: string[] = []
  ) => {
    try {
      const newTemplate: BehaviorTemplate = {
        id: `template_${Date.now()}`,
        name,
        description,
        author,
        createdAt: new Date().toISOString(),
        nodes,
        edges,
        tags,
      };

      const updatedTemplates = [...templates, newTemplate];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      toast.success("Template saved successfully!");
      return newTemplate;
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
      return null;
    }
  };

  const deleteTemplate = (id: string) => {
    try {
      const updatedTemplates = templates.filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      toast.success("Template deleted");
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    }
  };

  const exportTemplate = (template: BehaviorTemplate) => {
    try {
      const dataStr = JSON.stringify(template, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      const exportFileDefaultName = `${template.name.replace(/\s+/g, "_")}_behavior.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
      toast.success("Template exported!");
    } catch (error) {
      console.error("Failed to export template:", error);
      toast.error("Failed to export template");
    }
  };

  const importTemplate = (file: File): Promise<BehaviorTemplate | null> => {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const template = JSON.parse(e.target?.result as string) as BehaviorTemplate;
            // Validate template structure
            if (!template.nodes || !template.edges || !template.name) {
              toast.error("Invalid template format");
              resolve(null);
              return;
            }
            // Add to templates
            const updatedTemplates = [...templates, { ...template, id: `template_${Date.now()}` }];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));
            setTemplates(updatedTemplates);
            toast.success("Template imported successfully!");
            resolve(template);
          } catch (error) {
            console.error("Failed to parse template:", error);
            toast.error("Invalid template file");
            resolve(null);
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error("Failed to import template:", error);
        toast.error("Failed to import template");
        resolve(null);
      }
    });
  };

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    exportTemplate,
    importTemplate,
    loadTemplates,
  };
};
