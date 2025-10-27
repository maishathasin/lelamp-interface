import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2 } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface AIChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerateNodes: (prompt: string, response: { nodeCount?: number; motionType?: string }) => void;
}

export const AIChatDialog = ({ open, onOpenChange, onGenerateNodes }: AIChatDialogProps) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I can help you create robotic animations. Describe what you want the lamp to do, like:\n\n• \"Create a waving motion\"\n• \"Make the lamp nod up and down\"\n• \"Create a dramatic pointing gesture\"\n• \"Generate 5 random poses for exploring the workspace\"",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            // Here we'll process the command
            // For now, let's create a simple parser that generates nodes
            // In a full implementation, this would call neocortexAPI.query()

            await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

            const aiResponse = {
                message: "I'll create that animation for you!",
                nodeCount: parseNodeCount(userMessage),
                motionType: parseMotionType(userMessage),
            };

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: aiResponse.message + `\n\nGenerating ${aiResponse.nodeCount} poses with ${aiResponse.motionType} motion...`,
                },
            ]);

            // Trigger node generation
            onGenerateNodes(userMessage, aiResponse);

        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI Animation Assistant
                    </DialogTitle>
                    <DialogDescription>
                        Describe the animation you want to create, and I'll generate the nodes for you.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                    <div className="space-y-4 py-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <p className="text-sm">Thinking...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe the animation you want..."
                        className="min-h-[60px] resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!input.trim() || isLoading}
                        className="h-[60px] w-[60px]"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// Simple parsers to extract intent from user message
function parseNodeCount(message: string): number {
    const lowerMessage = message.toLowerCase();

    // Look for numbers
    const numberMatch = message.match(/\d+/);
    if (numberMatch) {
        return Math.min(Math.max(parseInt(numberMatch[0]), 2), 10); // Clamp between 2-10
    }

    // Default based on motion type
    if (lowerMessage.includes("wave") || lowerMessage.includes("waving")) return 4;
    if (lowerMessage.includes("nod")) return 3;
    if (lowerMessage.includes("point")) return 3;
    if (lowerMessage.includes("explore") || lowerMessage.includes("random")) return 5;

    return 3; // Default
}

function parseMotionType(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("wave") || lowerMessage.includes("waving")) return "waving";
    if (lowerMessage.includes("nod")) return "nodding";
    if (lowerMessage.includes("point")) return "pointing";
    if (lowerMessage.includes("explore") || lowerMessage.includes("random")) return "exploring";
    if (lowerMessage.includes("smooth")) return "smooth";
    if (lowerMessage.includes("dramatic")) return "dramatic";

    return "smooth";
}

