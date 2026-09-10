import { Folder, FolderPlus, FolderOpen, ArrowUp, RefreshCw, Home, HardDrive, Check, ChevronRight, Eye, EyeOff, Search, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { DirectoryPickerDialogProps, DirEntry, RootEntry} from "@/src/types";
import { FC, Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export type { DirectoryPickerDialogProps, DirEntry, RootEntry };

export const DirectoryPickerDialog: FC<DirectoryPickerDialogProps> = ({ open, onOpenChange, initialPath, onSelectPath }) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || "");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirEntry[]>([]);
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>("");

  // Create new directory state
  const [isCreatingDir, setIsCreatingDir] = useState<boolean>(false);
  const [newDirName, setNewDirName] = useState<string>("");
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  const loadDirectory = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = targetPath
        ? `/api/fs/directories?path=${encodeURIComponent(targetPath)}`
        : "/api/fs/directories";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load directory");
      }
      const data = await res.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setDirectories(data.directories || []);
      setRoots(data.roots || []);
      setSelectedPath(data.currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to access directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDirectory(initialPath && initialPath.trim() ? initialPath : undefined);
      setIsCreatingDir(false);
      setNewDirName("");
      setFilterQuery("");
    }
  }, [open, initialPath]);

  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath);
    }
  };

  const handleEnterDir = (dirPath: string) => {
    loadDirectory(dirPath);
  };

  const handleCreateDirectory = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!newDirName.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch("/api/fs/create-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPath: currentPath,
          dirName: newDirName.trim()
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create directory");
      }
      const data = await res.json();
      setNewDirName("");
      setIsCreatingDir(false);
      await loadDirectory(currentPath);
      if (data.path) {
        setSelectedPath(data.path);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleConfirmSelect = () => {
    const finalPath = selectedPath || currentPath;
    onSelectPath(finalPath);
    onOpenChange(false);
  };

  const pathSegments = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split("/").filter(Boolean);
    const result: Array<{ name: string; fullPath: string }> = [];
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += "/" + parts[i];
      result.push({ name: parts[i], fullPath: acc });
    }
    return result;
  }, [currentPath]);

  const visibleDirs = useMemo(() => {
    return directories.filter((dir) => {
      if (!showHidden && dir.isHidden) return false;
      if (filterQuery && !dir.name.toLowerCase().includes(filterQuery.toLowerCase())) return false;
      return true;
    });
  }, [directories, showHidden, filterQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-zinc-100">
                Select Working Directory (cwd)
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Browse server filesystem and pick the workspace path for this Codex thread
              </DialogDescription>
            </div>
          </div>

          <Button type="button" size="sm" variant="ghost" disabled={loading}
            onClick={() => loadDirectory(currentPath)}
            className="text-zinc-400 hover:text-zinc-100 gap-1 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </DialogHeader>

        <div className="px-5 py-2 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-zinc-500 text-[11px] font-medium mr-1 shrink-0">Quick Locations:</span>
          {roots.map((root, i) => (
            <button key={i} type="button" onClick={() => loadDirectory(root.path)}
              className={cn(
                "px-2.5 py-1 rounded border text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-mono",
                currentPath === root.path
                  ? "bg-emerald-950/50 border-emerald-600/60 text-emerald-300 font-medium"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              )}
            >
              {i === 0 ? <HardDrive className="w-3 h-3 text-emerald-400" /> : <Home className="w-3 h-3 text-indigo-400" />}
              <span>{root.name}</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-xs text-zinc-300 font-mono flex-1">
            <button type="button" title="Root (/)" onClick={() => loadDirectory("/")}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              /
            </button>
            {pathSegments.map((seg, idx) => (
              <Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                <button type="button" onClick={() => loadDirectory(seg.fullPath)} title={seg.fullPath}
                  className={cn(
                    "px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors truncate max-w-35",
                    idx === pathSegments.length - 1 ? "text-emerald-400 font-semibold bg-emerald-950/30" : "text-zinc-300"
                  )}
                >
                  {seg.name}
                </button>
              </Fragment>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" size="sm" variant="outline" disabled={!parentPath || loading}
              onClick={handleGoUp}
              className="border-zinc-700 text-zinc-300 gap-1 text-xs"
              title="Go to Parent Directory"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Up</span>
            </Button>

            <Button type="button" size="sm" variant="outline" onClick={() => setIsCreatingDir(!isCreatingDir)}
              className="border-zinc-700 text-zinc-300 gap-1 text-xs"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
          </div>
        </div>

        {isCreatingDir && (
          <form onSubmit={handleCreateDirectory} className="px-5 py-2.5 border-b border-zinc-800 bg-emerald-950/20 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <input type="text" value={newDirName} autoFocus
              onChange={(e) => setNewDirName(e.target.value)}
              placeholder="Enter new folder name..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <Button type="submit" size="sm" disabled={!newDirName.trim() || createLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
            >
              {createLoading ? "Creating..." : "Create"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsCreatingDir(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Cancel
            </Button>
          </form>
        )}

        <div className="px-5 py-2 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter directories in current path..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <button type="button" onClick={() => setShowHidden(!showHidden)}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-[11px] cursor-pointer"
          >
            {showHidden ? <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showHidden ? "Hide dotfiles" : "Show dotfiles"}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-55 max-h-80">
          {error ? (
            <div className="p-4 rounded-lg bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          ) : visibleDirs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              {loading ? "Loading directory contents..." : "No subdirectories found in this path."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {visibleDirs.map((dir) => {
                const isSelected = selectedPath === dir.path;
                return (
                  <div key={dir.path} onClick={() => setSelectedPath(dir.path)} onDoubleClick={() => handleEnterDir(dir.path)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors group select-none",
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-600/70 text-zinc-100"
                        : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Folder className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isSelected ? "text-emerald-400 fill-emerald-400/20" : dir.isHidden ? "text-zinc-600" : "text-amber-400/80"
                        )}
                      />
                      <span className={cn("truncate font-mono", dir.isHidden && "text-zinc-500")}>
                        {dir.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" title="Enter folder"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnterDir(dir.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-opacity"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto text-xs">
            <span className="text-zinc-500 shrink-0 font-medium">Selected:</span>
            <span className="font-mono text-zinc-200 truncate bg-zinc-900 px-2 py-1 rounded border border-zinc-800 max-w-full sm:max-w-md">
              {selectedPath || currentPath || "(no path selected)"}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}
              className="text-zinc-300 border-zinc-800"
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleConfirmSelect}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select This Directory</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
