import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/coming-soon-hero.jpg";
const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      setIsSubmitting(false);
      return;
    }
    const {
      error: insertError
    } = await supabase.from("waitlist").insert({
      email: trimmedEmail
    });
    if (insertError) {
      if (insertError.code === "23505") {
        setIsSubmitted(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } else {
      setIsSubmitted(true);
    }
    setIsSubmitting(false);
  };
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-12 md:pt-24 md:pb-20">
        {/* Logo */}
        <Link to="/home" className="mb-16 md:mb-24">
          <h1 
            className="font-logo text-5xl md:text-6xl lg:text-7xl tracking-[0.14em] uppercase font-black text-center"
            style={{ color: '#661B1C' }}
          >
            ANCORA
          </h1>
        </Link>

        {/* Hero Image */}
        <div className="w-full md:w-[75%] md:max-w-[820px] h-[300px] md:h-[320px] overflow-hidden rounded-[10px] mb-16 md:mb-24 mx-auto">
          <img 
            src={heroImage} 
            alt="Fashion editorial - stylish woman in leather jacket" 
            className="w-full h-full object-cover hero-image-position" 
          />
        </div>

        {/* Content */}
        <div className="w-full max-w-[600px] text-center mb-14 md:mb-20">
          <h2 
            className="font-serif text-3xl md:text-4xl lg:text-[2.75rem] leading-tight tracking-[0.02em] mb-8 md:mb-10"
            style={{ color: '#661B1C' }}
          >
            Ancora is coming soon
          </h2>
          <p 
            className="text-base md:text-lg leading-[1.8] max-w-[500px] mx-auto"
            style={{ color: '#661B1C' }}
          >
            We're building a new way to shop pre-loved – curated, inspiring, smooth and stylish.
            <br />
            <br />
            Sign up to get first access when we launch.
          </p>
        </div>

        {/* Form */}
        <div className="w-full max-w-[480px]">
          {isSubmitted ? (
            <p className="font-medium text-lg text-center" style={{ color: '#661B1C' }}>
              Thank you! You're on the list.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="Enter your email" 
                  className="flex-1 px-5 py-3.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" 
                  disabled={isSubmitting} 
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="px-8 py-3.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isSubmitting ? "..." : "Notify me"}
                </button>
              </div>
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 text-center">
        <p className="text-muted-foreground text-sm">© Ancora 2025</p>
      </footer>
    </div>
  );
};
export default ComingSoon;