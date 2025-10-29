import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTemplateManager, type BehaviorTemplate } from "@/hooks/useTemplateManager";
import { Download, Upload, Trash2, ArrowLeft, Search, FileJson } from "lucide-react";
import { toast } from "sonner";

const exampleTemplates: BehaviorTemplate[] = [
  {
    id: "example_1",
    name: "Wave Gesture",
    description: "A friendly waving motion ",
    author: "team",
    createdAt: "2025-01-15T10:00:00Z",
    tags: ["gesture"],
    nodes: [],
    edges: [],
  },
  
];

export default function Community() {
  const navigate = useNavigate();
  const { templates, deleteTemplate, exportTemplate, importTemplate } = useTemplateManager();
  const [searchQuery, setSearchQuery] = useState("");

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importTemplate(file);
      event.target.value = ""; // Reset input
    }
  };

  const handleLoadTemplate = (template: BehaviorTemplate) => {
    // Store selected template in sessionStorage to load in main page
    sessionStorage.setItem("loadTemplate", JSON.stringify(template));
    navigate("/");
    toast.success(`Loading "${template.name}" behavior...`);
  };

  const allTemplates = [...templates, ...exampleTemplates];
  const filteredTemplates = allTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Editor
            </Button>
            <h1 className="text-4xl font-bold">Behavior Community</h1>
            <p className="text-muted-foreground mt-2">
              Explore, share, and remix robot behaviors with the community
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-template"
            />
            <Button asChild variant="outline">
              <label htmlFor="import-template" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Import Template
              </label>
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search templates by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const isExample = exampleTemplates.some((t) => t.id === template.id);
            return (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    {isExample && (
                      <Badge variant="secondary" className="ml-2">
                        Example
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">By:</span>{" "}
                      <span className="font-medium">{template.author}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleLoadTemplate(template)}
                  >
                    <FileJson className="w-4 h-4 mr-2" />
                    Load
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => exportTemplate(template)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {!isExample && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No templates found. Try adjusting your search or import a template to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
