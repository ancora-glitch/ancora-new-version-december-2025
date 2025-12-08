import { useState } from "react";
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

    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email: trimmedEmail });

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
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[600px] text-center space-y-10">
          {/* Logo */}
          <h1 className="font-logo text-primary text-2xl tracking-[0.12em] uppercase">
            ANCORA
          </h1>

          {/* Hero Image Placeholder */}
          <div className="w-full aspect-[3/4] sm:aspect-[16/9] overflow-hidden rounded-sm">
            <img 
              src={heroImage} 
              alt="Fashion editorial - stylish woman in leather jacket" 
              className="w-full h-full object-cover object-top"
            />
          </div>

          {/* Content */}
          <div className="space-y-6">
            <h2 className="font-serif text-primary text-3xl md:text-4xl leading-tight">
              Ancora is coming soon
            </h2>
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed max-w-[480px] mx-auto">
              We're building a new way to shop pre-loved – curated, inspiring, smooth and stylish.
              <br />
              Sign up to get first access when we launch.
            </p>
          </div>

          {/* Form */}
          {isSubmitted ? (
            <p className="text-primary font-medium text-lg">
              Thank you! You're on the list.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 max-w-[400px] mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 border border-border rounded-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "..." : "Notify me"}
                </button>
              </div>
              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-muted-foreground text-sm">© Ancora 2025</p>
      </footer>
    </div>
  );
};

export default ComingSoon;
