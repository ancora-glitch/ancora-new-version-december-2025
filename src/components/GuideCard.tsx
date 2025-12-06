interface GuideCardProps {
  image: string;
  title: string;
  onGoToGuide?: () => void;
}

export const GuideCard = ({ image, title, onGoToGuide }: GuideCardProps) => {
  return (
    <div className="group">
      {/* Image with Title Overlay */}
      <div className="relative aspect-[3/4] overflow-hidden mb-3">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <h3 className="font-sans text-sm md:text-base text-white">
            {title}
          </h3>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={onGoToGuide}
        className="w-full py-3 bg-card text-foreground font-sans text-xs tracking-wider uppercase hover:bg-secondary transition-colors duration-200"
      >
        Go to guide
      </button>
    </div>
  );
};
