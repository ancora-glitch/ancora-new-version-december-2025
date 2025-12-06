interface GuideCardProps {
  image: string;
  title: string;
  onGoToGuide?: () => void;
}
export const GuideCard = ({
  image,
  title,
  onGoToGuide
}: GuideCardProps) => {
  return <div className="group">
      {/* Image with Title Overlay */}
      <div className="relative aspect-[3/4] overflow-hidden mb-4">
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <h3 className="font-serif text-base md:text-lg text-white leading-snug">
            {title}
          </h3>
        </div>
      </div>

      {/* Button */}
      <button onClick={onGoToGuide} className="w-full py-3.5 bg-card text-foreground text-xs tracking-widest uppercase hover:bg-secondary transition-colors duration-200 border border-border/30">
        Go find out     
      </button>
    </div>;
};