import { useState } from "react";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { WornVintageSearchDrawer } from "./WornVintageSearchDrawer";
import { SellpySearchDrawer } from "./SellpySearchDrawer";
import { PureEffectSearchDrawer } from "./PureEffectSearchDrawer";
import { ReDesignedBySearchDrawer } from "./ReDesignedBySearchDrawer";
import { StadsmissionenSearchDrawer } from "./StadsmissionenSearchDrawer";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function ImportsTab() {
  const [showEbayDrawer, setShowEbayDrawer] = useState(false);
  const [showTraderaDrawer, setShowTraderaDrawer] = useState(false);
  const [showWornVintageDrawer, setShowWornVintageDrawer] = useState(false);
  const [showSellpyDrawer, setShowSellpyDrawer] = useState(false);
  const [showPureEffectDrawer, setShowPureEffectDrawer] = useState(false);
  const [showReDesignedByDrawer, setShowReDesignedByDrawer] = useState(false);
  const [showStadsmissionenDrawer, setShowStadsmissionenDrawer] = useState(false);


  return (
    <div className="space-y-6">
      <div className="p-6 border border-border rounded-sm bg-card">
        <div className="space-y-3">
          <h2 className="font-display text-lg text-primary">Ancora Import Spec</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal break-words">
            Search and import items from Tradera/eBay/Pure Effect — they become draft Products directly.
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
            <Button variant="outline" onClick={() => setShowStadsmissionenDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Stadsmissionen
            </Button>
          </div>
        </div>
      </div>


      <EbaySearchDrawer
        open={showEbayDrawer}
        onOpenChange={setShowEbayDrawer}
        onImported={() => {}}
      />
      <TraderaSearchDrawer
        open={showTraderaDrawer}
        onOpenChange={setShowTraderaDrawer}
        onImported={() => {}}
      />
      <WornVintageSearchDrawer
        open={showWornVintageDrawer}
        onOpenChange={setShowWornVintageDrawer}
        onImported={() => {}}
      />
      <SellpySearchDrawer
        open={showSellpyDrawer}
        onOpenChange={setShowSellpyDrawer}
        onImported={() => {}}
      />
      <PureEffectSearchDrawer
        open={showPureEffectDrawer}
        onOpenChange={setShowPureEffectDrawer}
        onImported={() => {}}
      />
      <ReDesignedBySearchDrawer
        open={showReDesignedByDrawer}
        onOpenChange={setShowReDesignedByDrawer}
        onImported={() => {}}
      />
      <StadsmissionenSearchDrawer
        open={showStadsmissionenDrawer}
        onOpenChange={setShowStadsmissionenDrawer}
        onImported={() => {}}
      />
    </div>
  );
}
