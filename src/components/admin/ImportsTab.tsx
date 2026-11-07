import { useState, useRef } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { WornVintageSearchDrawer } from "./WornVintageSearchDrawer";
import { SellpySearchDrawer } from "./SellpySearchDrawer";
import { PureEffectSearchDrawer } from "./PureEffectSearchDrawer";
import { ReDesignedBySearchDrawer } from "./ReDesignedBySearchDrawer";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export function ImportsTab() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showEbayDrawer, setShowEbayDrawer] = useState(false);
  const [showTraderaDrawer, setShowTraderaDrawer] = useState(false);
  const [showWornVintageDrawer, setShowWornVintageDrawer] = useState(false);
  const [showSellpyDrawer, setShowSellpyDrawer] = useState(false);
  const [showPureEffectDrawer, setShowPureEffectDrawer] = useState(false);
  const [showReDesignedByDrawer, setShowReDesignedByDrawer] = useState(false);


  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<number>(0);

  const handleSelectItem = (id: string | null) => {
    if (id) {
      // Save list scroll position before opening detail
      listScrollRef.current = window.scrollY;
      setSelectedItemId(id);
      // Auto-scroll to detail view
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      setSelectedItemId(null);
      // Restore list scroll position
      setTimeout(() => {
        window.scrollTo({ top: listScrollRef.current, behavior: "smooth" });
      }, 50);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 border border-border rounded-sm bg-card">
        <div className="space-y-3">
          <h2 className="font-display text-lg text-primary">Ancora Import Spec</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal break-words">
            Search and import items from Tradera/eBay/Pure Effect — they become draft Products directly.
            This log tracks import provenance and deduplication.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowTraderaDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Tradera
            </Button>
            <Button variant="outline" onClick={() => setShowEbayDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search eBay
            </Button>
            <Button variant="outline" onClick={() => setShowWornVintageDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Worn Vintage
            </Button>
            <Button variant="outline" onClick={() => setShowSellpyDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Sellpy
            </Button>
            <Button variant="outline" onClick={() => setShowPureEffectDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Pure Effect
            </Button>
            <Button variant="outline" onClick={() => setShowReDesignedByDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search ReDesignedBy
            </Button>
          </div>
        </div>
      </div>


      {/* Detail view above list when item selected */}
      {selectedItemId && (
        <div ref={detailRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-primary">Detail View</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectItem(null)}
            >
              <X className="w-4 h-4 mr-1" />
              Close detail
            </Button>
          </div>
          <ImportItemDetail
            itemId={selectedItemId}
            onClose={() => handleSelectItem(null)}
          />
        </div>
      )}

      {/* Candidates list */}
      <div ref={listRef}>
        <h3 className="font-medium text-primary mb-4">Import log</h3>
        <ImportItemsList
          onSelectItem={handleSelectItem}
          selectedItemId={selectedItemId}
        />
      </div>

      <EbaySearchDrawer
        open={showEbayDrawer}
        onOpenChange={setShowEbayDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <TraderaSearchDrawer
        open={showTraderaDrawer}
        onOpenChange={setShowTraderaDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <WornVintageSearchDrawer
        open={showWornVintageDrawer}
        onOpenChange={setShowWornVintageDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <SellpySearchDrawer
        open={showSellpyDrawer}
        onOpenChange={setShowSellpyDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <PureEffectSearchDrawer
        open={showPureEffectDrawer}
        onOpenChange={setShowPureEffectDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <ReDesignedBySearchDrawer
        open={showReDesignedByDrawer}
        onOpenChange={setShowReDesignedByDrawer}
        onImported={() => setSelectedItemId(null)}
      />
    </div>
  );
}
