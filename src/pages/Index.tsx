import { Header } from "@/components/Header";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16 px-4">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4 font-serif text-3xl font-semibold text-primary">
              Welcome to ANCORA
            </h2>
            <p className="font-sans text-muted-foreground">
              Discover timeless elegance
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
