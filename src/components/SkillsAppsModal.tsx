import { FC } from "react";
import { Layers, Sparkles, Plug, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { SkillsAppsModalProps } from "@/src/types";

export type { SkillsAppsModalProps };

export const SkillsAppsModal: FC<SkillsAppsModalProps> = ({
  open,
  onOpenChange,
  skills,
  apps,
  onSelectPrompt
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Skills & Connected Apps Directory
          </DialogTitle>
          <DialogDescription>
            Browse available agent skills (<code className="text-purple-300 font-mono">$skill</code>) and connector apps (<code className="text-cyan-300 font-mono">@app</code>) discovered by the app server.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="skills" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="skills" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Skills ({skills.length})
            </TabsTrigger>
            <TabsTrigger value="apps" className="gap-1.5">
              <Plug className="w-3.5 h-3.5 text-cyan-400" />
              Connected Apps ({apps.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1">
            {skills.map((skill) => (
              <div key={skill.name}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-purple-300 font-mono">
                      ${skill.name}
                    </span>
                    {skill.enabled && (
                      <Badge variant="success" className="text-[10px] py-0">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {skill.description}
                  </p>
                </div>

                <Button size="sm" variant="outline"
                  onClick={() => {
                    onSelectPrompt(skill.interface?.defaultPrompt || `$${skill.name} `);
                    onOpenChange(false);
                  }}
                  className="shrink-0 text-xs border-purple-800/60 text-purple-300 hover:bg-purple-950/50"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" />
                  Use Skill
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="apps" className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1">
            {apps.map((app) => (
              <div key={app.id}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-cyan-300 font-mono">
                      @{app.id}
                    </span>
                    <span className="text-xs text-zinc-200 font-medium">({app.name})</span>
                    {app.isEnabled && (
                      <Badge variant="info" className="text-[10px] py-0">Connected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <Button size="sm" variant="outline"
                  onClick={() => {
                    onSelectPrompt(`@${app.id} `);
                    onOpenChange(false);
                  }}
                  className="shrink-0 text-xs border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/50"
                >
                  <Plug className="w-3.5 h-3.5 mr-1" />
                  Mention App
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
