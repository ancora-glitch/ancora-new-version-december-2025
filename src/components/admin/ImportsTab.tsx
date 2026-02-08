import { useState } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { NewImportDialog } from "./NewImportDialog";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";

export function ImportsTab() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEbayDrawer, setShowEbayDrawer] = useState(false);
  const [showTraderaDrawer, setShowTraderaDrawer] = useState(false);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTraderaDrawer(true)}>
            <Search className="w-4 h-4 mr-2" />
            Search Tradera
          </Button>
          <Button variant="outline" onClick={() => setShowEbayDrawer(true)}>
            <Search className="w-4 h-4 mr-2" />
            Search eBay
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Import
          </Button>
        </div>
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

      {/* eBay Search Drawer */}
      <EbaySearchDrawer
        open={showEbayDrawer}
        onOpenChange={setShowEbayDrawer}
        onImported={() => setSelectedItemId(null)}
      />

      {/* Tradera Search Drawer */}
      <TraderaSearchDrawer
        open={showTraderaDrawer}
        onOpenChange={setShowTraderaDrawer}
        onImported={() => setSelectedItemId(null)}
      />
    </div>
  );
}
