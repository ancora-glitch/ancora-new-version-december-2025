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
    <Link 
      to={linkTarget}
      onClick={onGoToGuide}
      className="group block min-h-[44px]"
      aria-label={`Read: ${title}`}
    >
      {/* Image with Title Overlay */}
      <div className="relative aspect-[3/4] overflow-hidden mb-4">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" 
        />
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors duration-300" />
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <h3 className="font-serif text-base md:text-lg text-white leading-snug group-hover:underline underline-offset-2">
            {title}
          </h3>
        </div>
      </div>

      {/* Button */}
      <span 
        className="block w-full py-3.5 bg-card text-foreground text-xs tracking-widest uppercase group-hover:bg-secondary transition-colors duration-200 border border-border/30 text-center"
      >
        Read story
      </span>
    </Link>
  );
};
