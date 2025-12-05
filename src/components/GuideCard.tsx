import { Button } from "@/components/ui/button";

interface GuideCardProps {
  image: string;
  title: string;
  onGoToGuide?: () => void;
}

export const GuideCard = ({ image, title, onGoToGuide }: GuideCardProps) => {
  return (
    <div className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-5 md:p-6 space-y-4">
        <h3 className="font-serif text-lg md:text-xl text-ancora-burgundy">
          {title}
        </h3>
        <Button
          onClick={onGoToGuide}
          className="w-full bg-ancora-burgundy hover:bg-ancora-burgundy/90 text-white font-sans font-medium"
        >
          Go to guide
        </Button>
      </div>
    </div>
  );
};
