import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string, author: string, tags: string[]) => void;
}

export function SaveTemplateDialog({ open, onOpenChange, onSave }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onSave(name, description, author || "Anonymous", tags);
    // Reset form
    setName("");
    setDescription("");
    setAuthor("");
    setTagsInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Behavior Template</DialogTitle>
          <DialogDescription>
            Save your current node graph as a reusable template that you can share with the community.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Wave Gesture"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this behavior does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="author">Author Name</Label>
            <Input
              id="author"
              placeholder="Your name (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="gesture, beginner, utility (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
