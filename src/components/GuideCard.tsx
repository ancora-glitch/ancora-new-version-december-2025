import { Link } from "react-router-dom";

interface GuideCardProps {
  image: string;
  title: string;
  href?: string;
  onGoToGuide?: () => void;
}

export const GuideCard = ({
  image,
  title,
  href,
  onGoToGuide
}: GuideCardProps) => {
  const linkTarget = href || "#";
  
  return (
    <div className="group">
      {/* Image with Title Overlay - Clickable */}
      <div className="relative aspect-[3/4] overflow-hidden mb-4">
        <Link 
          to={linkTarget}
          aria-label={`Open guide: ${title}`}
          className="block w-full h-full cursor-pointer"
        >
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" 
          />
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors duration-300 pointer-events-none" />
        </Link>
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
          <Link 
            to={linkTarget}
            className="pointer-events-auto"
          >
            <h3 className="font-serif text-base md:text-lg text-white leading-snug hover:underline underline-offset-2">
              {title}
            </h3>
          </Link>
        </div>
      </div>

      {/* Button */}
      <Link 
        to={linkTarget}
        onClick={onGoToGuide}
        className="block w-full py-3.5 bg-card text-foreground text-xs tracking-widest uppercase hover:bg-secondary transition-colors duration-200 border border-border/30 text-center"
      >
        Go find out
      </Link>
    </div>
  );
};