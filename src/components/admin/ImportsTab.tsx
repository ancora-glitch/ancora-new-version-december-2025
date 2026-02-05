import { useState } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { NewImportDialog } from "./NewImportDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ImportsTab() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleCreated = (id: string) => {
    setSelectedItemId(id);
  };

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="p-6 border border-border rounded-sm bg-card flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-primary mb-1">Ancora Import Spec</h2>
          <p className="text-sm text-muted-foreground">
            Review and curate import candidates before promoting them to products. 
            This is an internal, editorial layer — nothing is auto-published.
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Import
        </Button>
      </div>

      {/* Two-column layout on larger screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* List */}
        <div>
          <h3 className="font-medium text-primary mb-4">Candidates</h3>
          <ImportItemsList
            onSelectItem={setSelectedItemId}
            selectedItemId={selectedItemId}
          />
        </div>

        {/* Detail */}
        <div>
          <h3 className="font-medium text-primary mb-4">
            {selectedItemId ? "Detail View" : "Select an Item"}
          </h3>
          <ImportItemDetail
            itemId={selectedItemId}
            onClose={() => setSelectedItemId(null)}
          />
        </div>
      </div>

      {/* New Import Dialog */}
      <NewImportDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleCreated}
      />
    </div>
  );
}

